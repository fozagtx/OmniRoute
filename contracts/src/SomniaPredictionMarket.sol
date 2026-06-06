// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentRequester, IParseWebsiteAgent, Request, Response, ResponseStatus} from "./interfaces/ISomniaAgent.sol";

/// @notice Native-STT binary prediction markets resolved through Somnia's
///         documented LLM Parse Website agent callback path.
contract SomniaPredictionMarket is ReentrancyGuard {
    address public constant SOMNIA_AGENTS_TESTNET = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_PARSE_WEBSITE_AGENT_ID = 12875401142070969085;
    uint256 public constant LLM_PARSE_WEBSITE_COST_PER_VALIDATOR = 0.1 ether;
    uint256 public constant DEFAULT_SUBCOMMITTEE_SIZE = 3;

    uint256 public constant MAX_QUESTION_BYTES = 280;
    uint256 public constant MAX_PROMPT_BYTES = 1_000;
    uint256 public constant MAX_URL_BYTES = 512;
    uint8 public constant MAX_RESOLUTION_PAGES = 5;

    IAgentRequester public immutable platform;

    enum Side {
        None,
        Yes,
        No
    }

    enum MarketStatus {
        None,
        Open,
        Locked,
        Resolving,
        Resolved
    }

    enum ActionKind {
        Stake,
        PolicyStake,
        Claim,
        ResolutionRequested,
        ResolutionSucceeded,
        ResolutionFailed
    }

    struct Market {
        address creator;
        string question;
        string resolutionPrompt;
        string evidenceUrl;
        uint64 closeTime;
        bool resolveUrl;
        uint8 numPages;
        uint8 confidenceThreshold;
        MarketStatus status;
        Side outcome;
        uint256 yesPool;
        uint256 noPool;
        uint256 resolutionRequestId;
        uint256 resolutionReceipt;
        string resolutionOutput;
        ResponseStatus lastResolutionStatus;
        uint256 createdAt;
    }

    struct Position {
        uint256 yesStake;
        uint256 noStake;
        bool claimed;
    }

    struct Policy {
        address owner;
        address executor;
        Side allowedSide;
        uint256 maxStakePerAction;
        uint256 maxTotalStake;
        uint256 spent;
        uint64 expiresAt;
        bool enabled;
        uint256 createdAt;
    }

    struct MarketAction {
        uint256 marketId;
        address actor;
        address trader;
        ActionKind kind;
        Side side;
        uint256 amount;
        uint256 policyId;
        uint256 requestId;
        uint256 timestamp;
    }

    uint256 public marketCount;
    uint256 public policyCount;
    uint256 public actionCount;
    uint256 public unassignedAgentRebates;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => Policy) public policies;
    mapping(uint256 => MarketAction) public actions;
    mapping(uint256 => mapping(address => Position)) public positions;
    mapping(address => uint256) public nativeCredits;
    mapping(uint256 => uint256) public requestToMarket;
    mapping(uint256 => address) public requestToResolver;

    address private pendingRebateRecipient;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        uint64 closeTime,
        string question,
        string evidenceUrl,
        bool resolveUrl
    );
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed owner,
        address indexed executor,
        Side allowedSide,
        uint256 maxStakePerAction,
        uint256 maxTotalStake,
        uint64 expiresAt
    );
    event PolicyDisabled(uint256 indexed policyId);
    event NativeCreditDeposited(address indexed account, uint256 amount);
    event NativeCreditWithdrawn(address indexed account, uint256 amount);
    event AgentRebateCredited(address indexed account, uint256 amount);
    event MarketActionRecorded(
        uint256 indexed actionId,
        uint256 indexed marketId,
        ActionKind indexed kind,
        address actor,
        address trader,
        Side side,
        uint256 amount,
        uint256 policyId,
        uint256 requestId
    );
    event ResolutionRequested(
        uint256 indexed marketId, uint256 indexed requestId, address indexed resolver, uint256 requiredDeposit
    );
    event ResolutionReceived(
        uint256 indexed marketId, uint256 indexed requestId, ResponseStatus status, string output, uint256 receipt
    );
    event MarketResolved(uint256 indexed marketId, Side indexed outcome, string output, uint256 receipt);
    event ResolutionFailed(uint256 indexed marketId, uint256 indexed requestId, ResponseStatus status, string output);
    event Claimed(uint256 indexed marketId, address indexed trader, uint256 payout);

    error EmptyValue();
    error StringTooLong();
    error InvalidCloseTime();
    error InvalidResolutionConfig();
    error InvalidSide();
    error MarketMissing();
    error MarketNotOpen();
    error MarketNotClosed();
    error MarketResolving();
    error MarketResolvedAlready();
    error InsufficientNativeCredit(uint256 available, uint256 required);
    error InvalidPolicy();
    error PolicyDisabledOrExpired();
    error UnauthorizedExecutor();
    error PolicySideMismatch();
    error PolicyLimitExceeded();
    error UnderfundedResolution(uint256 required, uint256 provided);
    error UnauthorizedCallback();
    error UnknownRequest();
    error NothingToClaim();
    error NativeTransferFailed();

    constructor() {
        platform = IAgentRequester(SOMNIA_AGENTS_TESTNET);
    }

    function createMarket(
        string calldata question,
        string calldata resolutionPrompt,
        string calldata evidenceUrl,
        uint64 closeTime,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (uint256 marketId) {
        _validateText(question, MAX_QUESTION_BYTES);
        _validateText(resolutionPrompt, MAX_PROMPT_BYTES);
        _validateText(evidenceUrl, MAX_URL_BYTES);
        if (closeTime <= block.timestamp) revert InvalidCloseTime();
        if (numPages == 0 || numPages > MAX_RESOLUTION_PAGES || confidenceThreshold > 100) {
            revert InvalidResolutionConfig();
        }

        marketId = ++marketCount;
        markets[marketId] = Market({
            creator: msg.sender,
            question: question,
            resolutionPrompt: resolutionPrompt,
            evidenceUrl: evidenceUrl,
            closeTime: closeTime,
            resolveUrl: resolveUrl,
            numPages: numPages,
            confidenceThreshold: confidenceThreshold,
            status: MarketStatus.Open,
            outcome: Side.None,
            yesPool: 0,
            noPool: 0,
            resolutionRequestId: 0,
            resolutionReceipt: 0,
            resolutionOutput: "",
            lastResolutionStatus: ResponseStatus.None,
            createdAt: block.timestamp
        });

        emit MarketCreated(marketId, msg.sender, closeTime, question, evidenceUrl, resolveUrl);
    }

    function depositCredit() external payable {
        if (msg.value == 0) revert EmptyValue();
        nativeCredits[msg.sender] += msg.value;
        emit NativeCreditDeposited(msg.sender, msg.value);
    }

    function withdrawCredit(uint256 amount) external nonReentrant {
        uint256 available = nativeCredits[msg.sender];
        if (amount == 0) revert EmptyValue();
        if (available < amount) revert InsufficientNativeCredit(available, amount);
        nativeCredits[msg.sender] = available - amount;
        _sendNative(msg.sender, amount);
        emit NativeCreditWithdrawn(msg.sender, amount);
    }

    function createPolicy(
        address executor,
        Side allowedSide,
        uint256 maxStakePerAction,
        uint256 maxTotalStake,
        uint64 expiresAt
    ) external returns (uint256 policyId) {
        if (executor == address(0) || maxStakePerAction == 0 || maxTotalStake == 0) {
            revert InvalidPolicy();
        }
        if (expiresAt <= block.timestamp) revert PolicyDisabledOrExpired();
        if (uint8(allowedSide) > uint8(Side.No)) revert InvalidSide();

        policyId = ++policyCount;
        policies[policyId] = Policy({
            owner: msg.sender,
            executor: executor,
            allowedSide: allowedSide,
            maxStakePerAction: maxStakePerAction,
            maxTotalStake: maxTotalStake,
            spent: 0,
            expiresAt: expiresAt,
            enabled: true,
            createdAt: block.timestamp
        });

        emit PolicyCreated(policyId, msg.sender, executor, allowedSide, maxStakePerAction, maxTotalStake, expiresAt);
    }

    function disablePolicy(uint256 policyId) external {
        Policy storage policy = policies[policyId];
        if (policy.owner != msg.sender) revert InvalidPolicy();
        policy.enabled = false;
        emit PolicyDisabled(policyId);
    }

    function stake(uint256 marketId, Side side) external payable nonReentrant {
        if (msg.value == 0) revert EmptyValue();
        _stakeFor(marketId, msg.sender, msg.sender, side, msg.value, 0, ActionKind.Stake);
    }

    function stakeFromCredit(uint256 marketId, Side side, uint256 amount) external nonReentrant {
        _spendCredit(msg.sender, amount);
        _stakeFor(marketId, msg.sender, msg.sender, side, amount, 0, ActionKind.Stake);
    }

    function executePolicy(uint256 policyId, uint256 marketId, Side side, uint256 amount) external nonReentrant {
        Policy storage policy = policies[policyId];
        if (policy.owner == address(0)) revert InvalidPolicy();
        if (!policy.enabled || policy.expiresAt < block.timestamp) revert PolicyDisabledOrExpired();
        if (policy.executor != msg.sender) revert UnauthorizedExecutor();
        if (policy.allowedSide != Side.None && policy.allowedSide != side) revert PolicySideMismatch();
        if (amount == 0 || amount > policy.maxStakePerAction || policy.spent + amount > policy.maxTotalStake) {
            revert PolicyLimitExceeded();
        }

        policy.spent += amount;
        _spendCredit(policy.owner, amount);
        _stakeFor(marketId, msg.sender, policy.owner, side, amount, policyId, ActionKind.PolicyStake);
    }

    function requestResolution(uint256 marketId) external payable nonReentrant returns (uint256 requestId) {
        Market storage market = _market(marketId);
        if (market.status == MarketStatus.Resolved) revert MarketResolvedAlready();
        if (market.status == MarketStatus.Resolving) revert MarketResolving();
        if (block.timestamp < market.closeTime) revert MarketNotClosed();

        (,, uint256 requiredDeposit) = quoteResolutionCost();
        if (msg.value < requiredDeposit) revert UnderfundedResolution(requiredDeposit, msg.value);
        uint256 extra = msg.value - requiredDeposit;
        if (extra > 0) {
            nativeCredits[msg.sender] += extra;
            emit NativeCreditDeposited(msg.sender, extra);
        }

        bytes memory payload = _resolutionPayload(market);
        requestId = platform.createRequest{value: requiredDeposit}(
            LLM_PARSE_WEBSITE_AGENT_ID, address(this), this.handleResolutionResponse.selector, payload
        );

        market.status = MarketStatus.Resolving;
        market.resolutionRequestId = requestId;
        market.lastResolutionStatus = ResponseStatus.Pending;
        requestToMarket[requestId] = marketId;
        requestToResolver[requestId] = msg.sender;

        emit ResolutionRequested(marketId, requestId, msg.sender, requiredDeposit);
        _recordAction(
            marketId, msg.sender, address(0), ActionKind.ResolutionRequested, Side.None, requiredDeposit, 0, requestId
        );
    }

    function handleResolutionResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external nonReentrant {
        if (msg.sender != address(platform)) revert UnauthorizedCallback();
        uint256 marketId = requestToMarket[requestId];
        if (marketId == 0) revert UnknownRequest();

        Market storage market = markets[marketId];
        if (market.status != MarketStatus.Resolving || market.resolutionRequestId != requestId) {
            revert UnknownRequest();
        }

        address resolver = requestToResolver[requestId];
        pendingRebateRecipient = resolver;
        delete requestToMarket[requestId];
        delete requestToResolver[requestId];

        (bool hasOutput, string memory output, uint256 receipt) = _firstSuccessfulString(responses);
        emit ResolutionReceived(marketId, requestId, status, output, receipt);

        if (status != ResponseStatus.Success || !hasOutput) {
            _markResolutionFailed(marketId, market, requestId, status, output);
            return;
        }

        Side outcome = _parseOutcome(output);
        if (outcome == Side.None) {
            _markResolutionFailed(marketId, market, requestId, status, output);
            return;
        }

        market.status = MarketStatus.Resolved;
        market.outcome = outcome;
        market.resolutionRequestId = 0;
        market.resolutionReceipt = receipt;
        market.resolutionOutput = output;
        market.lastResolutionStatus = status;

        emit MarketResolved(marketId, outcome, output, receipt);
        _recordAction(marketId, address(platform), address(0), ActionKind.ResolutionSucceeded, outcome, 0, 0, requestId);
    }

    function claim(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage market = _market(marketId);
        if (market.status != MarketStatus.Resolved) revert MarketResolvedAlready();

        Position storage position = positions[marketId][msg.sender];
        if (position.claimed) revert NothingToClaim();
        position.claimed = true;

        uint256 winningPool = market.outcome == Side.Yes ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome == Side.Yes ? market.noPool : market.yesPool;
        uint256 winningStake = market.outcome == Side.Yes ? position.yesStake : position.noStake;

        if (winningPool == 0) {
            payout = position.yesStake + position.noStake;
        } else {
            if (winningStake == 0) revert NothingToClaim();
            payout = winningStake + ((winningStake * losingPool) / winningPool);
        }

        if (payout == 0) revert NothingToClaim();
        _sendNative(msg.sender, payout);
        emit Claimed(marketId, msg.sender, payout);
        _recordAction(marketId, msg.sender, msg.sender, ActionKind.Claim, market.outcome, payout, 0, 0);
    }

    function quoteResolutionCost() public view returns (uint256 reserve, uint256 reward, uint256 total) {
        reserve = platform.getRequestDeposit();
        reward = LLM_PARSE_WEBSITE_COST_PER_VALIDATOR * DEFAULT_SUBCOMMITTEE_SIZE;
        total = reserve + reward;
    }

    function marketPools(uint256 marketId) external view returns (uint256 yesPool, uint256 noPool) {
        Market storage market = _market(marketId);
        return (market.yesPool, market.noPool);
    }

    function positionOf(uint256 marketId, address trader)
        external
        view
        returns (uint256 yesStake, uint256 noStake, bool claimedPosition)
    {
        Position storage position = positions[marketId][trader];
        return (position.yesStake, position.noStake, position.claimed);
    }

    function _stakeFor(
        uint256 marketId,
        address actor,
        address trader,
        Side side,
        uint256 amount,
        uint256 policyId,
        ActionKind kind
    ) internal {
        if (!_isPositionSide(side)) revert InvalidSide();
        Market storage market = _market(marketId);
        if (market.status != MarketStatus.Open || block.timestamp >= market.closeTime) revert MarketNotOpen();

        Position storage position = positions[marketId][trader];
        if (side == Side.Yes) {
            position.yesStake += amount;
            market.yesPool += amount;
        } else {
            position.noStake += amount;
            market.noPool += amount;
        }

        _recordAction(marketId, actor, trader, kind, side, amount, policyId, 0);
    }

    function _spendCredit(address account, uint256 amount) internal {
        if (amount == 0) revert EmptyValue();
        uint256 available = nativeCredits[account];
        if (available < amount) revert InsufficientNativeCredit(available, amount);
        nativeCredits[account] = available - amount;
    }

    function _resolutionPayload(Market storage market) internal view returns (bytes memory) {
        string[] memory options = new string[](3);
        options[0] = "YES";
        options[1] = "NO";
        options[2] = "UNANSWERABLE";

        string memory prompt = string.concat(
            "Prediction market question: ",
            market.question,
            "\nResolution task: ",
            market.resolutionPrompt,
            "\nReturn exactly YES if the evidence proves the question true, NO if it proves it false, or UNANSWERABLE if the source does not establish the outcome."
        );

        return abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "market_outcome",
            "Binary prediction-market outcome. Valid answers are YES, NO, or UNANSWERABLE.",
            options,
            prompt,
            market.evidenceUrl,
            market.resolveUrl,
            market.numPages,
            market.confidenceThreshold
        );
    }

    function _markResolutionFailed(
        uint256 marketId,
        Market storage market,
        uint256 requestId,
        ResponseStatus status,
        string memory output
    ) internal {
        market.status = MarketStatus.Locked;
        market.resolutionRequestId = 0;
        market.resolutionOutput = output;
        market.lastResolutionStatus = status;

        emit ResolutionFailed(marketId, requestId, status, output);
        _recordAction(marketId, address(platform), address(0), ActionKind.ResolutionFailed, Side.None, 0, 0, requestId);
    }

    function _recordAction(
        uint256 marketId,
        address actor,
        address trader,
        ActionKind kind,
        Side side,
        uint256 amount,
        uint256 policyId,
        uint256 requestId
    ) internal {
        uint256 actionId = ++actionCount;
        actions[actionId] = MarketAction({
            marketId: marketId,
            actor: actor,
            trader: trader,
            kind: kind,
            side: side,
            amount: amount,
            policyId: policyId,
            requestId: requestId,
            timestamp: block.timestamp
        });
        emit MarketActionRecorded(actionId, marketId, kind, actor, trader, side, amount, policyId, requestId);
    }

    function _firstSuccessfulString(Response[] memory responses)
        internal
        pure
        returns (bool ok, string memory output, uint256 receipt)
    {
        for (uint256 i = 0; i < responses.length; ++i) {
            if (responses[i].status == ResponseStatus.Success) {
                return (true, abi.decode(responses[i].result, (string)), responses[i].receipt);
            }
        }
        return (false, "", 0);
    }

    function _parseOutcome(string memory output) internal pure returns (Side) {
        bytes32 hash = keccak256(bytes(output));
        if (hash == keccak256("YES")) return Side.Yes;
        if (hash == keccak256("NO")) return Side.No;
        return Side.None;
    }

    function _market(uint256 marketId) internal view returns (Market storage market) {
        market = markets[marketId];
        if (market.status == MarketStatus.None) revert MarketMissing();
    }

    function _validateText(string calldata value, uint256 maxBytes) internal pure {
        uint256 length = bytes(value).length;
        if (length == 0) revert EmptyValue();
        if (length > maxBytes) revert StringTooLong();
    }

    function _isPositionSide(Side side) internal pure returns (bool) {
        return side == Side.Yes || side == Side.No;
    }

    function _sendNative(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    receive() external payable {
        if (msg.sender == address(platform)) {
            address recipient = pendingRebateRecipient;
            if (recipient == address(0)) {
                unassignedAgentRebates += msg.value;
                return;
            }
            pendingRebateRecipient = address(0);
            nativeCredits[recipient] += msg.value;
            emit AgentRebateCredited(recipient, msg.value);
            return;
        }

        nativeCredits[msg.sender] += msg.value;
        emit NativeCreditDeposited(msg.sender, msg.value);
    }
}
