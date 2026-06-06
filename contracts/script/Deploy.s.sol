// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {SomniaClipBounty} from "../src/SomniaClipBounty.sol";

contract Deploy is Script {
    struct Deployed {
        SomniaClipBounty clipBounty;
    }

    function run() external returns (Deployed memory d) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        d.clipBounty = new SomniaClipBounty();
        vm.stopBroadcast();

        console2.log("SomniaClipBounty     ", address(d.clipBounty));
        console2.log("SomniaAgents testnet  ", d.clipBounty.SOMNIA_AGENTS_TESTNET());
        console2.log("LLM Parse Website id  ", d.clipBounty.LLM_PARSE_WEBSITE_AGENT_ID());
        console2.log("Per-validator cost    ", d.clipBounty.LLM_PARSE_WEBSITE_COST_PER_VALIDATOR());
        console2.log("Default subcommittee  ", d.clipBounty.DEFAULT_SUBCOMMITTEE_SIZE());
    }
}
