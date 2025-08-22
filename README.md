# gasless-core

A TypeScript SDK for enabling gasless token transfers on Mantle EVM using meta-transactions and permit-based approvals with your deployed GaslessRelayer smart contract.

## Features

- 🚫⛽ **Gasless Transactions**: Enable users to transfer tokens without holding native tokens for gas
- 🔐 **EIP-2612 Permit Support**: Leverage permit-based approvals for enhanced UX
- 🌉 **Meta-Transaction Framework**: Built on top of EIP-712 meta-transaction patterns
- 📝 **TypeScript First**: Full type safety and excellent developer experience
- 🧪 **Thoroughly Tested**: Comprehensive test suite with Jest
- ⚡ **Simple API**: One-line transfers with the new simplified interface

## Installation

```bash
npm install gasless-core
```

## Quick Start

### Simple One-Line Transfer

```typescript
import { Gasless } from 'gasless-core'

// One-line gasless transfer
const result = await Gasless.quickTransfer({
  rpcUrl: 'https://rpc.mantle.xyz',
  chainId: 5000,
  relayerAddress: '0xYourDeployedGaslessRelayerAddress',
  relayerUrl: 'https://your-relayer-service.com' // Your relayer service endpoint
}, {
  token: '0xTokenAddress',        // Token contract address
  to: '0xRecipientAddress',       // Recipient address  
  amount: 1000000n,               // Amount (in token's smallest unit)
  from: '0xUserPrivateKey'        // User's private key
})

console.log('✅ Transfer successful:', result.hash)
```

### Standard Usage

```typescript
import { Gasless } from 'gasless-core'

// Initialize SDK
const gasless = new Gasless({
  rpcUrl: 'https://rpc.mantle.xyz',
  chainId: 5000,
  relayerAddress: '0xYourDeployedGaslessRelayerAddress',
  relayerUrl: 'https://your-relayer-service.com',
  apiKey: 'your-api-key' // Optional
})

// Check token balance first
const balance = await gasless.getBalance(
  '0xTokenAddress',
  '0xUserAddress'
)
console.log('Balance:', balance)

// Get token information
const tokenInfo = await gasless.getTokenInfo('0xTokenAddress')
console.log('Token whitelisted:', tokenInfo.isWhitelisted)

// Estimate gas cost
const gasEstimate = await gasless.estimateGas({
  token: '0xTokenAddress',
  to: '0xRecipientAddress',
  amount: 1000000n,
  from: '0xUserPrivateKey'
})
console.log('Estimated gas:', gasEstimate)

// Execute transfer
const result = await gasless.transfer({
  token: '0xTokenAddress',
  to: '0xRecipientAddress', 
  amount: 1000000n,
  from: '0xUserPrivateKey'
})

console.log('Success:', result.success)
console.log('Transaction hash:', result.hash)
console.log('Gas used:', result.gasUsed)
```

### Direct Execution (Without Relayer Service)

If you want to execute directly without a relayer service:

```typescript
const gasless = new Gasless({
  rpcUrl: 'https://rpc.mantle.xyz',
  chainId: 5000,
  relayerAddress: '0xYourDeployedGaslessRelayerAddress',
  privateKey: '0xRelayerPrivateKey' // Your relayer's private key
})

const result = await gasless.transfer({
  token: '0xTokenAddress',
  to: '0xRecipientAddress',
  amount: 1000000n,
  from: '0xUserPrivateKey'
})
```

## Setup Requirements

### 1. Deploy GaslessRelayer Contract

First, deploy the included `GaslessRelayer.sol` contract:

```solidity
// Deploy with these parameters:
constructor(
    address _owner,           // Your owner address
    address _feeWallet,       // Address to receive fees
    uint256 _maxTransferAmount, // Maximum transfer amount
    uint256 _maxFeeAmount     // Maximum fee amount
)
```

### 2. Configure Your Contract

After deployment, configure your contract:

```solidity
// Whitelist tokens
gaslessRelayer.whitelistToken(tokenAddress, true)

// Set fee wallet
gaslessRelayer.setFeeWallet(feeWalletAddress)

// Set limits
gaslessRelayer.setMaxTransferAmount(maxAmount)
gaslessRelayer.setMaxFeeAmount(maxFee)
```

### 3. Set Up Relayer Service

You need a relayer service that:
- Accepts meta-transaction requests
- Validates signatures
- Submits transactions to the blockchain
- Returns transaction hashes

Example relayer endpoint: `POST /relay-transaction`

### 4. User Flow

1. **User signs** the transfer intent (EIP-712 signature)
2. **User signs** the permit for token approval (EIP-2612)
3. **SDK submits** both signatures to your relayer service
4. **Relayer executes** the transaction on-chain
5. **User receives** transaction confirmation

