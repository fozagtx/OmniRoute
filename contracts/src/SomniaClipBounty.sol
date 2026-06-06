// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentRequester, IParseWebsiteAgent, Request, Response, ResponseStatus} from "./interfaces/ISomniaAgent.sol";

/// @notice Native-STT escrow for YouTube clip bounties verified through
///         Somnia's documented LLM Parse Website agent callback path.
contract SomniaClipBounty is ReentrancyGuard {
    address public constant SOMNIA_AGENTS_TESTNET = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_PARSE_WEBSITE_AGENT_ID = 12875401142070969085;
    uint256 public constant LLM_PARSE_WEBSITE_COST_PER_VALIDATOR = 0.1 ether;
    uint256 public constant DEFAULT_SUBCOMMITTEE_SIZE = 3;

    uint256 public constant MAX_TITLE_BYTES = 160;
    uint256 public constant MAX_RULES_BYTES = 1_200;
    uint256 public constant MAX_URL_BYTES = 512;
    uint8 public constant VERIFICATION_PAGES = 2;
    uint8 public constant VERIFICATION_CONFIDENCE = 70;
    uint256 public constant MAX_VIEW_COUNT = 1_000_000_000_000;

    IAgentRequester public immutable platform;

    enum BountyStatus {
        None,
        Open,
        Closed
    }

    enum SubmissionStatus {
        None,
        Submitted,
        Verifying,
        Rejected,
        Paid
    }

    struct Bounty {
        address creator;
        string title;
        string campaignUrl;
        string rules;
        uint256 minViews;
        uint256 rewardPerClip;
        uint256 maxPayouts;
        uint256 totalFunded;
        uint256 totalPaid;
        uint256 submissionCount;
        uint256 approvedCount;
        uint64 deadline;
        BountyStatus status;
        uint256 createdAt;
    }

    struct Submission {
        uint256 bountyId;
        address clipper;
        string clipUrl;
        uint256 submittedAt;
        SubmissionStatus status;
        uint256 requestId;
        uint256 receipt;
        uint256 observedViews;
        string verificationOutput;
        uint256 paidAmount;
    }

    uint256 public bountyCount;
    uint256 public submissionCount;
    uint256 public unassignedAgentRebates;

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission) public submissions;
    mapping(uint256 => uint256[]) private bountySubmissionIds;
    mapping(uint256 => uint256) public requestToSubmission;
    mapping(uint256 => address) public requestToVerifier;
    mapping(address => uint256) public nativeCredits;

    address private pendingRebateRecipient;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 rewardPerClip,
        uint256 maxPayouts,
        uint64 deadline,
        string title,
        string campaignUrl
    );
    event BountyFunded(uint256 indexed bountyId, address indexed funder, uint256 amount);
    event BountyClosed(uint256 indexed bountyId, uint256 refunded);
    event ClipSubmitted(
        uint256 indexed bountyId, uint256 indexed submissionId, address indexed clipper, string clipUrl
    );
    event VerificationRequested(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        uint256 indexed requestId,
        address verifier,
        uint256 requiredDeposit
    );
    event VerificationReceived(
        uint256 indexed submissionId,
        uint256 indexed requestId,
        ResponseStatus status,
        uint256 observedViews,
        uint256 receipt
    );
    event ClipRejected(uint256 indexed bountyId, uint256 indexed submissionId, string reason);
    event PayoutSent(uint256 indexed bountyId, uint256 indexed submissionId, address indexed clipper, uint256 amount);
    event NativeCreditWithdrawn(address indexed account, uint256 amount);
    event AgentRebateCredited(address indexed account, uint256 amount);

    error EmptyValue();
    error StringTooLong();
    error InvalidYouTubeUrl();
    error InvalidBountyConfig();
    error BountyMissing();
    error BountyNotOpen();
    error BountyExpired();
    error BountyFull();
    error UnauthorizedCreator();
    error SubmissionMissing();
    error SubmissionNotReady();
    error UnderfundedBounty(uint256 required, uint256 provided);
    error UnderfundedVerification(uint256 required, uint256 provided);
    error InsufficientNativeCredit(uint256 available, uint256 required);
    error UnauthorizedCallback();
    error UnknownRequest();
    error NativeTransferFailed();

    constructor() {
        platform = IAgentRequester(SOMNIA_AGENTS_TESTNET);
    }

    function createBounty(
        string calldata title,
        string calldata campaignUrl,
        string calldata rules,
        uint256 minViews,
        uint256 rewardPerClip,
        uint256 maxPayouts,
        uint64 deadline
    ) external payable nonReentrant returns (uint256 bountyId) {
        _validateText(title, MAX_TITLE_BYTES);
        _validateText(campaignUrl, MAX_URL_BYTES);
        _validateText(rules, MAX_RULES_BYTES);
        if (!_isYouTubeUrl(bytes(campaignUrl))) revert InvalidYouTubeUrl();
        if (minViews == 0 || rewardPerClip == 0 || maxPayouts == 0 || deadline <= block.timestamp) {
            revert InvalidBountyConfig();
        }

        uint256 requiredFunding = rewardPerClip * maxPayouts;
        if (msg.value < requiredFunding) revert UnderfundedBounty(requiredFunding, msg.value);

        bountyId = ++bountyCount;
        bounties[bountyId] = Bounty({
            creator: msg.sender,
            title: title,
            campaignUrl: campaignUrl,
            rules: rules,
            minViews: minViews,
            rewardPerClip: rewardPerClip,
            maxPayouts: maxPayouts,
            totalFunded: msg.value,
            totalPaid: 0,
            submissionCount: 0,
            approvedCount: 0,
            deadline: deadline,
            status: BountyStatus.Open,
            createdAt: block.timestamp
        });

        emit BountyCreated(bountyId, msg.sender, rewardPerClip, maxPayouts, deadline, title, campaignUrl);
        emit BountyFunded(bountyId, msg.sender, msg.value);
    }

    function fundBounty(uint256 bountyId) external payable nonReentrant {
        if (msg.value == 0) revert EmptyValue();
        Bounty storage bounty = _bounty(bountyId);
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        bounty.totalFunded += msg.value;
        emit BountyFunded(bountyId, msg.sender, msg.value);
    }

    function closeBounty(uint256 bountyId) external nonReentrant returns (uint256 refunded) {
        Bounty storage bounty = _bounty(bountyId);
        if (bounty.creator != msg.sender) revert UnauthorizedCreator();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();

        bounty.status = BountyStatus.Closed;
        refunded = _availableEscrow(bounty);
        if (refunded > 0) {
            bounty.totalFunded = bounty.totalPaid;
            _sendNative(msg.sender, refunded);
        }

        emit BountyClosed(bountyId, refunded);
    }

    function submitClip(uint256 bountyId, string calldata clipUrl)
        external
        nonReentrant
        returns (uint256 submissionId)
    {
        _validateText(clipUrl, MAX_URL_BYTES);
        if (!_isYouTubeUrl(bytes(clipUrl))) revert InvalidYouTubeUrl();

        Bounty storage bounty = _bounty(bountyId);
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp > bounty.deadline) revert BountyExpired();
        if (bounty.approvedCount >= bounty.maxPayouts) revert BountyFull();

        submissionId = ++submissionCount;
        submissions[submissionId] = Submission({
            bountyId: bountyId,
            clipper: msg.sender,
            clipUrl: clipUrl,
            submittedAt: block.timestamp,
            status: SubmissionStatus.Submitted,
            requestId: 0,
            receipt: 0,
            observedViews: 0,
            verificationOutput: "",
            paidAmount: 0
        });

        bounty.submissionCount += 1;
        bountySubmissionIds[bountyId].push(submissionId);

        emit ClipSubmitted(bountyId, submissionId, msg.sender, clipUrl);
    }

    function requestVerification(uint256 submissionId) external payable nonReentrant returns (uint256 requestId) {
        Submission storage submission = _submission(submissionId);
        if (submission.status != SubmissionStatus.Submitted) revert SubmissionNotReady();

        Bounty storage bounty = _bounty(submission.bountyId);
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (bounty.approvedCount >= bounty.maxPayouts) revert BountyFull();

        (,, uint256 requiredDeposit) = quoteVerificationCost();
        if (msg.value < requiredDeposit) revert UnderfundedVerification(requiredDeposit, msg.value);

        uint256 extra = msg.value - requiredDeposit;
        if (extra > 0) {
            _sendNative(msg.sender, extra);
        }

        bytes memory payload = _verificationPayload(bounty, submission);
        requestId = platform.createRequest{value: requiredDeposit}(
            LLM_PARSE_WEBSITE_AGENT_ID, address(this), this.handleVerificationResponse.selector, payload
        );

        submission.status = SubmissionStatus.Verifying;
        submission.requestId = requestId;
        requestToSubmission[requestId] = submissionId;
        requestToVerifier[requestId] = msg.sender;

        emit VerificationRequested(submission.bountyId, submissionId, requestId, msg.sender, requiredDeposit);
    }

    function handleVerificationResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external nonReentrant {
        if (msg.sender != address(platform)) revert UnauthorizedCallback();
        uint256 submissionId = requestToSubmission[requestId];
        if (submissionId == 0) revert UnknownRequest();

        Submission storage submission = submissions[submissionId];
        if (submission.status != SubmissionStatus.Verifying || submission.requestId != requestId) {
            revert UnknownRequest();
        }

        address verifier = requestToVerifier[requestId];
        pendingRebateRecipient = verifier;
        delete requestToSubmission[requestId];
        delete requestToVerifier[requestId];

        Bounty storage bounty = bounties[submission.bountyId];
        (bool hasOutput, uint256 observedViews, uint256 receipt) = _firstSuccessfulUint(responses);

        submission.receipt = receipt;
        submission.observedViews = observedViews;
        submission.verificationOutput = _toString(observedViews);

        emit VerificationReceived(submissionId, requestId, status, observedViews, receipt);

        if (status != ResponseStatus.Success || !hasOutput) {
            _reject(submission.bountyId, submissionId, submission, "agent did not return a view count");
            return;
        }

        if (observedViews < bounty.minViews) {
            _reject(submission.bountyId, submissionId, submission, "view threshold not met");
            return;
        }

        if (bounty.status != BountyStatus.Open || bounty.approvedCount >= bounty.maxPayouts) {
            _reject(submission.bountyId, submissionId, submission, "bounty capacity closed");
            return;
        }

        uint256 reward = bounty.rewardPerClip;
        if (_availableEscrow(bounty) < reward) {
            _reject(submission.bountyId, submissionId, submission, "bounty escrow exhausted");
            return;
        }

        bounty.approvedCount += 1;
        bounty.totalPaid += reward;
        submission.status = SubmissionStatus.Paid;
        submission.paidAmount = reward;

        _sendNative(submission.clipper, reward);
        emit PayoutSent(submission.bountyId, submissionId, submission.clipper, reward);
    }

    function withdrawCredit(uint256 amount) external nonReentrant {
        uint256 available = nativeCredits[msg.sender];
        if (amount == 0) revert EmptyValue();
        if (available < amount) revert InsufficientNativeCredit(available, amount);
        nativeCredits[msg.sender] = available - amount;
        _sendNative(msg.sender, amount);
        emit NativeCreditWithdrawn(msg.sender, amount);
    }

    function quoteVerificationCost() public view returns (uint256 reserve, uint256 reward, uint256 total) {
        reserve = platform.getRequestDeposit();
        reward = LLM_PARSE_WEBSITE_COST_PER_VALIDATOR * DEFAULT_SUBCOMMITTEE_SIZE;
        total = reserve + reward;
    }

    function bountyAvailable(uint256 bountyId) external view returns (uint256 available) {
        return _availableEscrow(_bounty(bountyId));
    }

    function getBountySubmissionIds(uint256 bountyId) external view returns (uint256[] memory ids) {
        _bounty(bountyId);
        return bountySubmissionIds[bountyId];
    }

    function _verificationPayload(Bounty storage bounty, Submission storage submission)
        internal
        view
        returns (bytes memory)
    {
        string memory prompt = string.concat(
            "You are verifying a YouTube clip bounty.\n",
            "Campaign URL: ",
            bounty.campaignUrl,
            "\nBounty title: ",
            bounty.title,
            "\nBounty rules: ",
            bounty.rules,
            "\nMinimum views required: ",
            _toString(bounty.minViews),
            "\nTask: open the submitted YouTube URL. If it is public, related to the campaign, and satisfies the bounty rules, return the current visible YouTube view count as an integer. If the clip is private, unavailable, unrelated, or does not satisfy the rules, return 0."
        );

        return abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractANumber.selector,
            "youtube_clip_views",
            "Visible YouTube view count for a clip that satisfies the bounty rules; return 0 when the clip fails.",
            0,
            MAX_VIEW_COUNT,
            prompt,
            submission.clipUrl,
            true,
            VERIFICATION_PAGES,
            VERIFICATION_CONFIDENCE
        );
    }

    function _reject(uint256 bountyId, uint256 submissionId, Submission storage submission, string memory reason)
        internal
    {
        submission.status = SubmissionStatus.Rejected;
        emit ClipRejected(bountyId, submissionId, reason);
    }

    function _firstSuccessfulUint(Response[] memory responses)
        internal
        pure
        returns (bool ok, uint256 output, uint256 receipt)
    {
        for (uint256 i = 0; i < responses.length; ++i) {
            if (responses[i].status == ResponseStatus.Success) {
                return (true, abi.decode(responses[i].result, (uint256)), responses[i].receipt);
            }
        }
        return (false, 0, 0);
    }

    function _bounty(uint256 bountyId) internal view returns (Bounty storage bounty) {
        bounty = bounties[bountyId];
        if (bounty.status == BountyStatus.None) revert BountyMissing();
    }

    function _submission(uint256 submissionId) internal view returns (Submission storage submission) {
        submission = submissions[submissionId];
        if (submission.status == SubmissionStatus.None) revert SubmissionMissing();
    }

    function _availableEscrow(Bounty storage bounty) internal view returns (uint256) {
        return bounty.totalFunded - bounty.totalPaid;
    }

    function _validateText(string calldata value, uint256 maxBytes) internal pure {
        uint256 length = bytes(value).length;
        if (length == 0) revert EmptyValue();
        if (length > maxBytes) revert StringTooLong();
    }

    function _isYouTubeUrl(bytes memory value) internal pure returns (bool) {
        return _startsWith(value, "https://www.youtube.com/") || _startsWith(value, "https://youtube.com/")
            || _startsWith(value, "https://m.youtube.com/") || _startsWith(value, "https://youtu.be/");
    }

    function _startsWith(bytes memory value, string memory prefix) internal pure returns (bool) {
        bytes memory prefixBytes = bytes(prefix);
        if (value.length < prefixBytes.length) return false;
        for (uint256 i = 0; i < prefixBytes.length; ++i) {
            if (value[i] != prefixBytes[i]) return false;
        }
        return true;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            // forge-lint: disable-next-line(unsafe-typecast)
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
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
    }
}
