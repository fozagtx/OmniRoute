// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {SomniaPredictionMarket} from "../src/SomniaPredictionMarket.sol";

contract Deploy is Script {
    struct Deployed {
        SomniaPredictionMarket predictionMarket;
    }

    function run() external returns (Deployed memory d) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        d.predictionMarket = new SomniaPredictionMarket();
        vm.stopBroadcast();

        console2.log("SomniaPredictionMarket", address(d.predictionMarket));
        console2.log("SomniaAgents testnet  ", d.predictionMarket.SOMNIA_AGENTS_TESTNET());
        console2.log("LLM Parse Website id  ", d.predictionMarket.LLM_PARSE_WEBSITE_AGENT_ID());
        console2.log("Per-validator cost    ", d.predictionMarket.LLM_PARSE_WEBSITE_COST_PER_VALIDATOR());
        console2.log("Default subcommittee  ", d.predictionMarket.DEFAULT_SUBCOMMITTEE_SIZE());
    }
}