## API Reference

### Gasless Class

#### Constructor
```typescript
new Gasless(config: SimpleConfig)
```

#### Methods

##### `transfer(params: SimpleTransferParams): Promise<SimpleResult>`
Execute a gasless token transfer.

##### `getBalance(token: Address, account: Address): Promise<bigint>`
Get token balance for an account.

##### `getTokenInfo(token: Address): Promise<TokenInfo>`
Get token information including whitelist status.

##### `estimateGas(params: SimpleTransferParams): Promise<bigint>`
Estimate gas cost for a transfer.

##### `static quickTransfer(config: SimpleConfig, params: SimpleTransferParams): Promise<SimpleResult>`
Static method for one-line transfers.

### Types

#### SimpleConfig
```typescript
interface SimpleConfig {
  rpcUrl: string              // RPC endpoint
  chainId: number             // Chain ID (5000 for Mantle)
  relayerAddress: Address     // Your deployed GaslessRelayer contract
  privateKey?: Hex            // Relayer private key (for direct execution)
  relayerUrl?: string         // Relayer service URL
  apiKey?: string             // API key for relayer service
}
```

#### SimpleTransferParams
```typescript
interface SimpleTransferParams {
  token: Address              // Token contract address
  to: Address                 // Recipient address
  amount: bigint              // Amount in token's smallest unit
  from?: Hex                  // User's private key
}
```

#### SimpleResult
```typescript
interface SimpleResult {
  success: boolean            // Transfer success status
  hash: string                // Transaction hash
  gasUsed?: bigint           // Gas consumed
}
```

## Advanced Usage

### Using Original Advanced APIs

For advanced users who need more control:

```typescript
import { GaslessSDK, GaslessAASDK } from 'gasless-core'

// Use original GaslessSDK for full control
const sdk = new GaslessSDK(advancedConfig, publicClient)
sdk.setWalletClient(walletClient)
const result = await sdk.transferGasless(advancedParams)
```

### Error Handling

```typescript
try {
  const result = await gasless.transfer(params)
  console.log('Success:', result)
} catch (error) {
  if (error.message.includes('Token not whitelisted')) {
    console.log('❌ Token not supported')
  } else if (error.message.includes('Insufficient balance')) {
    console.log('❌ Not enough tokens')
  } else {
    console.log('❌ Transfer failed:', error.message)
  }
}
```

## Testing

### Example Test Setup

```typescript
// Test configuration
const testConfig = {
  rpcUrl: 'https://rpc.testnet.mantle.xyz', // Testnet
  chainId: 5001, // Mantle Testnet
  relayerAddress: '0xYourTestnetGaslessRelayerAddress',
  relayerUrl: 'https://your-test-relayer.com'
}

// Run test
const result = await Gasless.quickTransfer(testConfig, {
  token: '0xTestTokenAddress',
  to: '0xTestRecipientAddress',
  amount: 1000000n, // 1 USDC (6 decimals)
  from: '0xTestUserPrivateKey'
})

console.log('Test result:', result)
```

### Development Commands

```bash
npm run build        # Build the package
npm run test         # Run tests
npm run lint         # Run linter
npm run type-check   # TypeScript type checking
```

## Troubleshooting

### Common Issues

**❌ "Token not whitelisted"**
- Ensure your token is whitelisted in the GaslessRelayer contract
- Call `gaslessRelayer.whitelistToken(tokenAddress, true)`

**❌ "Insufficient balance"**
- User needs enough tokens for transfer + fee
- Check balance with `gasless.getBalance()`

**❌ "Invalid signature"**
- Check that private key corresponds to token owner
- Ensure nonce is correct

**❌ "Contract paused"**
- GaslessRelayer contract is paused
- Call `gaslessRelayer.unpause()` as owner

### Debug Mode

Enable detailed logging:

```typescript
// Check token whitelist status
const tokenInfo = await gasless.getTokenInfo(tokenAddress)
console.log('Token whitelisted:', tokenInfo.isWhitelisted)

// Check user nonce (for debugging)
import { GaslessSDK } from 'gasless-core'
const sdk = new GaslessSDK(config, publicClient)
const nonce = await sdk.getUserNonce(userAddress)
console.log('User nonce:', nonce)
```

## Requirements

- Node.js >= 16.0.0
- TypeScript >= 5.0.0
- Deployed GaslessRelayer smart contract
- Relayer service endpoint (or private key for direct execution)

## License

MIT

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/MrRaccxxn/gasless-sdk)
- Email: buildraccoon@gmail.com

---

**Ready to test?** Deploy your `GaslessRelayer.sol` contract, set up a simple relayer service, and start making gasless transfers! 🚀