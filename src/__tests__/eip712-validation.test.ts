/**
 * EIP-712 Signature Validation Test
 * 
 * This test validates the EIP-712 implementation using actual transaction data
 * to ensure hash computation and signature recovery work correctly.
 */

import { keccak256, encodePacked, encodeAbiParameters, recoverAddress } from 'viem'

// Use actual transaction data from the logs
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

// From the actual logs
const ACTUAL_SIGNATURE = '0xda68b5e1dce348198bfee972af8542457cca7b6990f697ad66923435867de3ee1aaa7be37165da1c0ab0524ec359b19520b7209de92d358494a89bd8058d2fdf1c'
const CONTRACT_HASH = '0x86498a8b53087e9a8ab3964505100d38beaa09a0d90c67b5179e559e8d54e633'

describe('EIP-712 Hash Verification', () => {
  describe('Signature Recovery Analysis', () => {
    it('should recover correct address from our computed hash', async () => {
      // Compute the hash exactly as the contract does
      
      // Contract's META_TRANSFER_TYPEHASH
      const typeString = 'MetaTransfer(address owner,address token,address recipient,uint256 amount,uint256 fee,uint256 deadline,uint256 nonce)'
      const typeHash = keccak256(encodePacked(['string'], [typeString]))
      
      // Contract's struct hash computation
      const structHash = keccak256(
        encodeAbiParameters(
          [
            { name: 'typeHash', type: 'bytes32' },
            { name: 'owner', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'fee', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
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
      
      // Domain separator (contract uses OpenZeppelin EIP712 base)
      const domainTypeHash = keccak256(
        encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'])
      )
      
      const domainSeparator = keccak256(
        encodeAbiParameters(
          [
            { name: 'typeHash', type: 'bytes32' },
            { name: 'nameHash', type: 'bytes32' },
            { name: 'versionHash', type: 'bytes32' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          [
            domainTypeHash,
            keccak256(encodePacked(['string'], ['GaslessRelayer'])),
            keccak256(encodePacked(['string'], ['1'])),
            BigInt(TEST_DATA.chainId),
            TEST_DATA.contractAddress,
          ]
        )
      )
      
      // Final hash using _hashTypedDataV4 (EIP-712 standard)
      const computedHash = keccak256(
        encodePacked(
          ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
          ['0x19', '0x01', domainSeparator, structHash]
        )
      )
      
      // Test signature recovery with our computed hash
      const recoveredFromOurHash = await recoverAddress({
        hash: computedHash,
        signature: ACTUAL_SIGNATURE,
      })
      
      // Our computed hash should recover to the correct address
      expect(recoveredFromOurHash.toLowerCase()).toBe(TEST_DATA.owner.toLowerCase())
      
      // Log the results for debugging
      console.log('✅ EIP-712 Implementation Validation:')
      console.log(`   Type String: ${typeString}`)
      console.log(`   Type Hash: ${typeHash}`)
      console.log(`   Domain Separator: ${domainSeparator}`)
      console.log(`   Our Computed Hash: ${computedHash}`)
      console.log(`   Signature: ${ACTUAL_SIGNATURE}`)
      console.log(`   Recovered Address: ${recoveredFromOurHash}`)
      console.log(`   Expected Address: ${TEST_DATA.owner}`)
      console.log(`   ✅ Signature validates correctly with our hash computation`)
    })

    it('should show that contract hash recovers to different address', async () => {
      // Test recovery from the "contract hash" that was provided
      const recoveredFromContractHash = await recoverAddress({
        hash: CONTRACT_HASH,
        signature: ACTUAL_SIGNATURE,
      })
      
      // The contract hash should NOT recover to our expected address
      expect(recoveredFromContractHash.toLowerCase()).not.toBe(TEST_DATA.owner.toLowerCase())
      
      // Log for debugging
      console.log('❌ Contract Hash Analysis:')
      console.log(`   Contract Hash: ${CONTRACT_HASH}`)
      console.log(`   Recovered Address: ${recoveredFromContractHash}`)
      console.log(`   Expected Address: ${TEST_DATA.owner}`)
      console.log(`   ❌ This proves the "contract hash" was not the actual hash for this signature`)
    })

    it('should validate EIP-712 components are computed correctly', () => {
      // Test individual components
      const typeString = 'MetaTransfer(address owner,address token,address recipient,uint256 amount,uint256 fee,uint256 deadline,uint256 nonce)'
      const typeHash = keccak256(encodePacked(['string'], [typeString]))
      
      // Verify type hash is consistent
      expect(typeHash).toBe('0x2c5e043cda75e691d3204a576f4535bafbee16f38ce9cad9c9271a000f9e8b16')
      
      // Domain separator computation
      const domainTypeHash = keccak256(
        encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'])
      )
      
      const domainSeparator = keccak256(
        encodeAbiParameters(
          [
            { name: 'typeHash', type: 'bytes32' },
            { name: 'nameHash', type: 'bytes32' },
            { name: 'versionHash', type: 'bytes32' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          [
            domainTypeHash,
            keccak256(encodePacked(['string'], ['GaslessRelayer'])),
            keccak256(encodePacked(['string'], ['1'])),
            BigInt(TEST_DATA.chainId),
            TEST_DATA.contractAddress,
          ]
        )
      )
      
      // Verify domain separator matches expected
      expect(domainSeparator).toBe('0x2d50d30a3dd01399c3ec161639403830e8b2666286290e85568a2c4c4797b3ef')
      
      console.log('✅ EIP-712 Components Validation:')
      console.log(`   Domain Type Hash: ${domainTypeHash}`)
      console.log(`   Meta Transfer Type Hash: ${typeHash}`)
      console.log(`   Domain Separator: ${domainSeparator}`)
      console.log(`   ✅ All components computed correctly`)
    })
  })

  describe('Test Data Analysis', () => {
    it('should log comprehensive test data for debugging', () => {
      console.log('📋 Test Data Used:')
      console.log(`   Owner: ${TEST_DATA.owner}`)
      console.log(`   Token: ${TEST_DATA.token}`)
      console.log(`   Recipient: ${TEST_DATA.recipient}`)
      console.log(`   Amount: ${TEST_DATA.amount}`)
      console.log(`   Fee: ${TEST_DATA.fee}`)
      console.log(`   Deadline: ${TEST_DATA.deadline}`)
      console.log(`   Nonce: ${TEST_DATA.nonce}`)
      console.log(`   Chain ID: ${TEST_DATA.chainId}`)
      console.log(`   Contract: ${TEST_DATA.contractAddress}`)
      console.log('')
      console.log('🔍 Signature Data:')
      console.log(`   Signature: ${ACTUAL_SIGNATURE}`)
      console.log(`   Contract Hash: ${CONTRACT_HASH}`)
      
      // Always pass - this is just for logging
      expect(true).toBe(true)
    })
  })
})