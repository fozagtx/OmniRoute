// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Request, Response, ResponseStatus} from "../src/interfaces/ISomniaAgent.sol";
import {SomniaClipBounty} from "../src/SomniaClipBounty.sol";

contract MockSomniaAgentRequester {
    uint256 public nextRequestId = 900;

    function createRequest(uint256, address, bytes4, bytes calldata) external payable returns (uint256 requestId) {
        requestId = ++nextRequestId;
    }

    function getRequestDeposit() external pure returns (uint256) {
        return 0.03 ether;
    }
}

contract SomniaClipBountyTest is Test {
    SomniaClipBounty private bounty;

    address private creator = address(0xA11CE);
    address private clipper = address(0xB0B);
    address private outsider = address(0xCAFE);

    function setUp() public {
        MockSomniaAgentRequester requester = new MockSomniaAgentRequester();
        vm.etch(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776, address(requester).code);

        bounty = new SomniaClipBounty();
        vm.deal(creator, 100 ether);
        vm.deal(clipper, 100 ether);
        vm.deal(outsider, 100 ether);
    }

    function testCreateFundedYouTubeBounty() public {
        uint256 bountyId = _createBounty(creator);

        (
            address storedCreator,
            string memory title,
            string memory campaignUrl,,
            uint256 minViews,
            uint256 rewardPerClip,
            uint256 maxPayouts,
            uint256 totalFunded,
            uint256 totalPaid,,,,
            SomniaClipBounty.BountyStatus status,
        ) = bounty.bounties(bountyId);

        assertEq(storedCreator, creator);
        assertEq(title, "First YouTube clip push");
        assertEq(campaignUrl, "https://www.youtube.com/watch?v=campaign");
        assertEq(minViews, 1_000);
        assertEq(rewardPerClip, 0.2 ether);
        assertEq(maxPayouts, 3);
        assertEq(totalFunded, 0.6 ether);
        assertEq(totalPaid, 0);
        assertEq(uint256(status), uint256(SomniaClipBounty.BountyStatus.Open));
    }

    function testRejectsUnderfundedBounty() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(SomniaClipBounty.UnderfundedBounty.selector, 0.6 ether, 0.5 ether));
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
        uint256 bountyId = _createBounty(creator);

        vm.prank(clipper);
        vm.expectRevert(SomniaClipBounty.InvalidYouTubeUrl.selector);
        bounty.submitClip(bountyId, "https://example.com/not-youtube");
    }

    function testSubmitYouTubeClip() public {
        uint256 bountyId = _createBounty(creator);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");

        (
            uint256 storedBountyId,
            address storedClipper,
            string memory clipUrl,,
            SomniaClipBounty.SubmissionStatus status,,,,,
        ) = bounty.submissions(submissionId);
        uint256[] memory ids = bounty.getBountySubmissionIds(bountyId);

        assertEq(storedBountyId, bountyId);
        assertEq(storedClipper, clipper);
        assertEq(clipUrl, "https://www.youtube.com/shorts/abc123");
        assertEq(uint256(status), uint256(SomniaClipBounty.SubmissionStatus.Submitted));
        assertEq(ids.length, 1);
        assertEq(ids[0], submissionId);
    }

    function testOnlyCreatorCanCloseAndRefundEscrow() public {
        uint256 bountyId = _createBounty(creator);

        vm.prank(outsider);
        vm.expectRevert(SomniaClipBounty.UnauthorizedCreator.selector);
        bounty.closeBounty(bountyId);

        uint256 beforeBalance = creator.balance;
        vm.prank(creator);
        uint256 refunded = bounty.closeBounty(bountyId);

        assertEq(refunded, 0.6 ether);
        assertEq(creator.balance, beforeBalance + 0.6 ether);
        assertEq(bounty.bountyAvailable(bountyId), 0);
    }

    function testVerificationCallbackPaysClipperWhenThresholdIsMet() public {
        uint256 bountyId = _createBounty(creator);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");

        uint256 fee = _verificationFee();
        vm.prank(creator);
        uint256 requestId = bounty.requestVerification{value: fee}(submissionId);

        uint256 beforeBalance = clipper.balance;
        vm.prank(bounty.SOMNIA_AGENTS_TESTNET());
        bounty.handleVerificationResponse(
            requestId, _responses(1_500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );

        (,,,, SomniaClipBounty.SubmissionStatus status,, uint256 receipt, uint256 observedViews,, uint256 paidAmount) =
            bounty.submissions(submissionId);
        (,,,,,, uint256 maxPayouts,, uint256 totalPaid,, uint256 approvedCount,,,) = bounty.bounties(bountyId);

        assertEq(uint256(status), uint256(SomniaClipBounty.SubmissionStatus.Paid));
        assertEq(receipt, 777);
        assertEq(observedViews, 1_500);
        assertEq(paidAmount, 0.2 ether);
        assertEq(totalPaid, 0.2 ether);
        assertEq(approvedCount, 1);
        assertEq(maxPayouts, 3);
        assertEq(clipper.balance, beforeBalance + 0.2 ether);
    }

    function testVerificationCallbackRejectsBelowThreshold() public {
        uint256 bountyId = _createBounty(creator);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://youtu.be/abc123");

        uint256 fee = _verificationFee();
        vm.prank(creator);
        uint256 requestId = bounty.requestVerification{value: fee}(submissionId);

        vm.prank(bounty.SOMNIA_AGENTS_TESTNET());
        bounty.handleVerificationResponse(
            requestId, _responses(500, ResponseStatus.Success), ResponseStatus.Success, _emptyRequest()
        );

        (,,,, SomniaClipBounty.SubmissionStatus status,, uint256 receipt, uint256 observedViews,, uint256 paidAmount) =
            bounty.submissions(submissionId);
        (,,,,,,,, uint256 totalPaid,, uint256 approvedCount,,,) = bounty.bounties(bountyId);

        assertEq(uint256(status), uint256(SomniaClipBounty.SubmissionStatus.Rejected));
        assertEq(receipt, 777);
        assertEq(observedViews, 500);
        assertEq(paidAmount, 0);
        assertEq(totalPaid, 0);
        assertEq(approvedCount, 0);
    }

    function testRejectsUnauthorizedCallback() public {
        uint256 bountyId = _createBounty(creator);

        vm.prank(clipper);
        uint256 submissionId = bounty.submitClip(bountyId, "https://www.youtube.com/shorts/abc123");

        uint256 fee = _verificationFee();
        vm.prank(creator);
        uint256 requestId = bounty.requestVerification{value: fee}(submissionId);

        vm.prank(outsider);
        vm.expectRevert(SomniaClipBounty.UnauthorizedCallback.selector);
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
