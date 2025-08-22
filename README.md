# Gasless SDK

A secure TypeScript SDK for enabling gasless token transfers on Mantle using meta-transactions with MetaMask integration and backend relayer services.

## 🚀 Features

- ⛽ **Zero Gas Fees for Users**: Users transfer tokens without needing native tokens for gas
- 🦊 **MetaMask Integration**: Simple wallet connection with browser extension support
- 🔐 **Secure Architecture**: Private keys only handled in backend services, never client-side
- 🌍 **Environment Support**: Seamless local/development/staging/production configurations
- 🚫 **No API Keys Required**: Perfect for testing and development
- 📝 **TypeScript First**: Full type safety and excellent developer experience
- 🧪 **Thoroughly Tested**: Comprehensive test suite for both SDK and backend service

## 📦 Installation

```bash
npm install gasless-core
```

## ⚡ Quick Start

### 1. Set Up Backend Service

```bash
# Clone and set up the backend relayer service
cd examples/
npm install

# Set environment variable
export MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY=0x...

# Start the service
npm start
```

### 2. Frontend Integration

```typescript
import { GaslessSDK } from 'gasless-core'

// Initialize SDK (no API keys needed!)
const gasless = new GaslessSDK({
  chainPreset: 'mantle-sepolia',
  environment: 'local'  // Points to localhost:3001
})

// Connect user's MetaMask wallet
const userAddress = await gasless.connectWallet()
console.log('Connected:', userAddress)

// Execute gasless transfer
const result = await gasless.transfer({
  to: '0xRecipientAddress',
  amount: 1000000n,  // 1 USDC (6 decimals)
  token: '0xTokenAddress'
})

console.log('✅ Transfer completed:', result.hash)
console.log('🎉 User paid zero gas fees!')
```

## 🏗️ Complete Setup Guide

### 1. Backend Service Deployment

Deploy the secure backend relayer service:

```bash
# 1. Navigate to examples directory
cd examples/

# 2. Install dependencies
npm install

# 3. Set up environment variables
export MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY=0x1234567890abcdef...

# 4. Test the service
npm run test:manual

# 5. Start the service
npm start
```

**Deployment Options:**
- **Local**: `npm start` (runs on localhost:3001)
- **Vercel**: Use provided `vercel.json` configuration
- **Railway**: Connect GitHub repo, set env vars, deploy
- **Docker**: `npm run docker:build && npm run docker:run`

### 2. Frontend Integration Options

#### Environment Configurations

```typescript
// Production
const gasless = new GaslessSDK({
  chainPreset: 'mantle-sepolia',
  environment: 'production'  // Uses live service
})

// Staging  
const gasless = new GaslessSDK({
  chainPreset: 'mantle-sepolia',
  environment: 'staging'
})

// Development
const gasless = new GaslessSDK({
  chainPreset: 'mantle-sepolia',
  environment: 'development'
})

// Local development
const gasless = new GaslessSDK({
  chainPreset: 'mantle-sepolia',
  environment: 'local'  // Uses localhost:3001
})

// Custom local URL
const gasless = new GaslessSDK({
  chainPreset: 'mantle-sepolia',
  environment: 'local',
  localRelayerUrl: 'http://localhost:8080'
})
```

### 3. How It Works

1. **User connects MetaMask** - No private keys needed from users
2. **User signs permit** - MetaMask popup for token approval signature
3. **SDK calls backend** - Secure transmission of signed data
4. **Backend executes** - Relayer pays gas and executes transaction
5. **User gets confirmation** - Transaction hash returned to user

**Zero gas fees for users, maximum security! 🔐**

## 📖 API Reference

### GaslessSDK Class

#### Constructor
```typescript
new GaslessSDK(config: GaslessConfig)
```

#### Methods

##### `connectWallet(): Promise<Address>`
Connect to user's MetaMask wallet and return address.

##### `transfer(params: SimpleTransferParams): Promise<TransactionResult>`
Execute a gasless token transfer.

```typescript
const result = await gasless.transfer({
  to: '0xRecipientAddress',
  amount: 1000000n,
  token: '0xTokenAddress'
})
```

##### `getTokenInfo(token: Address): Promise<TokenInfo>`
Get token information including whitelist status.

##### `isTokenWhitelisted(token: Address): Promise<boolean>`
Check if a token is whitelisted for gasless transfers.

##### `getUserNonce(address: Address): Promise<bigint>`
Get the current nonce for a user address.

##### `estimateGas(params: GaslessTransferParams): Promise<bigint>`
Estimate gas cost for a transfer.

##### `helloWorld(): string`
Returns "Hello World from Gasless SDK! 🚀" for testing.

### Types

#### GaslessConfig
```typescript
interface GaslessConfig {
  chainPreset?: 'mantle-sepolia'     // Supported chain preset
  environment?: 'local' | 'development' | 'staging' | 'production'
  chainId?: number                   // Custom chain ID
  rpcUrl?: string                    // Custom RPC URL
  gaslessRelayerAddress?: Address    // Custom contract address
  relayerServiceUrl?: string         // Custom relayer service URL
  localRelayerUrl?: string           // Override local URL
}
```

#### SimpleTransferParams
```typescript
interface SimpleTransferParams {
  to: Address        // Recipient address
  amount: bigint     // Amount in token's smallest unit  
  token: Address     // Token contract address
}
```

#### TransactionResult
```typescript
interface TransactionResult {
  hash: Hash         // Transaction hash
  success: boolean   // Transfer success status
  gasUsed?: bigint   // Gas consumed (optional)
  metaTxHash?: Hex   // Meta-transaction hash (optional)
}
```

