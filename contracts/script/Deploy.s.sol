// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {OmniRouteEscrow} from "../src/OmniRouteEscrow.sol";
import {IdentityRegistry8004} from "../src/IdentityRegistry8004.sol";
import {SelfNullifierGate} from "../src/SelfNullifierGate.sol";
import {OmniRouteAgent} from "../src/OmniRouteAgent.sol";
import {OmniRouteReactor} from "../src/OmniRouteReactor.sol";

contract Deploy is Script {
    struct Deployed {
        IdentityRegistry8004 registry;
        SelfNullifierGate gate;
        OmniRouteAgent agent;
        OmniRouteEscrow escrow;
        OmniRouteReactor reactor;
    }

    function run() external returns (Deployed memory d) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address platform = vm.envAddress("AGENT_PLATFORM");
        uint256 jsonAgentId = vm.envUint("JSON_API_AGENT_ID");
        uint256 llmAgentId = vm.envUint("LLM_INFERENCE_AGENT_ID");
        address vault = vm.envAddress("OFF_RAMP_VAULT");
        address relayer = vm.envAddress("SELF_RELAYER");
        string memory agentCardURI = vm.envString("AGENT_CARD_URI");
        string memory scopeSeed = vm.envOr("SELF_SCOPE_SEED", string("omniroute.v1"));
        // Default agent rewards reflect Somnia's published per-validator base prices:
        // JSON API ≈ 0.03 STT, LLM Inference ≈ 0.07 STT.
        uint256 jsonReward = vm.envOr("JSON_REWARD_PER_AGENT", uint256(0.03 ether));
        uint256 llmReward = vm.envOr("LLM_REWARD_PER_AGENT", uint256(0.07 ether));
        uint256 size = vm.envOr("SUBCOMMITTEE_SIZE", uint256(5));
        uint256 threshold = vm.envOr("CONSENSUS_THRESHOLD", uint256(3));
        uint256 timeout = vm.envOr("REQUEST_TIMEOUT", uint256(30));
        address owner = vm.envOr("CONTRACT_OWNER", vm.addr(pk));
        uint256 reactorFunding = vm.envOr("REACTOR_FUNDING_WEI", uint256(33 ether));

        vm.startBroadcast(pk);
        d.registry = new IdentityRegistry8004();
        d.gate = new SelfNullifierGate(scopeSeed, relayer, owner);
        d.agent = new OmniRouteAgent(d.registry, agentCardURI, owner);
        d.escrow = new OmniRouteEscrow(
            platform,
            jsonAgentId,
            llmAgentId,
            vault,
            address(d.gate),
            address(d.agent),
            jsonReward,
            llmReward,
            size,
            threshold,
            timeout,
            owner
        );
        d.reactor = new OmniRouteReactor{value: reactorFunding}(address(d.escrow), owner);
        vm.stopBroadcast();

        console2.log("IdentityRegistry8004", address(d.registry));
        console2.log("SelfNullifierGate   ", address(d.gate));
        console2.log("OmniRouteAgent      ", address(d.agent), "agentId", d.agent.agentId());
        console2.log("OmniRouteEscrow     ", address(d.escrow));
        console2.log("OmniRouteReactor    ", address(d.reactor));
        console2.log("Reactor subs settled", d.reactor.settledSubscriptionId());
        console2.log("Reactor subs refund ", d.reactor.refundedSubscriptionId());
    }
}
