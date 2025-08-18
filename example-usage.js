// Example usage of gasless-sdk in a Node.js environment
// You can copy this code to test the SDK in your other package

import { GaslessSDK } from 'gasless-sdk'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

async function testGaslessSDK() {
  console.log('🚀 Testing Gasless SDK...')
  
  try {
    // Create a public client (you can use any RPC URL)
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http('https://eth.llamarpc.com'), // Free public RPC
    })

    // Configure the gasless SDK
    const config = {
      chainId: 1,
      rpcUrl: 'https://eth.llamarpc.com',
      relayerUrl: 'https://your-relayer.com',
      forwarderAddress: '0x1234567890123456789012345678901234567890',
    }

    // Initialize the SDK
    const sdk = new GaslessSDK(config, publicClient)
    
    // Test 1: Hello World
    console.log('✅ Test 1 - Hello World:')
    const helloMessage = sdk.helloWorld()
    console.log(helloMessage)
    
    // Test 2: Get config
    console.log('\\n✅ Test 2 - Get Config:')
    const retrievedConfig = sdk.getConfig()
    console.log('Config:', retrievedConfig)
    
    // Test 3: Mock gasless transfer
    console.log('\\n✅ Test 3 - Mock Gasless Transfer:')
    const transferParams = {
      token: '0xA0b86a33E6441E1063D8Bb9Afe3c8A1e67CD7C4d', // Example token address
      to: '0x742d35Cc6634C0532925a3b8D4c9db96C0F4E7d8',     // Example recipient
      amount: 1000000000000000000n, // 1 token (18 decimals)
      userAddress: '0x8ba1f109551bD432803012645Hac136c52DCfAd5', // Example user
    }
    
    const result = await sdk.transferGasless(transferParams)
    console.log('Transfer result:', result)
    
    console.log('\\n🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testGaslessSDK()