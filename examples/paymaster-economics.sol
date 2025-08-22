// How paymasters profit from gasless transactions

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@account-abstraction/contracts/interfaces/IPaymaster.sol";

contract TokenPaymaster is IPaymaster {
    mapping(address => uint256) public ethToTokenRates; // ETH price in token terms
    mapping(address => bool) public supportedTokens;
    
    // Fee structure
    uint256 public feePercentage = 300; // 3% (300 basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    ) external view override returns (bytes memory context, uint256 validationData) {
        // 1. Extract token address from the transfer call
        address token = extractTokenFromCalldata(userOp.callData);
        require(supportedTokens[token], "Token not supported");
        
        // 2. Calculate required token amount for gas + fee
        uint256 gasInToken = (maxCost * ethToTokenRates[token]) / 1e18;
        uint256 feeInToken = (gasInToken * feePercentage) / BASIS_POINTS;
        uint256 totalRequired = gasInToken + feeInToken;
        
        // 3. Check user has enough tokens
        require(IERC20(token).balanceOf(userOp.sender) >= totalRequired, "Insufficient balance");
        
        // 4. Return context for postOp
        return (abi.encode(token, totalRequired, feeInToken), 0);
    }
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override {
        if (mode == PostOpMode.opReverted) return; // Don't charge for failed ops
        
        // 1. Decode context
        (address token, uint256 maxTokenCost, uint256 feeInToken) = abi.decode(context, (address, uint256, uint256));
        
        // 2. Calculate actual cost in tokens
        uint256 actualGasInToken = (actualGasCost * ethToTokenRates[token]) / 1e18;
        uint256 actualFeeInToken = (actualGasInToken * feePercentage) / BASIS_POINTS;
        uint256 totalCharge = actualGasInToken + actualFeeInToken;
        
        // 3. Deduct tokens from smart account
        IERC20(token).transferFrom(
            msg.sender, // Smart account address
            address(this), // Paymaster keeps the fee
            totalCharge
        );
        
        // 4. Our profit = actualFeeInToken 💰
        emit PaymasterProfit(token, actualFeeInToken);
    }
    
    function extractTokenFromCalldata(bytes calldata callData) internal pure returns (address) {
        // Parse the smart account's call to extract token address
        // This depends on your smart account's call structure
        return address(bytes20(callData[16:36])); // Example offset
    }
    
    event PaymasterProfit(address token, uint256 profit);
}
```