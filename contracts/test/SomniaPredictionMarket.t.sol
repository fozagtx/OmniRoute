// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {SomniaPredictionMarket} from "../src/SomniaPredictionMarket.sol";

contract SomniaPredictionMarketTest is Test {
    SomniaPredictionMarket private market;

    address private owner = address(0xA11CE);
    address private executor = address(0xB0B);

    function setUp() public {
        market = new SomniaPredictionMarket();
        vm.deal(owner, 100 ether);
        vm.deal(executor, 100 ether);
    }

    function testCreateMarketAndStakeDirectly() public {
        uint256 marketId = _createMarket(owner);

        vm.prank(owner);
        market.stake{value: 1 ether}(marketId, SomniaPredictionMarket.Side.Yes);

        (uint256 yesPool, uint256 noPool) = market.marketPools(marketId);
        (uint256 yesStake, uint256 noStake, bool claimedPosition) = market.positionOf(marketId, owner);

        assertEq(yesPool, 1 ether);
        assertEq(noPool, 0);
        assertEq(yesStake, 1 ether);
        assertEq(noStake, 0);
        assertFalse(claimedPosition);
    }

    function testCreditBackedPolicyExecution() public {
        uint256 marketId = _createMarket(owner);

        vm.prank(owner);
        market.depositCredit{value: 2 ether}();

        vm.prank(owner);
        uint256 policyId =
            market.createPolicy(executor, SomniaPredictionMarket.Side.Yes, 1 ether, 2 ether, uint64(block.timestamp + 14 days));

        vm.prank(executor);
        market.executePolicy(policyId, marketId, SomniaPredictionMarket.Side.Yes, 1 ether);

        (uint256 yesStake,,) = market.positionOf(marketId, owner);
        (,,,,, uint256 spent,,,) = market.policies(policyId);

        assertEq(yesStake, 1 ether);
        assertEq(market.nativeCredits(owner), 1 ether);
        assertEq(spent, 1 ether);
    }

    function testPolicyRejectsOverCapExecution() public {
        uint256 marketId = _createMarket(owner);

        vm.prank(owner);
        market.depositCredit{value: 2 ether}();

        vm.prank(owner);
        uint256 policyId =
            market.createPolicy(executor, SomniaPredictionMarket.Side.Yes, 1 ether, 1 ether, uint64(block.timestamp + 14 days));

        vm.prank(executor);
        vm.expectRevert(SomniaPredictionMarket.PolicyLimitExceeded.selector);
        market.executePolicy(policyId, marketId, SomniaPredictionMarket.Side.Yes, 1.1 ether);
    }

    function testPolicyDisableStopsExecution() public {
        uint256 marketId = _createMarket(owner);

        vm.prank(owner);
        market.depositCredit{value: 2 ether}();

        vm.prank(owner);
        uint256 policyId =
            market.createPolicy(executor, SomniaPredictionMarket.Side.None, 1 ether, 2 ether, uint64(block.timestamp + 14 days));

        vm.prank(owner);
        market.disablePolicy(policyId);

        vm.prank(executor);
        vm.expectRevert(SomniaPredictionMarket.PolicyDisabledOrExpired.selector);
        market.executePolicy(policyId, marketId, SomniaPredictionMarket.Side.No, 1 ether);
    }

    function testCannotStakeAfterClose() public {
        uint256 marketId = _createMarket(owner);
        vm.warp(block.timestamp + 8 days);

        vm.prank(owner);
        vm.expectRevert(SomniaPredictionMarket.MarketNotOpen.selector);
        market.stake{value: 1 ether}(marketId, SomniaPredictionMarket.Side.Yes);
    }

    function _createMarket(address creator) private returns (uint256 marketId) {
        vm.prank(creator);
        marketId = market.createMarket(
            "Will the referenced market resolve YES?",
            "Read the referenced source and return YES or NO.",
            "https://docs.somnia.network/",
            uint64(block.timestamp + 7 days),
            false,
            1,
            70
        );
    }
}