## 🔧 Advanced Usage

### React Integration Example

```typescript
import React, { useState } from 'react'
import { GaslessSDK } from 'gasless-core'

function GaslessTransfer() {
  const [gasless] = useState(() => new GaslessSDK({
    chainPreset: 'mantle-sepolia',
    environment: 'local'
  }))
  
  const [userAddress, setUserAddress] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)

  const connectWallet = async () => {
    try {
      const address = await gasless.connectWallet()
      setUserAddress(address)
      setIsConnected(true)
      console.log('Connected:', address)
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const transfer = async () => {
    try {
      const result = await gasless.transfer({
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n, // 1 USDC
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536'
      })
      
      console.log('✅ Transfer completed!', result.hash)
      alert(`Transfer successful! Hash: ${result.hash}`)
    } catch (error) {
      console.error('Transfer failed:', error)
      alert(`Transfer failed: ${error.message}`)
    }
  }

  return (
    <div>
      {!isConnected ? (
        <button onClick={connectWallet}>
          Connect MetaMask
        </button>
      ) : (
        <div>
          <p>Connected: {userAddress}</p>
          <button onClick={transfer}>
            Send 1 USDC (Gasless!)
          </button>
        </div>
      )}
    </div>
  )
}
```

### Error Handling

```typescript
try {
  const result = await gasless.transfer(params)
  console.log('Success:', result)
} catch (error) {
  if (error.message.includes('MetaMask')) {
    console.log('❌ Please install MetaMask')
  } else if (error.message.includes('Token not whitelisted')) {
    console.log('❌ Token not supported')
  } else if (error.message.includes('Insufficient balance')) {
    console.log('❌ Not enough tokens')
  } else if (error.message.includes('Relayer service')) {
    console.log('❌ Backend service error')
  } else {
    console.log('❌ Transfer failed:', error.message)
  }
}
```

### Advanced Configuration

```typescript
// Custom configuration for advanced users
const gasless = new GaslessSDK({
  chainId: 5003,
  rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  gaslessRelayerAddress: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
  relayerServiceUrl: 'https://my-custom-relayer.com',
  environment: 'production'
})
```

## 🧪 Testing

### SDK Tests

```bash
# Run SDK tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Backend Service Tests

```bash
# Navigate to examples directory
cd examples/

# Install test dependencies
npm install

# Run backend service tests
npm test

# Run manual connectivity tests
npm run test:manual

# Test with coverage
npm run test:coverage
```

### Development Commands

```bash
# SDK Development
npm run build        # Build the package
npm run test         # Run tests
npm run lint         # Run linter

# Backend Service Development
cd examples/
npm run dev          # Start with auto-reload
npm run test:watch   # Test in watch mode
npm run test:manual  # Manual endpoint testing
```

## 🔧 Troubleshooting

### Common Issues

**❌ "MetaMask not found"**
```bash
# Install MetaMask browser extension
# Refresh page and try again
```

**❌ "Wallet client not set"**
```typescript
// Always connect wallet first
const userAddress = await gasless.connectWallet()
// Then perform transfers
```

**❌ "Relayer service error"**
```bash
# Check if backend service is running
curl http://localhost:3001/health

# Or start the service
cd examples/
npm start
```

**❌ "Failed to get user nonce"**
```bash
# Check environment variables
echo $MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY

# Ensure relayer has MNT for gas
```

**❌ "Transaction validation failed"**
- Check token is whitelisted in contract
- Ensure user has sufficient token balance
- Verify relayer wallet has enough MNT for gas

### Debug Mode

Enable detailed logging:

```typescript
// Check token whitelist status
const tokenInfo = await gasless.getTokenInfo(tokenAddress)
console.log('Token whitelisted:', tokenInfo.isWhitelisted)

// Check user nonce
const nonce = await gasless.getUserNonce(userAddress)
console.log('User nonce:', nonce)

// Test backend connectivity
const response = await fetch('http://localhost:3001/health')
const health = await response.json()
console.log('Backend health:', health)
```

### Test Checklist

Before going live:

```bash
# ✅ 1. Backend service is running
npm run test:manual

# ✅ 2. SDK tests pass
npm test

# ✅ 3. Integration works
# Test the React example above

# ✅ 4. Error handling works
# Try transfers without MetaMask, etc.
```

## 📋 Requirements

- **Frontend**: Node.js >= 18.0.0, MetaMask browser extension
- **Backend**: Node.js >= 18.0.0, funded relayer wallet
- **Network**: Mantle Sepolia testnet access
- **Contract**: Deployed GaslessRelayer at `0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9`

## 🎯 Production Deployment

1. **Deploy Backend Service**:
   - Use Railway, Vercel, or AWS
   - Set `MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY`
   - Fund relayer wallet with MNT

2. **Update Frontend**:
   - Change `environment` to `'production'`
   - Update `relayerServiceUrl` if needed

3. **Monitor**:
   - Watch relayer wallet balance
   - Monitor backend service logs
   - Set up alerts for failed transactions

## 🚀 What's Next?

- ✅ **Working gasless transfers** with MetaMask integration
- ✅ **Secure architecture** with backend relayer services
- ✅ **No API keys required** for testing
- ✅ **Comprehensive testing** for both SDK and backend
- ✅ **Production-ready** deployment guides

**Start building gasless dApps today!** 🎉

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-repo/gasless-sdk)
- **Documentation**: Complete guides in `/examples/DEPLOYMENT.md`
- **Email**: Contact for enterprise support

---

**🎯 Ready to deploy?** Follow the setup guide above and start offering gasless transfers to your users!