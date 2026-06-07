// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Request, Response, ResponseStatus} from "../src/interfaces/ISomniaAgent.sol";
import {ReelBounty} from "../src/ReelBounty.sol";

contract LocalSomniaAgentRequester {
    uint256 public nextRequestId = 900;

    function createRequest(uint256, address, bytes4, bytes calldata) external payable returns (uint256 requestId) {
        requestId = ++nextRequestId;
    }

    function getRequestDeposit() external pure returns (uint256) {
        return 0.03 ether;
    }
}

contract ReelBountyTest is Test {
    ReelBounty private bounty;

    address private brand = address(0xA11CE);
    address private clipper = address(0xB0B);
    address private automation = address(0xA110);
    address private outsider = address(0xCAFE);

    function setUp() public {
        LocalSomniaAgentRequester requester = new LocalSomniaAgentRequester();
        vm.etch(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776, address(requester).code);

        bounty = new ReelBounty();
        vm.deal(brand, 100 ether);
        vm.deal(clipper, 100 ether);
        vm.deal(automation, 100 ether);
        vm.deal(outsider, 100 ether);

        vm.prank(brand);
        bounty.registerBrand("Acme Clips");
        vm.prank(clipper);
        bounty.registerClipper("Clipper Bob");
        bounty.setAutomationOperator(automation);
    }

    function testCreateFundedYouTubeBounty() public {
        uint256 bountyId = _createBounty(brand);

        (
            address storedBrand,
            string memory title,
            string memory campaignUrl,,
            uint256 minViews,
            uint256 rewardPerClip,
            uint256 maxPayouts,
            uint256 totalFunded,
            uint256 totalPaid,,,,
            ReelBounty.BountyStatus status,
        ) = bounty.bounties(bountyId);
        uint256[] memory brandIds = bounty.getBrandBountyIds(brand);

        assertEq(storedBrand, brand);
        assertEq(title, "First YouTube clip push");
        assertEq(campaignUrl, "https://www.youtube.com/watch?v=campaign");
        assertEq(minViews, 1_000);
        assertEq(rewardPerClip, 0.2 ether);
        assertEq(maxPayouts, 3);
        assertEq(totalFunded, 0.6 ether);
        assertEq(totalPaid, 0);
        assertEq(uint256(status), uint256(ReelBounty.BountyStatus.Open));
        assertEq(brandIds.length, 1);
        assertEq(brandIds[0], bountyId);
    }

    function testProfilesLockWalletRole() public {
        (ReelBounty.AccountRole brandRole, string memory brandName,) = bounty.profiles(brand);
        (ReelBounty.AccountRole clipperRole, string memory clipperName,) = bounty.profiles(clipper);

        assertEq(uint256(brandRole), uint256(ReelBounty.AccountRole.Brand));
        assertEq(brandName, "Acme Clips");
        assertEq(uint256(clipperRole), uint256(ReelBounty.AccountRole.Clipper));
        assertEq(clipperName, "Clipper Bob");

        vm.prank(brand);
        vm.expectRevert(ReelBounty.AlreadyRegistered.selector);
        bounty.registerClipper("Wrong Role");
    }

    function testRejectsUnderfundedBounty() public {
        vm.prank(brand);
        vm.expectRevert(abi.encodeWithSelector(ReelBounty.UnderfundedBounty.selector, 0.6 ether, 0.5 ether));
        bounty.createBounty{value: 0.5 ether}(
            "First YouTube clip push",
            "https://www.youtube.com/watch?v=campaign",
            "Publish a short that links to the campaign and reaches the view target.",
            1_000,
            0.2 ether,
            3,
            uint64(block.timestamp + 14 days)
        );
    }

    function testRejectsNonYouTubeSubmission() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        vm.expectRevert(ReelBounty.InvalidYouTubeUrl.selector);
        bounty.submitClip(bountyId, "https://example.com/not-youtube");
    }

    function testSubmitYouTubeClip() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");

        (
            uint256 storedBountyId,
            address storedClipper,
            string memory clipUrl,,
            ReelBounty.SubmissionStatus status,,,,,,,
        ) = bounty.submissions(submissionId);
        uint256[] memory ids = bounty.getBountySubmissionIds(bountyId);
        uint256[] memory clipperIds = bounty.getClipperSubmissionIds(clipper);

        assertEq(storedBountyId, bountyId);
        assertEq(storedClipper, clipper);
        assertEq(clipUrl, "https://www.youtube.com/shorts/abc123");
        assertEq(uint256(status), uint256(ReelBounty.SubmissionStatus.Submitted));
        assertEq(ids.length, 1);
        assertEq(ids[0], submissionId);
        assertEq(clipperIds.length, 1);
        assertEq(clipperIds[0], submissionId);
    }

    function testOnlyBrandCanCloseAndRefundEscrow() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(outsider);
        vm.expectRevert(ReelBounty.UnauthorizedBrand.selector);
        bounty.closeBounty(bountyId);

        uint256 beforeBalance = brand.balance;
        vm.prank(brand);
        uint256 refunded = bounty.closeBounty(bountyId);

        assertEq(refunded, 0.6 ether);
        assertEq(brand.balance, beforeBalance + 0.6 ether);
        assertEq(bounty.bountyAvailable(bountyId), 0);
    }

    function testRejectsWrongRoleActions() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        vm.expectRevert(ReelBounty.WrongAccountRole.selector);
        bounty.createBounty{value: 0.6 ether}(
            "Clipper cannot create",
            "https://www.youtube.com/watch?v=campaign",
            "Clippers submit links; brands create bounties.",
            1_000,
            0.2 ether,
            3,
            uint64(block.timestamp + 14 days)
        );

        vm.prank(brand);
        vm.expectRevert(ReelBounty.WrongAccountRole.selector);
        bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");
    }

    function testVerificationCallbackPaysClipperWhenThresholdIsMet() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");

        uint256 fee = _verificationFee();
        vm.prank(clipper);
        uint256 requestId = bounty.requestVerification{value: fee}(submissionId);

        uint256 beforeBalance = clipper.balance;
        vm.prank(bounty.SOMNIA_AGENTS_TESTNET());
        bounty.handleVerificationResponse(
            requestId, _responses(1_500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );

        (,,,, ReelBounty.SubmissionStatus status,, uint256 receipt, uint256 observedViews,, uint256 paidAmount, uint256 lastCheckedAt, uint256 nextCheckAt) =
            bounty.submissions(submissionId);
        (,,,,,, uint256 maxPayouts,, uint256 totalPaid,, uint256 approvedCount,,,) = bounty.bounties(bountyId);

        assertEq(uint256(status), uint256(ReelBounty.SubmissionStatus.Paid));
        assertEq(receipt, 777);
        assertEq(observedViews, 1_500);
        assertEq(paidAmount, 0.2 ether);
        assertEq(lastCheckedAt, block.timestamp);
        assertEq(nextCheckAt, 0);
        assertEq(totalPaid, 0.2 ether);
        assertEq(approvedCount, 1);
        assertEq(maxPayouts, 3);
        assertEq(clipper.balance, beforeBalance + 0.2 ether);
    }

    function testVerificationCallbackSchedulesRetryBelowThreshold() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://youtu.be/abc123");

        uint256 fee = _verificationFee();
        vm.prank(clipper);
        uint256 requestId = bounty.requestVerification{value: fee}(submissionId);

        vm.prank(bounty.SOMNIA_AGENTS_TESTNET());
        bounty.handleVerificationResponse(
            requestId, _responses(500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );

        (,,,, ReelBounty.SubmissionStatus status,, uint256 receipt, uint256 observedViews,, uint256 paidAmount, uint256 lastCheckedAt, uint256 nextCheckAt) =
            bounty.submissions(submissionId);
        (,,,,,,,, uint256 totalPaid,, uint256 approvedCount,,,) = bounty.bounties(bountyId);

        assertEq(uint256(status), uint256(ReelBounty.SubmissionStatus.PendingRetry));
        assertEq(receipt, 777);
        assertEq(observedViews, 500);
        assertEq(paidAmount, 0);
        assertEq(lastCheckedAt, block.timestamp);
        assertEq(nextCheckAt, block.timestamp + bounty.VERIFICATION_RETRY_COOLDOWN());
        assertEq(totalPaid, 0);
        assertEq(approvedCount, 0);
    }

    function testAutomationCanRecheckAfterCooldownAndPayClipper() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://youtu.be/abc123");

        uint256 fee = _verificationFee();
        vm.prank(clipper);
        uint256 firstRequestId = bounty.requestVerification{value: fee}(submissionId);

        vm.prank(bounty.SOMNIA_AGENTS_TESTNET());
        bounty.handleVerificationResponse(
            firstRequestId, _responses(500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );

        uint256 nextCheckAt = block.timestamp + bounty.VERIFICATION_RETRY_COOLDOWN();
        vm.prank(automation);
        vm.expectRevert(abi.encodeWithSelector(ReelBounty.VerificationCooldown.selector, nextCheckAt));
        bounty.requestVerification{value: fee}(submissionId);

        vm.warp(nextCheckAt);
        vm.prank(automation);
        uint256 secondRequestId = bounty.requestVerification{value: fee}(submissionId);

        uint256 beforeBalance = clipper.balance;
        vm.prank(bounty.SOMNIA_AGENTS_TESTNET());
        bounty.handleVerificationResponse(
            secondRequestId, _responses(1_500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );

        (,,,, ReelBounty.SubmissionStatus status,,,,, uint256 paidAmount,, uint256 clearedNextCheckAt) =
            bounty.submissions(submissionId);

        assertEq(uint256(status), uint256(ReelBounty.SubmissionStatus.Paid));
        assertEq(paidAmount, 0.2 ether);
        assertEq(clearedNextCheckAt, 0);
        assertEq(clipper.balance, beforeBalance + 0.2 ether);
    }

    function testRejectsUnauthorizedCallback() public {
        uint256 bountyId = _createBounty(brand);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");

        uint256 fee = _verificationFee();
        vm.prank(clipper);
        uint256 requestId = bounty.requestVerification{value: fee}(submissionId);

        vm.prank(outsider);
        vm.expectRevert(ReelBounty.UnauthorizedCallback.selector);
        bounty.handleVerificationResponse(
            requestId, _responses(1_500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );
    }

    function _createBounty(address owner) private returns (uint256 bountyId) {
        vm.prank(owner);
        bountyId = bounty.createBounty{value: 0.6 ether}(
            "First YouTube clip push",
            "https://www.youtube.com/watch?v=campaign",
            "Publish a public YouTube Short that links to the campaign and reaches the view target.",
            1_000,
            0.2 ether,
            3,
            uint64(block.timestamp + 14 days)
        );
    }

    function _verificationFee() private view returns (uint256) {
        (,, uint256 total) = bounty.quoteVerificationCost();
        return total;
    }

    function _responses(uint256 views, ResponseStatus status) private view returns (Response[] memory responses) {
        responses = new Response[](1);
        responses[0] = Response({
            validator: address(0xDAD),
            result: abi.encode(views),
            status: status,
            receipt: 777,
            timestamp: block.timestamp,
            executionCost: 0.1 ether
        });
    }

    function _emptyRequest() private pure returns (Request memory request) {
        return request;
    }
}
