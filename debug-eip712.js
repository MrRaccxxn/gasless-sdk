#!/usr/bin/env node

/**
 * Auto-fix EIP-712 implementation by iteratively testing different approaches
 */

import { keccak256, encodePacked, encodeAbiParameters, recoverAddress, toHex } from 'viem'
import fs from 'fs'
import { execSync } from 'child_process'

// Test data from the failing case
const TEST_DATA = {
  owner: '0x3Ea837526E43C828433FDde7a5A46D71B54E765b',
  token: '0x0A527504d9Bc26189A51DB8a7D6957D1C4275e05',
  recipient: '0x5a63721c458f41cD99499857c1Fe4B17B2582bB7',
  amount: 1000000n,
  fee: 0n,
  deadline: 1755890553n,
  nonce: 0n,
  chainId: 5003,
  contractAddress: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9'
}

// Target hash from contract
const TARGET_HASH = '0x86498a8b53087e9a8ab3964505100d38beaa09a0d90c67b5179e559e8d54e633'
const SIGNATURE = '0xda68b5e1dce348198bfee972af8542457cca7b6990f697ad66923435867de3ee1aaa7be37165da1c0ab0524ec359b19520b7209de92d358494a89bd8058d2fdf1c'

console.log('🔧 Auto-fix EIP-712 Implementation')
console.log('=================================\n')

// Different type hash encoding approaches to try
const TYPE_HASH_VARIANTS = [
  {
    name: "toHex encoding (current SDK)",
    encode: (str) => keccak256(toHex(str))
  },
  {
    name: "encodePacked encoding (test script)", 
    encode: (str) => keccak256(encodePacked(['string'], [str]))
  },
  {
    name: "Direct string bytes",
    encode: (str) => keccak256(`0x${Buffer.from(str, 'utf8').toString('hex')}`)
  }
]

// Different domain separator approaches
const DOMAIN_VARIANTS = [
  {
    name: "Current SDK approach",
    compute: () => {
      const domainTypeHash = keccak256(toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'))
      return keccak256(encodeAbiParameters(
        [
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'uint256' },
          { type: 'address' },
        ],
        [
          domainTypeHash,
          keccak256(toHex('GaslessRelayer')),
          keccak256(toHex('1')),
          BigInt(TEST_DATA.chainId),
          TEST_DATA.contractAddress,
        ]
      ))
    }
  },
  {
    name: "encodePacked approach",
    compute: () => {
      const domainTypeHash = keccak256(encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)']))
      return keccak256(encodeAbiParameters(
        [
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'uint256' },
          { type: 'address' },
        ],
        [
          domainTypeHash,
          keccak256(encodePacked(['string'], ['GaslessRelayer'])),
          keccak256(encodePacked(['string'], ['1'])),
          BigInt(TEST_DATA.chainId),
          TEST_DATA.contractAddress,
        ]
      ))
    }
  }
]

async function testVariant(typeHashVariant, domainVariant) {
  const typeString = 'MetaTransfer(address owner,address token,address recipient,uint256 amount,uint256 fee,uint256 deadline,uint256 nonce)'
  
  // Compute type hash
  const typeHash = typeHashVariant.encode(typeString)
  
  // Compute struct hash  
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [
        typeHash,
        TEST_DATA.owner,
        TEST_DATA.token,
        TEST_DATA.recipient,
        TEST_DATA.amount,
        TEST_DATA.fee,
        TEST_DATA.deadline,
        TEST_DATA.nonce,
      ]
    )
  )
  
  // Compute domain separator
  const domainSeparator = domainVariant.compute()
  
  // Compute final hash
  const finalHash = keccak256(
    encodePacked(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      ['0x19', '0x01', domainSeparator, structHash]
    )
  )
  
  return {
    typeHash,
    structHash,
    domainSeparator,
    finalHash,
    matches: finalHash === TARGET_HASH
  }
}

async function runAllTests() {
  console.log('🧪 Testing all combinations...\n')
  
  let foundSolution = null
  let signatureMatches = []
  
  for (const typeHashVariant of TYPE_HASH_VARIANTS) {
    for (const domainVariant of DOMAIN_VARIANTS) {
      console.log(`📋 Testing: ${typeHashVariant.name} + ${domainVariant.name}`)
      
      try {
        const result = await testVariant(typeHashVariant, domainVariant)
        
        // Test signature recovery with our computed hash
        const recoveredWithOurHash = await recoverAddress({
          hash: result.finalHash,
          signature: SIGNATURE,
        })
        const sigMatches = recoveredWithOurHash.toLowerCase() === TEST_DATA.owner.toLowerCase()
        
        console.log(`   Type Hash: ${result.typeHash}`)
        console.log(`   Domain Sep: ${result.domainSeparator}`)
        console.log(`   Final Hash: ${result.finalHash}`)
        console.log(`   Target:     ${TARGET_HASH}`)
        console.log(`   Hash Match: ${result.matches ? '✅' : '❌'}`)
        console.log(`   Sig Recovers to: ${recoveredWithOurHash}`)
        console.log(`   Sig Match: ${sigMatches ? '✅' : '❌'}`)
        
        if (result.matches) {
          foundSolution = {
            typeHashApproach: typeHashVariant,
            domainApproach: domainVariant,
            result
          }
          console.log('   🎉 HASH SOLUTION FOUND!')
        }
        
        if (sigMatches) {
          signatureMatches.push({
            typeHashApproach: typeHashVariant,
            domainApproach: domainVariant,
            result,
            recoveredSigner: recoveredWithOurHash
          })
          console.log('   🔑 SIGNATURE SOLUTION FOUND!')
        }
        
        console.log('')
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`)
        console.log('')
      }
    }
  }
  
  if (!foundSolution && signatureMatches.length > 0) {
    console.log('🔍 No exact hash match found, but found signature matches:')
    signatureMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match.typeHashApproach.name} + ${match.domainApproach.name}`)
      console.log(`      Hash: ${match.result.finalHash}`)
      console.log(`      Recovers to: ${match.recoveredSigner}`)
    })
    console.log('')
    
    // Use the first signature match as our solution
    foundSolution = signatureMatches[0]
    console.log('📝 Using first signature match as the correct implementation.')
  }
  
  return foundSolution
}

