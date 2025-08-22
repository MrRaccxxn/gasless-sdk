require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { createWalletClient, createPublicClient, http } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')

const app = express()
app.use(cors())
app.use(express.json())

// Environment variables
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY
const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.mantle.xyz'
const CONTRACT_ADDRESS = process.env.GASLESS_CONTRACT_ADDRESS
const CHAIN_ID = parseInt(process.env.CHAIN_ID) || 5003

const config = {
  rpcUrl: RPC_URL,
  relayerKey: RELAYER_PRIVATE_KEY,
  gaslessContract: CONTRACT_ADDRESS,
  chainId: CHAIN_ID
}

// Gasless contract ABI - matches the actual contract
const GASLESS_ABI = [
  {
    name: 'executeMetaTransfer',
    type: 'function',
    inputs: [
      {
        name: 'metaTx',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'fee', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      },
      {
        name: 'permitData',
        type: 'tuple',
        components: [
          { name: 'value', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' }
        ]
      },
      { name: 'signature', type: 'bytes' }
    ],
    outputs: []
  }
]

// Main endpoint: Execute gasless transaction
app.post('/relay-transaction', async (req, res) => {
  try {
    const { metaTx, permitData, signature } = req.body

    // Validate input
    if (!metaTx || !permitData || !signature) {
      return res.status(400).json({ 
        error: 'Missing required fields: metaTx, permitData, signature' 
      })
    }

    // Validate configuration
    if (!config.relayerKey || !config.gaslessContract) {
      return res.status(500).json({ error: 'Relayer not configured properly' })
    }

    console.log(`Processing gasless transfer to ${metaTx.recipient}, amount: ${metaTx.amount}`)

    // Create clients first
    const publicClient = createPublicClient({
      transport: http(config.rpcUrl),
      chain: {
        id: config.chainId,
        name: 'Mantle Sepolia',
        network: 'mantle-sepolia',
        nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
        rpcUrls: { default: { http: [config.rpcUrl] } }
      }
    })

    // Debug signature validation
    console.log('=== SIGNATURE VALIDATION DEBUG ===')
    console.log('MetaTransfer signature:', signature)
    console.log('Permit signature components:', {
      v: permitData.v,
      r: permitData.r,
      s: permitData.s
    })

    // Check if user has USDC balance
    try {
      const balance = await publicClient.readContract({
        address: metaTx.token,
        abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
        functionName: 'balanceOf',
        args: [metaTx.owner]
      })
      console.log(`User USDC balance: ${balance}, trying to transfer: ${metaTx.amount}`)
      
      // Check current nonce vs expected nonce
      const currentNonce = await publicClient.readContract({
        address: config.gaslessContract,
        abi: [{ name: 'getNonce', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
        functionName: 'getNonce',
        args: [metaTx.owner]
      })
      console.log(`Contract nonce for user: ${currentNonce}, MetaTx nonce: ${metaTx.nonce}`)
      
      // Check token permit nonce
      const tokenNonce = await publicClient.readContract({
        address: metaTx.token,
        abi: [{ name: 'nonces', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
        functionName: 'nonces',
        args: [metaTx.owner]
      })
      console.log(`Token permit nonce for user: ${tokenNonce}`)
      
      // Check token EIP-712 domain  
      try {
        const [domainSeparator, tokenName, tokenSymbol] = await Promise.all([
          publicClient.readContract({
            address: metaTx.token,
            abi: [{ name: 'DOMAIN_SEPARATOR', type: 'function', inputs: [], outputs: [{ name: '', type: 'bytes32' }] }],
            functionName: 'DOMAIN_SEPARATOR'
          }),
          publicClient.readContract({
            address: metaTx.token,
            abi: [{ name: 'name', type: 'function', inputs: [], outputs: [{ name: '', type: 'string' }] }],
            functionName: 'name'
          }),
          publicClient.readContract({
            address: metaTx.token,
            abi: [{ name: 'symbol', type: 'function', inputs: [], outputs: [{ name: '', type: 'string' }] }],
            functionName: 'symbol'
          })
        ])
        console.log(`Token DOMAIN_SEPARATOR: ${domainSeparator}`)
        console.log(`Token name: "${tokenName}", symbol: "${tokenSymbol}"`)
        
        // Check if token is whitelisted
        const isWhitelisted = await publicClient.readContract({
          address: config.gaslessContract,
          abi: [{ name: 'isTokenWhitelisted', type: 'function', inputs: [{ name: 'token', type: 'address' }], outputs: [{ name: '', type: 'bool' }] }],
          functionName: 'isTokenWhitelisted',
          args: [metaTx.token]
        })
        console.log(`Token whitelisted: ${isWhitelisted}`)
        
        // Check if contract is paused
        const isPaused = await publicClient.readContract({
          address: config.gaslessContract,
          abi: [{ name: 'paused', type: 'function', inputs: [], outputs: [{ name: '', type: 'bool' }] }],
          functionName: 'paused'
        })
        console.log(`Contract paused: ${isPaused}`)
        
        // Check max transfer amount
        const maxTransfer = await publicClient.readContract({
          address: config.gaslessContract,
          abi: [{ name: 'maxTransferAmount', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'maxTransferAmount'
        })
        console.log(`Max transfer amount: ${maxTransfer}, trying to transfer: ${metaTx.amount}`)
        
        // Check max fee amount
        const maxFee = await publicClient.readContract({
          address: config.gaslessContract,
          abi: [{ name: 'maxFeeAmount', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'maxFeeAmount'
        })
        console.log(`Max fee amount: ${maxFee}, trying fee: ${metaTx.fee}`)
        
        // Check deadline expiry
        const currentTimestamp = Math.floor(Date.now() / 1000)
        console.log(`Current timestamp: ${currentTimestamp}, Deadline: ${metaTx.deadline}`)
        console.log(`Deadline expired: ${currentTimestamp > parseInt(metaTx.deadline)}`)
        
        // Try to test permit signature directly on token contract
        try {
          console.log('Testing permit signature directly on token...')
          await publicClient.simulateContract({
            address: metaTx.token,
            abi: [{
              name: 'permit',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
                { name: 'v', type: 'uint8' },
                { name: 'r', type: 'bytes32' },
                { name: 's', type: 'bytes32' }
              ],
              outputs: []
            }],
            functionName: 'permit',
            args: [
              metaTx.owner,
              config.gaslessContract, // spender should be the gasless contract
              BigInt(permitData.value),
              BigInt(permitData.deadline),
              permitData.v,
              permitData.r,
              permitData.s
            ]
          })
          console.log('✅ Permit signature is VALID')
        } catch (permitError) {
          console.log('❌ Permit signature is INVALID:', permitError.message)
          
          // Also check what the gasless contract is expecting
          console.log('Debug: Permit parameters being passed to gasless contract:')
          console.log('  owner:', metaTx.owner)
          console.log('  spender:', config.gaslessContract)
          console.log('  value:', permitData.value)
          console.log('  deadline:', permitData.deadline)
          console.log('  v:', permitData.v)
          console.log('  r:', permitData.r)
          console.log('  s:', permitData.s)
        }
        
      } catch (error) {
        console.log('Could not get token EIP-712 domain:', error.message)
      }
      
    } catch (error) {
      console.log('Could not check balance/nonce:', error.message)
    }

    // Check if we can get the message hash from the contract
    try {
      const messageHash = await publicClient.readContract({
        address: config.gaslessContract,
        abi: [{
          name: 'getMessageHash',
          type: 'function',
          inputs: [{
            name: 'metaTx',
            type: 'tuple',
            components: [
              { name: 'owner', type: 'address' },
              { name: 'token', type: 'address' },
              { name: 'recipient', type: 'address' },
              { name: 'amount', type: 'uint256' },
              { name: 'fee', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' }
            ]
          }],
          outputs: [{ name: '', type: 'bytes32' }]
        }],
        functionName: 'getMessageHash',
        args: [{
          owner: metaTx.owner,
          token: metaTx.token,
          recipient: metaTx.recipient,
          amount: BigInt(metaTx.amount),
          fee: BigInt(metaTx.fee),
          nonce: BigInt(metaTx.nonce),
          deadline: BigInt(metaTx.deadline)
        }]
      })
      console.log('Contract computed message hash:', messageHash)
      
      // Get the actual gasless contract's EIP-712 domain
      const gaslessEip712Domain = await publicClient.readContract({
        address: config.gaslessContract,
        abi: [{
          name: 'eip712Domain',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [
            { name: 'fields', type: 'bytes1' },
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
            { name: 'salt', type: 'bytes32' },
            { name: 'extensions', type: 'uint256[]' }
          ]
        }],
        functionName: 'eip712Domain'
      })
      console.log('Gasless contract EIP-712 domain:', {
        name: gaslessEip712Domain[1],
        version: gaslessEip712Domain[2],
        chainId: gaslessEip712Domain[3].toString(),
        verifyingContract: gaslessEip712Domain[4]
      })
      
      // Also get the domain separator
      const gaslessDomainSeparator = await publicClient.readContract({
        address: config.gaslessContract,
        abi: [{
          name: 'getDomainSeparator',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'bytes32' }]
        }],
        functionName: 'getDomainSeparator'
      })
      console.log('Gasless contract DOMAIN_SEPARATOR:', gaslessDomainSeparator)
      
      // Test signature recovery locally to see what address it recovers to
      try {
        const { recoverAddress } = require('viem')
        const recoveredAddress = await recoverAddress({
          hash: messageHash,
          signature: signature
        })
        console.log(`🔍 Signature recovers to: ${recoveredAddress}`)
        console.log(`🔍 Expected address: ${metaTx.owner}`)
        console.log(`🔍 Addresses match: ${recoveredAddress.toLowerCase() === metaTx.owner.toLowerCase()}`)
        
      } catch (recoveryError) {
        console.log('Could not recover signature locally:', recoveryError.message)
      }
      
    } catch (error) {
      console.log('Could not get message hash from contract:', error.message)
    }

    // Create clients
    const relayerAccount = privateKeyToAccount(config.relayerKey)
    const walletClient = createWalletClient({
      account: relayerAccount,
      transport: http(config.rpcUrl),
      chain: {
        id: config.chainId,
        name: 'Mantle Sepolia',
        network: 'mantle-sepolia',
        nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
        rpcUrls: { default: { http: [config.rpcUrl] } }
      }
    })

    // Convert string values to BigInt for contract call
    console.log('🔍 BACKEND Debug - RECEIVED FROM SDK:', {
      receivedMetaTx: metaTx,
      receivedTypes: {
        amount: typeof metaTx.amount,
        fee: typeof metaTx.fee,
        deadline: typeof metaTx.deadline,
        nonce: typeof metaTx.nonce,
      }
    })

    const metaTxForContract = {
      owner: metaTx.owner,
      token: metaTx.token,
      recipient: metaTx.recipient,
      amount: BigInt(metaTx.amount),
      fee: BigInt(metaTx.fee),
      deadline: BigInt(metaTx.deadline),
      nonce: BigInt(metaTx.nonce)
    }

    console.log('🔍 BACKEND Debug - CONVERTED FOR CONTRACT:', {
      metaTxForContract,
      conversions: {
        amount: `"${metaTx.amount}" -> ${BigInt(metaTx.amount)}`,
        fee: `"${metaTx.fee}" -> ${BigInt(metaTx.fee)}`,
        deadline: `"${metaTx.deadline}" -> ${BigInt(metaTx.deadline)}`,
        nonce: `"${metaTx.nonce}" -> ${BigInt(metaTx.nonce)}`,
      }
    })

    const permitDataForContract = {
      value: BigInt(permitData.value),
      deadline: BigInt(permitData.deadline),
      v: permitData.v,
      r: permitData.r,
      s: permitData.s
    }

    // Execute the transaction
    const hash = await walletClient.writeContract({
      address: config.gaslessContract,
      abi: GASLESS_ABI,
      functionName: 'executeMetaTransfer',
      args: [metaTxForContract, permitDataForContract, signature]
    })

    console.log(`Transaction executed: ${hash}`)

    res.json({
      success: true,
      hash
    })

  } catch (error) {
    console.error('Relayer error:', error)
    res.status(500).json({ 
      error: `Transaction failed: ${error.message}` 
    })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    chainId: config.chainId
  })
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log('Gasless Relayer Service running on port', PORT)
  console.log('Chain ID:', config.chainId)
  console.log('Contract:', config.gaslessContract || 'Not set')
  console.log('Relayer Key:', config.relayerKey ? 'Set' : 'Missing')
})

module.exports = app