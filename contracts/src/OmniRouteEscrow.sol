// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {
    IAgentRequester,
    IJsonApiAgent,
    ILLMInferenceAgent,
    Request,
    Response,
    ResponseStatus,
    ConsensusType
} from "./interfaces/ISomniaAgent.sol";
import {SelfNullifierGate} from "./SelfNullifierGate.sol";

/// @notice OmniRoute escrow with two-stage agent settlement:
///         Stage 1 — JSON API agent fetches the FX rate.
///         Stage 2 — LLM Inference agent (Qwen3-30B, deterministic) decides
///                   APPROVE or REJECT on the fetched rate.
///         Vault is paid only on APPROVE; otherwise the depositor is refunded.
///         Every settlement emits a SettlementReceipt with the rate, LLM
///         verdict, and validator count so the dashboard can render a full
///         "AI consensus with reasoning" trail.
contract OmniRouteEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant FX_DECIMALS = 8;
    uint256 public constant FX_SCALE = 10 ** FX_DECIMALS;

    IAgentRequester public immutable platform;
    uint256 public immutable jsonApiAgentId;
    uint256 public immutable llmInferenceAgentId;
    SelfNullifierGate public immutable selfGate;

    address public offRampVault;
    address public agentWallet;
    uint256 public jsonRewardPerAgent;
    uint256 public llmRewardPerAgent;
    uint256 public subcommitteeSize;
    uint256 public consensusThreshold;
    uint256 public requestTimeout;

    enum Stage {
        None,
        PendingRate,
        PendingValidation,
        Settled
    }

    struct Transfer {
        address depositor;
        IERC20 token;
        uint256 amountIn;
        uint256 minOut;
        uint256 gasEscrow;
        uint256 llmCostReserved;
        uint256 fxRate;
        string destinationCurrency;
        string destinationAccount;
        string rateUrl;
        Stage stage;
    }

    struct ScheduledTransfer {
        address depositor;
        IERC20 token;
        uint256 amountIn;
        uint256 minOut;
        uint256 targetRate;
        uint256 checkBudget;
        uint256 llmCostReserved;
        uint256 gasEscrow;
        uint256 maxChecks;
        uint256 checksUsed;
        string destinationCurrency;
        string destinationAccount;
        string rateUrl;
        string rateJsonPath;
        bool active;
        bool settling;
    }

    /// @notice rateRequestId → Transfer
    mapping(uint256 => Transfer) public transfers;
    /// @notice llmRequestId → rateRequestId (so we find the transfer on the second callback)
    mapping(uint256 => uint256) public llmToRate;
    /// @notice scheduledJobId → ScheduledTransfer
    mapping(uint256 => ScheduledTransfer) public scheduledTransfers;
    /// @notice rateRequestId → scheduledJobId for recurring JSON checks
    mapping(uint256 => uint256) public scheduledRateToJob;
    uint256 public scheduledTransferCount;

    event TransferRequested(
        uint256 indexed rateRequestId,
        address indexed depositor,
        address indexed token,
        uint256 amountIn,
        uint256 minOut,
        string destinationCurrency,
        string destinationAccount,
        string rateUrl
    );

    event RateFetched(
        uint256 indexed rateRequestId,
        uint256 indexed llmRequestId,
        uint256 fxRate
    );

    event TransferSettled(
        uint256 indexed rateRequestId,
        uint256 fxRate,
        uint256 payout,
        uint256 remainingPlatformBudget
    );

    event TransferRefunded(uint256 indexed rateRequestId, uint8 status);

    /// @notice Full "AI consensus with reasoning" trail for one settlement.
    event SettlementReceipt(
        uint256 indexed rateRequestId,
        address indexed depositor,
        bool indexed approved,
        uint256 fxRate,
        uint256 payout,
        string rateUrl,
        string llmVerdict,
        uint256 subcommitteeSize,
        uint256 quorum
    );

    event ScheduledTransferCreated(
        uint256 indexed jobId,
        address indexed depositor,
        address indexed token,
        uint256 amountIn,
        uint256 minOut,
        uint256 targetRate,
        uint256 maxChecks,
        string destinationCurrency,
        string destinationAccount,
        string rateUrl
    );
    event ScheduledRateCheckRequested(
        uint256 indexed jobId,
        uint256 indexed rateRequestId,
        uint256 checksUsed,
        uint256 remainingCheckBudget
    );
    event ScheduledRateChecked(
        uint256 indexed jobId,
        uint256 indexed rateRequestId,
        uint256 fxRate,
        bool targetMet,
        uint256 checksUsed
    );
    event ScheduledTransferTriggered(
        uint256 indexed jobId,
        uint256 indexed rateRequestId,
        uint256 fxRate
    );
    event ScheduledTransferClosed(uint256 indexed jobId, string reason);

    event GasRebated(uint256 indexed rateRequestId, address indexed to, uint256 amount);
    event OffRampVaultUpdated(address indexed vault);
    event AgentWalletUpdated(address indexed wallet);
    event JsonRewardUpdated(uint256 reward);
    event LlmRewardUpdated(uint256 reward);
    event ConsensusParamsUpdated(uint256 size, uint256 threshold, uint256 timeout);
    event TreasurySwept(address indexed to, uint256 amount);

    error UnauthorizedCallback();
    error UnknownRequest();
    error WrongStage(Stage expected, Stage actual);
    error InsufficientGasDeposit(uint256 required, uint256 provided);
    error EmptyDestination();
    error ZeroAmount();
    error InvalidVault();
    error InvalidConsensus();
    error DepositorNotVerified();
    error InvalidSchedule();
    error ScheduleInactive();
    error ScheduleAlreadyChecking();

    constructor(
        address _platform,
        uint256 _jsonApiAgentId,
        uint256 _llmInferenceAgentId,
        address _offRampVault,
        address _selfGate,
        address _agentWallet,
        uint256 _jsonRewardPerAgent,
        uint256 _llmRewardPerAgent,
        uint256 _subcommitteeSize,
        uint256 _consensusThreshold,
        uint256 _requestTimeout,
        address _owner
    ) Ownable(_owner) {
        if (_platform == address(0) || _offRampVault == address(0) || _selfGate == address(0)) {
            revert InvalidVault();
        }
        if (_consensusThreshold == 0 || _consensusThreshold > _subcommitteeSize) revert InvalidConsensus();
        platform = IAgentRequester(_platform);
        jsonApiAgentId = _jsonApiAgentId;
        llmInferenceAgentId = _llmInferenceAgentId;
        offRampVault = _offRampVault;
        selfGate = SelfNullifierGate(_selfGate);
        agentWallet = _agentWallet;
        jsonRewardPerAgent = _jsonRewardPerAgent;
        llmRewardPerAgent = _llmRewardPerAgent;
        subcommitteeSize = _subcommitteeSize;
        consensusThreshold = _consensusThreshold;
        requestTimeout = _requestTimeout;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Stage 1: depositor opens a transfer
    // ─────────────────────────────────────────────────────────────────────

    function requestTransfer(
        IERC20 token,
        uint256 amountIn,
        uint256 minOut,
        string calldata destinationCurrency,
        string calldata destinationAccount,
        string calldata rateUrl,
        string calldata rateJsonPath
    ) external payable nonReentrant returns (uint256 rateRequestId) {
        if (amountIn == 0) revert ZeroAmount();
        if (bytes(destinationAccount).length == 0 || bytes(destinationCurrency).length == 0) {
            revert EmptyDestination();
        }
        if (!selfGate.isVerified(msg.sender)) revert DepositorNotVerified();

        uint256 jsonStageCost = _jsonStageCost();
        uint256 llmStageCost = _llmStageCost();
        uint256 platformCost = jsonStageCost + llmStageCost;
        if (msg.value < platformCost) revert InsufficientGasDeposit(platformCost, msg.value);

        token.safeTransferFrom(msg.sender, address(this), amountIn);

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            rateUrl,
            rateJsonPath,
            FX_DECIMALS
        );

        rateRequestId = platform.createAdvancedRequest{value: jsonStageCost}(
            jsonApiAgentId,
            address(this),
            this.handleRateResponse.selector,
            payload,
            subcommitteeSize,
            consensusThreshold,
            ConsensusType.Threshold,
            requestTimeout
        );

        transfers[rateRequestId] = Transfer({
            depositor: msg.sender,
            token: token,
            amountIn: amountIn,
            minOut: minOut,
            gasEscrow: msg.value - platformCost,
            llmCostReserved: llmStageCost,
            fxRate: 0,
            destinationCurrency: destinationCurrency,
            destinationAccount: destinationAccount,
            rateUrl: rateUrl,
            stage: Stage.PendingRate
        });

        emit TransferRequested(
            rateRequestId,
            msg.sender,
            address(token),
            amountIn,
            minOut,
            destinationCurrency,
            destinationAccount,
            rateUrl
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Stage 2: JSON API subcommittee returns a rate → dispatch LLM check
    // ─────────────────────────────────────────────────────────────────────

    function handleRateResponse(
        uint256 rateRequestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external nonReentrant {
        if (msg.sender != address(platform)) revert UnauthorizedCallback();
        Transfer storage t = transfers[rateRequestId];
        if (t.depositor == address(0)) revert UnknownRequest();
        if (t.stage != Stage.PendingRate) revert WrongStage(Stage.PendingRate, t.stage);

        if (status != ResponseStatus.Success || responses.length == 0) {
            _refund(rateRequestId, t, uint8(status), "RATE_FETCH_FAILED");
            return;
        }

        uint256 fxRate = _consensusUint(responses);
        t.fxRate = fxRate;
        t.stage = Stage.PendingValidation;

        string memory pair = string.concat("USDC->", t.destinationCurrency);
        string memory prompt = string.concat(
            "FX rate sanity check. Pair: ",
            pair,
            ". Reported rate (scaled by 1e8): ",
            Strings.toString(fxRate),
            ". Reply with exactly one of the allowed values."
        );
        string memory system =
            "You are a deterministic FX rate validator. APPROVE only if the rate is within typical FX magnitudes for fiat or major stablecoins (between 1e5 and 1e11 in 1e8-scaled form, i.e. 0.001 to 1000 unscaled). REJECT zero, negative-encoded, or absurd values. Output exactly APPROVE or REJECT.";

        string[] memory allowed = new string[](2);
        allowed[0] = "APPROVE";
        allowed[1] = "REJECT";

        bytes memory llmPayload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            prompt,
            system,
            false,
            allowed
        );

        _requestLLMValidation(rateRequestId, t, llmPayload, fxRate);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scheduled transfer automation: user funds a recurring rate check.
    // Any keeper can call checkScheduledTransfer(jobId); the contract pays
    // the Somnia JSON API agent from the user's prepaid check budget.
    // ─────────────────────────────────────────────────────────────────────

    function createScheduledTransfer(
        IERC20 token,
        uint256 amountIn,
        uint256 minOut,
        uint256 targetRate,
        uint256 maxChecks,
        string calldata destinationCurrency,
        string calldata destinationAccount,
        string calldata rateUrl,
        string calldata rateJsonPath
    ) external payable nonReentrant returns (uint256 jobId) {
        if (amountIn == 0) revert ZeroAmount();
        if (targetRate == 0 || maxChecks == 0) revert InvalidSchedule();
        if (bytes(destinationAccount).length == 0 || bytes(destinationCurrency).length == 0) {
            revert EmptyDestination();
        }
        if (!selfGate.isVerified(msg.sender)) revert DepositorNotVerified();

        (uint256 checkBudget, uint256 llmStageCost, uint256 required) = _scheduledTransferCost(maxChecks);
        if (msg.value < required) revert InsufficientGasDeposit(required, msg.value);

        token.safeTransferFrom(msg.sender, address(this), amountIn);

        jobId = ++scheduledTransferCount;
        scheduledTransfers[jobId] = ScheduledTransfer({
            depositor: msg.sender,
            token: token,
            amountIn: amountIn,
            minOut: minOut,
            targetRate: targetRate,
            checkBudget: checkBudget,
            llmCostReserved: llmStageCost,
            gasEscrow: msg.value - required,
            maxChecks: maxChecks,
            checksUsed: 0,
            destinationCurrency: destinationCurrency,
            destinationAccount: destinationAccount,
            rateUrl: rateUrl,
            rateJsonPath: rateJsonPath,
            active: true,
            settling: false
        });

        emit ScheduledTransferCreated(
            jobId,
            msg.sender,
            address(token),
            amountIn,
            minOut,
            targetRate,
            maxChecks,
            destinationCurrency,
            destinationAccount,
            rateUrl
        );
    }

    function checkScheduledTransfer(uint256 jobId) external nonReentrant returns (uint256 rateRequestId) {
        ScheduledTransfer storage job = scheduledTransfers[jobId];
        if (!job.active) revert ScheduleInactive();
        if (job.settling) revert ScheduleAlreadyChecking();
        if (job.checksUsed >= job.maxChecks) revert InvalidSchedule();

        uint256 jsonStageCost = _jsonStageCost();
        if (job.checkBudget < jsonStageCost) revert InsufficientGasDeposit(jsonStageCost, job.checkBudget);

        job.checksUsed += 1;
        job.checkBudget -= jsonStageCost;
        job.settling = true;

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            job.rateUrl,
            job.rateJsonPath,
            FX_DECIMALS
        );

        rateRequestId = platform.createAdvancedRequest{value: jsonStageCost}(
            jsonApiAgentId,
            address(this),
            this.handleScheduledRateResponse.selector,
            payload,
            subcommitteeSize,
            consensusThreshold,
            ConsensusType.Threshold,
            requestTimeout
        );

        scheduledRateToJob[rateRequestId] = jobId;
        emit ScheduledRateCheckRequested(jobId, rateRequestId, job.checksUsed, job.checkBudget);
    }

    function cancelScheduledTransfer(uint256 jobId) external nonReentrant {
        ScheduledTransfer storage job = scheduledTransfers[jobId];
        if (!job.active) revert ScheduleInactive();
        if (job.settling) revert ScheduleAlreadyChecking();
        if (msg.sender != job.depositor) revert UnauthorizedCallback();

        _closeScheduledTransfer(jobId, job, "CANCELLED");
    }

    function handleScheduledRateResponse(
        uint256 rateRequestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external nonReentrant {
        if (msg.sender != address(platform)) revert UnauthorizedCallback();
        uint256 jobId = scheduledRateToJob[rateRequestId];
        if (jobId == 0) revert UnknownRequest();

        delete scheduledRateToJob[rateRequestId];

        ScheduledTransfer storage job = scheduledTransfers[jobId];
        if (!job.active) revert ScheduleInactive();

        job.settling = false;

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit ScheduledRateChecked(jobId, rateRequestId, 0, false, job.checksUsed);
            if (job.checksUsed >= job.maxChecks) {
                _closeScheduledTransfer(jobId, job, "RATE_FETCH_FAILED");
            }
            return;
        }

        uint256 fxRate = _consensusUint(responses);
        bool targetMet = fxRate >= job.targetRate;
        emit ScheduledRateChecked(jobId, rateRequestId, fxRate, targetMet, job.checksUsed);

        if (!targetMet) {
            if (job.checksUsed >= job.maxChecks) {
                _closeScheduledTransfer(jobId, job, "TARGET_NOT_MET");
            }
            return;
        }

        job.active = false;
        job.settling = true;

        transfers[rateRequestId] = Transfer({
            depositor: job.depositor,
            token: job.token,
            amountIn: job.amountIn,
            minOut: job.minOut,
            gasEscrow: job.gasEscrow + job.checkBudget,
            llmCostReserved: job.llmCostReserved,
            fxRate: fxRate,
            destinationCurrency: job.destinationCurrency,
            destinationAccount: job.destinationAccount,
            rateUrl: job.rateUrl,
            stage: Stage.PendingValidation
        });

        job.checkBudget = 0;
        job.llmCostReserved = 0;
        job.gasEscrow = 0;
        job.settling = false;

        string memory pair = string.concat("USDC->", job.destinationCurrency);
        string memory prompt = string.concat(
            "FX rate sanity check. Pair: ",
            pair,
            ". Reported rate (scaled by 1e8): ",
            Strings.toString(fxRate),
            ". Reply with exactly one of the allowed values."
        );
        string memory system =
            "You are a deterministic FX rate validator. APPROVE only if the rate is within typical FX magnitudes for fiat or major stablecoins (between 1e5 and 1e11 in 1e8-scaled form, i.e. 0.001 to 1000 unscaled). REJECT zero, negative-encoded, or absurd values. Output exactly APPROVE or REJECT.";

        string[] memory allowed = new string[](2);
        allowed[0] = "APPROVE";
        allowed[1] = "REJECT";

        bytes memory llmPayload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            prompt,
            system,
            false,
            allowed
        );

        Transfer storage t = transfers[rateRequestId];
        _requestLLMValidation(rateRequestId, t, llmPayload, fxRate);
        emit ScheduledTransferTriggered(jobId, rateRequestId, fxRate);
        emit ScheduledTransferClosed(jobId, "TRIGGERED");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Stage 3: LLM verdict → settle or refund + emit receipt
    // ─────────────────────────────────────────────────────────────────────

    function handleLLMResponse(
        uint256 llmRequestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external nonReentrant {
        if (msg.sender != address(platform)) revert UnauthorizedCallback();
        uint256 rateRequestId = llmToRate[llmRequestId];
        if (rateRequestId == 0) revert UnknownRequest();
        Transfer storage t = transfers[rateRequestId];
        if (t.stage != Stage.PendingValidation) revert WrongStage(Stage.PendingValidation, t.stage);

        delete llmToRate[llmRequestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            _refund(rateRequestId, t, uint8(status), "LLM_FAILED");
            return;
        }

        string memory verdict = _consensusString(responses);
        bool approved = _streq(verdict, "APPROVE");

        if (!approved) {
            t.stage = Stage.Settled;
            t.token.safeTransfer(t.depositor, t.amountIn);
            emit TransferRefunded(rateRequestId, uint8(ResponseStatus.Success));
            emit SettlementReceipt(
                rateRequestId,
                t.depositor,
                false,
                t.fxRate,
                0,
                t.rateUrl,
                verdict,
                subcommitteeSize,
                consensusThreshold
            );
            _rebateGas(rateRequestId, t);
            return;
        }

        uint256 payout = (t.amountIn * t.fxRate) / FX_SCALE;
        if (payout < t.minOut) {
            t.stage = Stage.Settled;
            t.token.safeTransfer(t.depositor, t.amountIn);
            emit TransferRefunded(rateRequestId, uint8(ResponseStatus.Success));
            emit SettlementReceipt(
                rateRequestId,
                t.depositor,
                false,
                t.fxRate,
                payout,
                t.rateUrl,
                "SLIPPAGE",
                subcommitteeSize,
                consensusThreshold
            );
            _rebateGas(rateRequestId, t);
            return;
        }

        t.stage = Stage.Settled;
        t.token.safeTransfer(offRampVault, t.amountIn);
        emit TransferSettled(rateRequestId, t.fxRate, payout, 0);
        emit SettlementReceipt(
            rateRequestId,
            t.depositor,
            true,
            t.fxRate,
            payout,
            t.rateUrl,
            verdict,
            subcommitteeSize,
            consensusThreshold
        );
        _rebateGas(rateRequestId, t);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    function _jsonStageCost() internal view returns (uint256) {
        uint256 reserve = platform.getAdvancedRequestDeposit(subcommitteeSize);
        return reserve + (jsonRewardPerAgent * subcommitteeSize);
    }

    function _llmStageCost() internal view returns (uint256) {
        uint256 reserve = platform.getAdvancedRequestDeposit(subcommitteeSize);
        return reserve + (llmRewardPerAgent * subcommitteeSize);
    }

    function _scheduledTransferCost(uint256 maxChecks)
        internal
        view
        returns (uint256 checkBudget, uint256 llmStageCost, uint256 total)
    {
        checkBudget = _jsonStageCost() * maxChecks;
        llmStageCost = _llmStageCost();
        total = checkBudget + llmStageCost;
    }

    function _requestLLMValidation(
        uint256 rateRequestId,
        Transfer storage t,
        bytes memory llmPayload,
        uint256 fxRate
    ) internal {
        uint256 llmStageCost = t.llmCostReserved;
        t.llmCostReserved = 0;

        uint256 llmRequestId = platform.createAdvancedRequest{value: llmStageCost}(
            llmInferenceAgentId,
            address(this),
            this.handleLLMResponse.selector,
            llmPayload,
            subcommitteeSize,
            consensusThreshold,
            ConsensusType.Threshold,
            requestTimeout
        );

        llmToRate[llmRequestId] = rateRequestId;
        emit RateFetched(rateRequestId, llmRequestId, fxRate);
    }

    function _closeScheduledTransfer(
        uint256 jobId,
        ScheduledTransfer storage job,
        string memory reason
    ) internal {
        job.active = false;
        job.settling = false;
        uint256 nativeRefund = job.checkBudget + job.llmCostReserved + job.gasEscrow;

        job.checkBudget = 0;
        job.llmCostReserved = 0;
        job.gasEscrow = 0;

        job.token.safeTransfer(job.depositor, job.amountIn);
        if (nativeRefund > 0) {
            (bool ok, ) = job.depositor.call{value: nativeRefund}("");
            require(ok, "schedule refund failed");
        }

        emit ScheduledTransferClosed(jobId, reason);
    }

    function _refund(
        uint256 rateRequestId,
        Transfer storage t,
        uint8 statusCode,
        string memory verdict
    ) internal {
        t.stage = Stage.Settled;
        t.token.safeTransfer(t.depositor, t.amountIn);
        emit TransferRefunded(rateRequestId, statusCode);
        emit SettlementReceipt(
            rateRequestId,
            t.depositor,
            false,
            t.fxRate,
            0,
            t.rateUrl,
            verdict,
            subcommitteeSize,
            consensusThreshold
        );

        // If stage 1 failed we never spent the LLM reserve — fold it back into the rebate.
        uint256 unspent = t.llmCostReserved;
        t.llmCostReserved = 0;
        t.gasEscrow += unspent;

        _rebateGas(rateRequestId, t);
    }

    function _rebateGas(uint256 rateRequestId, Transfer storage t) internal {
        uint256 rebate = t.gasEscrow;
        if (rebate == 0) return;
        t.gasEscrow = 0;
        (bool ok, ) = t.depositor.call{value: rebate}("");
        require(ok, "rebate failed");
        emit GasRebated(rateRequestId, t.depositor, rebate);
    }

    function _consensusUint(Response[] memory responses) internal pure returns (uint256) {
        uint256 bestValue;
        uint256 bestCount;
        for (uint256 i = 0; i < responses.length; ++i) {
            if (responses[i].status != ResponseStatus.Success) continue;
            uint256 v = abi.decode(responses[i].result, (uint256));
            uint256 count = 1;
            for (uint256 j = i + 1; j < responses.length; ++j) {
                if (responses[j].status != ResponseStatus.Success) continue;
                if (abi.decode(responses[j].result, (uint256)) == v) ++count;
            }
            if (count > bestCount) {
                bestCount = count;
                bestValue = v;
            }
        }
        require(bestCount > 0, "no agreement");
        return bestValue;
    }

    function _consensusString(Response[] memory responses) internal pure returns (string memory) {
        string memory bestValue;
        uint256 bestCount;
        for (uint256 i = 0; i < responses.length; ++i) {
            if (responses[i].status != ResponseStatus.Success) continue;
            string memory v = abi.decode(responses[i].result, (string));
            uint256 count = 1;
            for (uint256 j = i + 1; j < responses.length; ++j) {
                if (responses[j].status != ResponseStatus.Success) continue;
                if (_streq(abi.decode(responses[j].result, (string)), v)) ++count;
            }
            if (count > bestCount) {
                bestCount = count;
                bestValue = v;
            }
        }
        require(bestCount > 0, "no agreement");
        return bestValue;
    }

    function _streq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    // ─────────────────────────────────────────────────────────────────────
    // Owner controls
    // ─────────────────────────────────────────────────────────────────────

    function setOffRampVault(address vault) external onlyOwner {
        if (vault == address(0)) revert InvalidVault();
        offRampVault = vault;
        emit OffRampVaultUpdated(vault);
    }

    function setAgentWallet(address wallet) external onlyOwner {
        agentWallet = wallet;
        emit AgentWalletUpdated(wallet);
    }

    function setJsonRewardPerAgent(uint256 reward) external onlyOwner {
        jsonRewardPerAgent = reward;
        emit JsonRewardUpdated(reward);
    }

    function setLlmRewardPerAgent(uint256 reward) external onlyOwner {
        llmRewardPerAgent = reward;
        emit LlmRewardUpdated(reward);
    }

    function setConsensusParams(uint256 size, uint256 threshold, uint256 timeout) external onlyOwner {
        if (threshold == 0 || threshold > size) revert InvalidConsensus();
        subcommitteeSize = size;
        consensusThreshold = threshold;
        requestTimeout = timeout;
        emit ConsensusParamsUpdated(size, threshold, timeout);
    }

    function sweepTreasury(address to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "sweep failed");
        emit TreasurySwept(to, amount);
    }

    function quoteTotalCost()
        external
        view
        returns (uint256 reserve, uint256 jsonReward, uint256 llmReward, uint256 total)
    {
        reserve = platform.getAdvancedRequestDeposit(subcommitteeSize);
        jsonReward = jsonRewardPerAgent * subcommitteeSize;
        llmReward = llmRewardPerAgent * subcommitteeSize;
        total = reserve * 2 + jsonReward + llmReward;
    }

    function quoteScheduledTransferCost(uint256 maxChecks)
        external
        view
        returns (uint256 perCheckCost, uint256 checkBudget, uint256 llmCost, uint256 total)
    {
        perCheckCost = _jsonStageCost();
        checkBudget = perCheckCost * maxChecks;
        llmCost = _llmStageCost();
        total = checkBudget + llmCost;
    }

    receive() external payable {}
}
