# 🔐 Permission Flow in Account Abstraction

## How Pimlico (Bundler) Gets Authority to Act

### 1. User Grants Permission to Smart Account

```typescript
// User's EOA (MetaMask) signs permission for smart account to act
const smartAccountPermission = await userWallet.signTypedData({
  domain: {
    name: 'SimpleAccount',
    version: '1',
    chainId: 5000,
    verifyingContract: smartAccountAddress
  },
  types: {
    UserOperation: [
      { name: 'sender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
      // ... other fields
    ]
  },
  message: {
    sender: smartAccountAddress,
    nonce: 42,
    callData: transferTokensCalldata,
    // User is saying: "I authorize this specific operation"
  }
})
```

### 2. Smart Account Validates User's Authority

```solidity
contract SimpleAccount {
    address public owner; // User's EOA address
    
    function validateUserOp(UserOperation userOp) external {
        // 1. Verify the signature came from the account owner
        bytes32 hash = getUserOpHash(userOp);
        require(
            SignatureChecker.isValidSignatureNow(
                owner, // User's EOA
                hash,
                userOp.signature
            ),
            "Invalid signature"
        );
        
        // 2. Check nonce to prevent replay attacks
        require(userOp.nonce == currentNonce++, "Invalid nonce");
        
        // ✅ User has authorized this specific operation
    }
    
    // Smart account will execute what user signed
    function execute(address target, bytes calldata data) external {
        require(msg.sender == ENTRYPOINT_ADDRESS, "Only EntryPoint");
        (bool success,) = target.call(data);
        require(success, "Execution failed");
    }
}
```

### 3. Paymaster Grants Permission to Bundler

```solidity
contract MyPaymaster {
    mapping(address => bool) public authorizedBundlers;
    
    constructor() {
        // Authorize Pimlico's bundler addresses
        authorizedBundlers[0x1234...] = true; // Pimlico bundler #1
        authorizedBundlers[0x5678...] = true; // Pimlico bundler #2
    }
    
    function validatePaymasterUserOp(UserOperation userOp) external override {
        // Only authorized bundlers can request sponsorship
        require(authorizedBundlers[msg.sender], "Unauthorized bundler");
        
        // Business logic: should we sponsor this transaction?
        if (shouldSponsor(userOp)) {
            return "SPONSOR";
        }
        revert("Not sponsored");
    }
}
```

### 4. EntryPoint Coordinates Everything

```solidity
contract EntryPoint {
    function handleOps(UserOperation[] ops, address bundler) external {
        require(msg.sender == bundler, "Only bundler can submit");
        
        for (uint i = 0; i < ops.length; i++) {
            UserOperation op = ops[i];
            
            // 1. Ask smart account: "Did user authorize this?"
            IAccount(op.sender).validateUserOp(op);
            
            // 2. Ask paymaster: "Will you pay for this?"
            if (op.paymaster != address(0)) {
                IPaymaster(op.paymaster).validatePaymasterUserOp(op);
            }
            
            // 3. Execute user's desired action
            IAccount(op.sender).execute(op.target, op.callData);
            
            // 4. Paymaster reimburses bundler
            if (op.paymaster != address(0)) {
                IPaymaster(op.paymaster).postOp(op, actualGasCost);
            }
        }
    }
}
```

## Permission Hierarchy

```
User's EOA (MetaMask)
    │
    │ signs UserOperation
    ▼
Smart Account Contract
    │
    │ validates signature
    ▼
EntryPoint Contract (EIP-4337)
    │
    │ coordinates execution
    ▼
Bundler (Pimlico)
    │
    │ submits transaction
    ▼
Blockchain
```

## 🔑 Key Security Principles

### 1. User Only Signs Specific Operations
```typescript
// User signs: "I want to transfer 100 USDC to Alice"
// NOT: "Pimlico can do anything with my account"

const userOperation = {
  target: usdcAddress,
  callData: transfer(alice, 100),
  nonce: 42, // Prevents replay
  deadline: timestamp + 3600 // Prevents old signatures
}
```

### 2. Smart Account Enforces Permissions
```solidity
function execute(address target, bytes calldata data) external {
    // Only EntryPoint can call this
    require(msg.sender == ENTRYPOINT_ADDRESS, "Unauthorized");
    
    // And only after validating user's signature
    // (validateUserOp was called first)
}
```

### 3. Paymaster Controls Sponsorship
```solidity
function validatePaymasterUserOp(UserOperation op) external {
    // We decide which operations to sponsor
    if (op.callData.selector == TRANSFER_SELECTOR) {
        if (op.amount <= maxAmount) {
            return "SPONSOR"; // We'll pay
        }
    }
    revert("Not sponsored");
}
```