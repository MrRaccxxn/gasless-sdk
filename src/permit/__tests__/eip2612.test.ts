import { createWalletClient, http } from 'viem'
import { EIP2612Permit } from '../eip2612'
import type { PermitData } from '../../types'

describe('EIP2612Permit', () => {
  let permit: EIP2612Permit

  const mockTokenAddress = '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b' as const
  const mockTokenName = 'MockToken'
  const mockTokenVersion = '1'
  const mockChainId = 5000

  beforeEach(() => {
    permit = new EIP2612Permit(
      mockTokenAddress,
      mockTokenName,
      mockTokenVersion,
      mockChainId
    )
  })

  describe('constructor', () => {
    it('should initialize with correct domain', () => {
      const permitData: PermitData = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        value: 1000000000000000000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      const typedData = permit.getTypedData(permitData)

      expect(typedData.domain).toEqual({
        name: mockTokenName,
        version: mockTokenVersion,
        chainId: mockChainId,
        verifyingContract: mockTokenAddress,
      })
    })
  })

  describe('getTypedData', () => {
    it('should return correct typed data structure', () => {
      const permitData: PermitData = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        value: 1000000000000000000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      const typedData = permit.getTypedData(permitData)

      expect(typedData).toEqual({
        domain: {
          name: mockTokenName,
          version: mockTokenVersion,
          chainId: mockChainId,
          verifyingContract: mockTokenAddress,
        },
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: permitData,
      })
    })
  })

  describe('signPermit', () => {
    it('should throw not implemented error', async () => {
      const permitData: PermitData = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        value: 1000000000000000000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      const mockWalletClient = createWalletClient({
        transport: http('https://rpc.mantle.xyz'),
      })

      await expect(
        permit.signPermit(permitData, mockWalletClient)
      ).rejects.toThrow('Not implemented')
    })
  })

  describe('encodePermitCall', () => {
    it('should throw not implemented error', () => {
      const permitData: PermitData = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        value: 1000000000000000000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      const mockSignature = {
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const,
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const,
        deadline: permitData.deadline,
      }

      expect(() => permit.encodePermitCall(permitData, mockSignature)).toThrow(
        'Not implemented'
      )
    })
  })
})
