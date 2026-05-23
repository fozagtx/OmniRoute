// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal singleton-per-chain ERC-8004 IdentityRegistry deployed on Somnia.
///         Mirrors the canonical interface from EIP-8004 (Draft) — agentURI points to
///         the off-chain AgentCard, register() mints a new ERC-721 with that URI.
contract IdentityRegistry8004 is ERC721URIStorage, Ownable {
    uint256 public nextAgentId;

    mapping(uint256 => address) public agentWallet;
    mapping(uint256 => mapping(string => bytes)) internal _metadata;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);

    error NotAgentOwner();

    constructor() ERC721("ERC-8004 Trustless Agents", "AGENT") Ownable(msg.sender) {}

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = ++nextAgentId;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function register() external returns (uint256 agentId) {
        agentId = ++nextAgentId;
        _safeMint(msg.sender, agentId);
        emit Registered(agentId, "", msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function setAgentWallet(uint256 agentId, address wallet) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        agentWallet[agentId] = wallet;
        emit AgentWalletSet(agentId, wallet);
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        address wallet = agentWallet[agentId];
        return wallet == address(0) ? ownerOf(agentId) : wallet;
    }

    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory) {
        return _metadata[agentId][key];
    }
}
