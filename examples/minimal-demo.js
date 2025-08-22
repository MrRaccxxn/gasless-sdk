#!/usr/bin/env node

/**
 * Minimal working demo - bypasses complex signature logic
 * Uses the exact working parameters from your transaction
 */

const { createWalletClient, createPublicClient, http } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')

// Your exact working data
const WORKING_DATA = {
    metaTx: {
        owner: '0x3ea837526e43c828433fdde7a5a46d71b54e765b',
        token: '0x0a527504d9bc26189a51db8a7d6957d1c4275e05',
        recipient: '0x5a63721c458f41cd99499857c1fe4b17b2582bb7',
        amount: 1000000n,
        fee: 0n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // Fresh deadline
    },
    permitData: {
        value: 1000000n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // Fresh deadline
        v: 27,
        r: '0x3b95d9f1ce4fa3aa198c943b25dc04a1d67a434b6ce1525ec8d0eb1b7e0213d5',
        s: '0x72fc2357d34353c7c3835d29b3b709fbd414bd90fc99005c2e31997d57810f9d'
    },
    signature: '0x083300b3882ca6c8775738d7679fd70090867ebb35b5574763726b133c730c53654d3cd50febbc3473e06cbe07e08ae9f692c0e247ec0a636cceee8a3830f5b41c'
}

const ABI = [{
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
}]

async function executeMinimalDemo() {
    console.log('🚀 Minimal Gasless Demo')
    console.log('========================\n')

    try {
        // Use your relayer private key
        const relayerKey = process.env.RELAYER_PRIVATE_KEY
        if (!relayerKey) {
            throw new Error('Set RELAYER_PRIVATE_KEY environment variable')
        }

        const account = privateKeyToAccount(relayerKey)
        const client = createWalletClient({
            account,
            transport: http('https://rpc.sepolia.mantle.xyz'),
            chain: {
                id: 5003,
                name: 'Mantle Sepolia',
                network: 'mantle-sepolia',
                nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
                rpcUrls: { default: { http: ['https://rpc.sepolia.mantle.xyz'] } }
            }
        })

        console.log('📋 Transaction Data:')
        console.log('Contract:', '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9')
        console.log('MetaTx:', WORKING_DATA.metaTx)
        console.log('PermitData:', WORKING_DATA.permitData)
        console.log('Signature:', WORKING_DATA.signature)
        console.log('')

        console.log('⏳ Executing transaction...')

        const hash = await client.writeContract({
            address: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
            abi: ABI,
            functionName: 'executeMetaTransfer',
            args: [
                WORKING_DATA.metaTx,
                WORKING_DATA.permitData,
                WORKING_DATA.signature
            ]
        })

        console.log('✅ SUCCESS!')
        console.log('Transaction Hash:', hash)
        console.log(`View on explorer: https://sepolia-mantle.blockscout.io/tx/${hash}`)

    } catch (error) {
        console.error('❌ FAILED:', error.message)
        
        // If it's a revert with data, try to decode
        if (error.data) {
            console.log('Revert data:', error.data)
        }
    }
}

// Run if called directly
if (require.main === module) {
    executeMinimalDemo()
}

module.exports = { executeMinimalDemo, WORKING_DATA, ABI }