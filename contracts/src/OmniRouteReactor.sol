// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";

/// @notice Reactivity bridge for OmniRoute. Subscribes via Somnia's native
///         reactivity precompile to TransferSettled and TransferRefunded events
///         from the escrow, and increments live counters inside the same block
///         as the triggering event. No external relayer, no off-chain cron.
contract OmniRouteReactor is SomniaEventHandler, Ownable {
    /// keccak256("TransferSettled(uint256,uint256,uint256,uint256)") — verified with `cast keccak`
    bytes32 public constant TRANSFER_SETTLED_TOPIC =
        0x1645d3aa9f0c0687f962332acbc40808c668e3cd9e5efa3f056cc53e6ff4f76e;
    /// keccak256("TransferRefunded(uint256,uint8)") — verified with `cast keccak`
    bytes32 public constant TRANSFER_REFUNDED_TOPIC =
        0x3408e0a7eb385afa8e8c9d964735a8f90ad1af6adb66ede51d799eccb4ef043f;

    address public immutable escrow;

    uint256 public settledSubscriptionId;
    uint256 public refundedSubscriptionId;

    uint256 public totalSettled;
    uint256 public totalRefunded;
    uint256 public totalSettledValue;
    uint256 public lastSettlementTimestamp;

    event ReactorObservedSettled(uint256 indexed requestId, uint256 fxRate, uint256 payout);
    event ReactorObservedRefunded(uint256 indexed requestId, uint8 status);
    event ReactorSubscribed(uint256 indexed subscriptionId, bytes32 indexed topic);
    event ReactorUnsubscribed(uint256 indexed subscriptionId);

    error NotEscrowEvent(address emitter);
    error UnknownTopic(bytes32 topic);

    /// @notice Deploy with `--value 33ether` (or more). The precompile requires
    ///         the subscription owner (this contract) to hold ≥32 SOMI at the
    ///         moment `subscribe(...)` is called and to keep that balance to
    ///         remain an active subscriber.
    constructor(address _escrow, address _owner) payable Ownable(_owner) {
        escrow = _escrow;

        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions
            .defaultSubscriptionOptions();

        SomniaExtensions.SubscriptionFilter memory settledFilter = SomniaExtensions
            .SubscriptionFilter({
                eventTopics: [
                    TRANSFER_SETTLED_TOPIC,
                    bytes32(0),
                    bytes32(0),
                    bytes32(0)
                ],
                origin: address(0),
                emitter: _escrow
            });
        settledSubscriptionId = SomniaExtensions.subscribe(
            address(this),
            settledFilter,
            opts
        );
        emit ReactorSubscribed(settledSubscriptionId, TRANSFER_SETTLED_TOPIC);

        SomniaExtensions.SubscriptionFilter memory refundedFilter = SomniaExtensions
            .SubscriptionFilter({
                eventTopics: [
                    TRANSFER_REFUNDED_TOPIC,
                    bytes32(0),
                    bytes32(0),
                    bytes32(0)
                ],
                origin: address(0),
                emitter: _escrow
            });
        refundedSubscriptionId = SomniaExtensions.subscribe(
            address(this),
            refundedFilter,
            opts
        );
        emit ReactorSubscribed(refundedSubscriptionId, TRANSFER_REFUNDED_TOPIC);
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (emitter != escrow) revert NotEscrowEvent(emitter);
        bytes32 sig = eventTopics[0];
        uint256 requestId = uint256(eventTopics[1]);
        if (sig == TRANSFER_SETTLED_TOPIC) {
            (uint256 fxRate, uint256 payout, ) = abi.decode(
                data,
                (uint256, uint256, uint256)
            );
            unchecked {
                totalSettled += 1;
                totalSettledValue += payout;
            }
            lastSettlementTimestamp = block.timestamp;
            emit ReactorObservedSettled(requestId, fxRate, payout);
        } else if (sig == TRANSFER_REFUNDED_TOPIC) {
            uint8 status = abi.decode(data, (uint8));
            unchecked {
                totalRefunded += 1;
            }
            emit ReactorObservedRefunded(requestId, status);
        } else {
            revert UnknownTopic(sig);
        }
    }

    function unsubscribeSettled() external onlyOwner {
        uint256 id = settledSubscriptionId;
        SomniaExtensions.unsubscribe(id);
        settledSubscriptionId = 0;
        emit ReactorUnsubscribed(id);
    }

    function unsubscribeRefunded() external onlyOwner {
        uint256 id = refundedSubscriptionId;
        SomniaExtensions.unsubscribe(id);
        refundedSubscriptionId = 0;
        emit ReactorUnsubscribed(id);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function stats()
        external
        view
        returns (
            uint256 settled,
            uint256 refunded,
            uint256 settledValue,
            uint256 lastTs
        )
    {
        return (
            totalSettled,
            totalRefunded,
            totalSettledValue,
            lastSettlementTimestamp
        );
    }

    receive() external payable {}
}
