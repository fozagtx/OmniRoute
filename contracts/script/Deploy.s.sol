// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {ReelBounty} from "../src/ReelBounty.sol";

contract Deploy is Script {
    struct Deployed {
        ReelBounty reelBounty;
    }

    function run() external returns (Deployed memory d) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        d.reelBounty = new ReelBounty();
        vm.stopBroadcast();

        console2.log("ReelBounty           ", address(d.reelBounty));
        console2.log("Agents testnet       ", d.reelBounty.SOMNIA_AGENTS_TESTNET());
        console2.log("LLM Parse Website id ", d.reelBounty.LLM_PARSE_WEBSITE_AGENT_ID());
        console2.log("Per-validator cost   ", d.reelBounty.LLM_PARSE_WEBSITE_COST_PER_VALIDATOR());
        console2.log("Default subcommittee ", d.reelBounty.DEFAULT_SUBCOMMITTEE_SIZE());
    }
}
