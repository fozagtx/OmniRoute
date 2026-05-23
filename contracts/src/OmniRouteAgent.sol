// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IdentityRegistry8004} from "./IdentityRegistry8004.sol";

/// @notice Smart-contract agent wallet representing the OmniRoute agent.
///         Self-registers in the ERC-8004 IdentityRegistry at deploy time
///         (one AgentID per deployment), holds its own SOMI balance, and is
///         the only address allowed to call the privileged execution path
///         on OmniRouteEscrow. Owner is the operator (rotatable).
contract OmniRouteAgent is Ownable {
    IdentityRegistry8004 public immutable registry;
    uint256 public immutable agentId;
    string public agentCardURI;

    event ExecutedCall(address indexed target, uint256 value, bytes data, bytes result);
    event AgentCardURIUpdated(string newURI);
    event FundsWithdrawn(address indexed to, uint256 amount);

    error CallFailed(bytes returnData);

    constructor(IdentityRegistry8004 _registry, string memory _agentCardURI, address _owner) Ownable(_owner) {
        registry = _registry;
        agentCardURI = _agentCardURI;
        agentId = _registry.register(_agentCardURI);
        _registry.setAgentWallet(agentId, address(this));
    }

    /// @notice Generic execution path — the agent's signature on any on-chain action.
    function execute(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) revert CallFailed(ret);
        emit ExecutedCall(target, value, data, ret);
        return ret;
    }

    function updateAgentCardURI(string calldata newURI) external onlyOwner {
        agentCardURI = newURI;
        registry.setAgentURI(agentId, newURI);
        emit AgentCardURIUpdated(newURI);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FundsWithdrawn(to, amount);
    }

    receive() external payable {}
}
