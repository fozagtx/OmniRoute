// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Self-style sybil-resistance gate. Mirrors the SelfVerificationRoot
///         pattern: a verified user submits an attestation containing
///         {nullifier, userIdentifier, scope}; the contract enforces single-use
///         per nullifier-per-scope.
///
///         Self's canonical verifier (IdentityVerificationHubV2) lives on Celo.
///         Since Somnia has no native Self hub, this gate accepts attestations
///         signed by a trusted Celo→Somnia relayer that has already verified
///         the underlying ZK proof against the Celo hub. The relayer is a
///         single multisig key configured at deploy time and is rotatable.
contract SelfNullifierGate is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice keccak256(contractAddress || scopeSeed) — what the Self Hub binds against.
    uint256 public immutable scope;

    /// @notice The trusted Celo→Somnia attestation relayer. Off-chain, this key
    ///         is held by a multisig that has independently verified the ZK proof.
    address public relayer;

    /// @notice One-time-use map of (scope → nullifier → used).
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    /// @notice user EVM address → set of nullifiers consumed by it.
    mapping(address => uint256) public userNullifier;

    event Verified(address indexed user, uint256 indexed nullifier, uint256 scope);
    event RelayerUpdated(address indexed relayer);

    error NullifierAlreadyUsed();
    error BadRelayerSignature();
    error ScopeMismatch();
    error UserMismatch();
    error AttestationExpired();

    constructor(string memory scopeSeed, address _relayer, address _owner) Ownable(_owner) {
        scope = uint256(keccak256(abi.encodePacked(address(this), scopeSeed)));
        relayer = _relayer;
    }

    /// @notice Submit a relayer-signed attestation to mark the caller as verified.
    /// @dev attestationDigest = keccak256(user, nullifier, scope, deadline)
    function verify(uint256 nullifier, uint256 attestationScope, uint256 deadline, bytes calldata signature) external {
        if (attestationScope != scope) revert ScopeMismatch();
        if (block.timestamp > deadline) revert AttestationExpired();
        if (nullifierUsed[scope][nullifier]) revert NullifierAlreadyUsed();

        bytes32 digest = keccak256(abi.encode(msg.sender, nullifier, attestationScope, deadline))
            .toEthSignedMessageHash();
        if (digest.recover(signature) != relayer) revert BadRelayerSignature();

        nullifierUsed[scope][nullifier] = true;
        userNullifier[msg.sender] = nullifier;
        emit Verified(msg.sender, nullifier, scope);
    }

    function isVerified(address user) external view returns (bool) {
        return userNullifier[user] != 0;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }
}