async function updateSDKCode(solution) {
  console.log('🔧 Updating SDK code...\n')
  
  // Read current EIP-712 implementation
  const eip712Path = '/Users/mapache/Documents/labrat/gasless/gasless-sdk/src/eip712/index.ts'
  let content = fs.readFileSync(eip712Path, 'utf8')
  
  // Determine what changes are needed based on solution
  if (solution.typeHashApproach.name.includes('encodePacked')) {
    console.log('📝 Updating type hash encoding to use encodePacked...')
    
    // Replace toHex with encodePacked for type hashes
    content = content.replace(
      'import { type Hex, encodeAbiParameters, keccak256, toHex } from \'viem\'',
      'import { type Hex, encodeAbiParameters, encodePacked, keccak256, toHex } from \'viem\''
    )
    
    content = content.replace(
      'keccak256(\n  toHex(\n    \'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)\'\n  )\n)',
      'keccak256(\n  encodePacked([\'string\'], [\'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)\'])\n)'
    )
    
    content = content.replace(
      'keccak256(\n  toHex(\n    \'MetaTransfer(address owner,address token,address recipient,uint256 amount,uint256 fee,uint256 deadline,uint256 nonce)\'\n  )\n)',
      'keccak256(\n  encodePacked([\'string\'], [\'MetaTransfer(address owner,address token,address recipient,uint256 amount,uint256 fee,uint256 deadline,uint256 nonce)\'])\n)'
    )
    
    if (solution.domainApproach.name.includes('encodePacked')) {
      console.log('📝 Updating domain separator to use encodePacked...')
      content = content.replace(
        'keccak256(toHex(domain.name))',
        'keccak256(encodePacked([\'string\'], [domain.name]))'
      )
      content = content.replace(
        'keccak256(toHex(domain.version))',
        'keccak256(encodePacked([\'string\'], [domain.version]))'
      )
    }
  }
  
  // Write updated file
  fs.writeFileSync(eip712Path, content)
  console.log('✅ Updated EIP-712 implementation')
}

async function runTests() {
  console.log('🧪 Running tests to verify fix...\n')
  
  try {
    execSync('npm test src/eip712/__tests__/index.test.ts', { stdio: 'inherit' })
    console.log('✅ EIP-712 tests passed!')
    return true
  } catch (error) {
    console.log('❌ EIP-712 tests failed')
    return false
  }
}

async function main() {
  try {
    // First verify signature recovery with target hash
    console.log('🔍 Verifying signature with target hash...')
    const recoveredSigner = await recoverAddress({
      hash: TARGET_HASH,
      signature: SIGNATURE,
    })
    console.log(`   Recovered: ${recoveredSigner}`)
    console.log(`   Expected:  ${TEST_DATA.owner}`)
    console.log(`   Valid: ${recoveredSigner.toLowerCase() === TEST_DATA.owner.toLowerCase()}`)
    console.log('')
    
    if (recoveredSigner.toLowerCase() !== TEST_DATA.owner.toLowerCase()) {
      console.log('⚠️  Target hash does not recover to expected signer!')
      console.log('   This means either the hash, signature, or expected signer is wrong.')
      console.log('   Let\'s continue to find what hash would work with this signature...')
      console.log('')
    }
    
    // Test all variants to find solution
    const solution = await runAllTests()
    
    if (!solution) {
      console.log('❌ No solution found! The issue may be more complex.')
      process.exit(1)
    }
    
    console.log('🎯 Solution Details:')
    console.log(`   Type Hash Approach: ${solution.typeHashApproach.name}`)
    console.log(`   Domain Approach: ${solution.domainApproach.name}`)
    console.log('')
    
    // Update SDK code
    await updateSDKCode(solution)
    
    // Run tests
    const testsPass = await runTests()
    
    if (testsPass) {
      console.log('🎉 SUCCESS! EIP-712 implementation fixed and tests pass.')
    } else {
      console.log('⚠️  Hash computation fixed but tests still failing. Manual review needed.')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()