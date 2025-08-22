import { Gasless } from 'gasless-core'

// Test configuration for your GaslessRelayer contract
const testConfig = {
  rpcUrl: 'https://rpc.mantle.xyz', // or your test RPC
  chainId: 5000, // Mantle mainnet, or 5001 for testnet
  relayerAddress: '0xYourDeployedGaslessRelayerAddress' as const,
  relayerUrl: 'https://your-relayer-service.com', // Your relayer service endpoint
  // For direct execution without relayer service:
  // privateKey: '0xYourRelayerPrivateKey' as const
}

// Example 1: Simple USDC transfer
async function testUSDCTransfer() {
  const gasless = new Gasless(testConfig)
  
  try {
    const result = await gasless.transfer({
      token: '0xYourUSDCTokenAddress',
      to: '0xRecipientAddress',
      amount: 1000000n, // 1 USDC (6 decimals)
      from: '0xUserPrivateKey' // User's private key
    })
    
    console.log('✅ Transfer successful!')
    console.log('Transaction hash:', result.hash)
    console.log('Gas used:', result.gasUsed)
  } catch (error) {
    console.error('❌ Transfer failed:', error)
  }
}

// Example 2: Check if token is whitelisted before transfer
async function testWithValidation() {
  const gasless = new Gasless(testConfig)
  
  const tokenAddress = '0xYourTokenAddress'
  const userAddress = '0xUserAddress'
  
  try {
    // Check token info
    const tokenInfo = await gasless.getTokenInfo(tokenAddress)
    console.log('Token info:', tokenInfo)
    
    if (!tokenInfo.isWhitelisted) {
      console.log('❌ Token not whitelisted in GaslessRelayer contract')
      return
    }
    
    // Check balance
    const balance = await gasless.getBalance(tokenAddress, userAddress)
    console.log('User balance:', balance)
    
    // Estimate gas
    const gasEstimate = await gasless.estimateGas({
      token: tokenAddress,
      to: '0xRecipientAddress',
      amount: 100000n,
      from: '0xUserPrivateKey'
    })
    console.log('Estimated gas:', gasEstimate)
    
    // Execute transfer
    const result = await gasless.transfer({
      token: tokenAddress,
      to: '0xRecipientAddress',
      amount: 100000n,
      from: '0xUserPrivateKey'
    })
    
    console.log('✅ Transfer completed:', result)
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Example 3: One-line transfer for quick testing
async function quickTest() {
  try {
    const result = await Gasless.quickTransfer(testConfig, {
      token: '0xTokenAddress',
      to: '0xRecipientAddress', 
      amount: 1000000n,
      from: '0xUserPrivateKey'
    })
    
    console.log('✅ Quick transfer:', result)
  } catch (error) {
    console.error('❌ Quick transfer failed:', error)
  }
}

// Run tests
export {
  testUSDCTransfer,
  testWithValidation,
  quickTest
}

// For direct testing
if (require.main === module) {
  console.log('🧪 Testing GaslessRelayer with simplified SDK...')
  
  // Uncomment the test you want to run:
  // testUSDCTransfer()
  // testWithValidation()
  // quickTest()
}