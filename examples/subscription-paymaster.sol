// Subscription-based paymaster model

pragma solidity ^0.8.0;

contract SubscriptionPaymaster is IPaymaster {
    struct Subscription {
        uint256 expiryTime;
        uint256 gasCredits; // Remaining gas credits
        address paymentToken;
    }
    
    mapping(address => Subscription) public subscriptions;
    
    // Pricing
    uint256 public monthlyPrice = 10e6; // 10 USDC per month
    uint256 public gasCreditsPerMonth = 1000000; // 1M gas units
    
    function purchaseSubscription(address token, uint256 duration) external {
        require(duration >= 1 && duration <= 12, "Invalid duration");
        
        uint256 cost = monthlyPrice * duration;
        IERC20(token).transferFrom(msg.sender, address(this), cost);
        
        subscriptions[msg.sender] = Subscription({
            expiryTime: block.timestamp + (duration * 30 days),
            gasCredits: gasCreditsPerMonth * duration,
            paymentToken: token
        });
        
        // Our revenue = cost 💰
        emit SubscriptionPurchased(msg.sender, cost, duration);
    }
    
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    ) external view override returns (bytes memory context, uint256 validationData) {
        Subscription memory sub = subscriptions[userOp.sender];
        
        // Check subscription is valid and has credits
        require(block.timestamp < sub.expiryTime, "Subscription expired");
        require(sub.gasCredits >= maxCost, "Insufficient gas credits");
        
        return (abi.encode(userOp.sender, maxCost), 0);
    }
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override {
        if (mode == PostOpMode.opReverted) return;
        
        (address user, uint256 maxCost) = abi.decode(context, (address, uint256));
        
        // Deduct gas credits
        subscriptions[user].gasCredits -= actualGasCost;
        
        emit GasCreditsUsed(user, actualGasCost);
    }
    
    event SubscriptionPurchased(address user, uint256 cost, uint256 duration);
    event GasCreditsUsed(address user, uint256 gasUsed);
}
```