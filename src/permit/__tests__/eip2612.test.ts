import { type Address } from 'viem'
import {
  createPermitDomain,
  signPermit,
  getTokenNonce,
  getTokenInfo,
  PERMIT_TYPEHASH,
} from '../eip2612'
import type { EIP712Domain, EIP2612Permit } from '../../types'

// Mock viem functions
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    keccak256: jest.fn(
      () => '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'
    ),
    toHex: jest.fn(
      (str: string) => `0x${Buffer.from(str, 'utf8').toString('hex')}`
    ),
    encodeAbiParameters: jest.fn(() => '0x1234567890abcdef'),
  }
})

describe('EIP2612 Permit utilities', () => {
  const tokenAddress: Address = '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
  const chainId = 5000
  const tokenName = 'Test Token'
  const tokenVersion = '1'

  let mockPublicClient: any
  let mockWalletClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockPublicClient = {
      readContract: jest.fn(),
    } as any

    mockWalletClient = {
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signTypedData: jest.fn(),
    } as any
  })

  describe('createPermitDomain', () => {
    it('should create correct EIP712 domain', () => {
      const domain = createPermitDomain(
        tokenAddress,
        chainId,
        tokenName,
        tokenVersion
      )

      expect(domain).toEqual({
        name: tokenName,
        version: tokenVersion,
        chainId,
        verifyingContract: tokenAddress,
      })
    })

    it('should use default version when not provided', () => {
      const domain = createPermitDomain(tokenAddress, chainId, tokenName)

      expect(domain.version).toBe('1')
    })
  })

  describe('getTokenNonce', () => {
    it('should return token nonce for owner', async () => {
      const expectedNonce = 5n
      const ownerAddress: Address = '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'

      mockPublicClient.readContract.mockResolvedValue(expectedNonce)

      const nonce = await getTokenNonce(
        tokenAddress,
        ownerAddress,
        mockPublicClient
      )

      expect(nonce).toBe(expectedNonce)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: tokenAddress,
        abi: [
          {
            name: 'nonces',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'owner', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ],
        functionName: 'nonces',
        args: [ownerAddress],
      })
    })

    it('should throw error when contract call fails', async () => {
      mockPublicClient.readContract.mockRejectedValue(
        new Error('Contract error')
      )

      await expect(
        getTokenNonce(
          tokenAddress,
          '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
          mockPublicClient
        )
      ).rejects.toThrow('Failed to get token nonce: Contract error')
    })
  })

  describe('getTokenInfo', () => {
    it('should return token information', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce('Test Token')
        .mockResolvedValueOnce('TEST')
        .mockResolvedValueOnce(18)

      const tokenInfo = await getTokenInfo(tokenAddress, mockPublicClient)

      expect(tokenInfo).toEqual({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      })

      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(3)
    })

    it('should throw error when any contract call fails', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce('Test Token')
        .mockRejectedValueOnce(new Error('Symbol error'))

      await expect(
        getTokenInfo(tokenAddress, mockPublicClient)
      ).rejects.toThrow('Failed to get token info: Symbol error')
    })
  })

  describe('signPermit', () => {
    it('should sign permit and return PermitData', async () => {
      const domain: EIP712Domain = {
        name: tokenName,
        version: tokenVersion,
        chainId,
        verifyingContract: tokenAddress,
      }

      const permit: EIP2612Permit = {
        owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        value: 1000000n,
        nonce: 0n,
        deadline: 1704067200n,
      }

      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      mockWalletClient.signTypedData.mockResolvedValue(mockSignature)

      const result = await signPermit(mockWalletClient, domain, permit)

      expect(result).toEqual({
        value: permit.value,
        deadline: permit.deadline,
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })

      expect(mockWalletClient.signTypedData).toHaveBeenCalledWith({
        account: mockWalletClient.account,
        domain: {
          name: domain.name,
          version: domain.version,
          chainId: domain.chainId,
          verifyingContract: domain.verifyingContract,
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
        message: permit,
      })
    })

    it('should throw error when wallet client has no account', async () => {
      const walletWithoutAccount = {
        ...mockWalletClient,
        account: undefined,
      }

      const domain: EIP712Domain = {
        name: tokenName,
        version: tokenVersion,
        chainId,
        verifyingContract: tokenAddress,
      }

      const permit: EIP2612Permit = {
        owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        value: 1000000n,
        nonce: 0n,
        deadline: 1704067200n,
      }

      await expect(
        signPermit(walletWithoutAccount as any, domain, permit)
      ).rejects.toThrow('Wallet client must have an account')
    })
  })

  describe('PERMIT_TYPEHASH', () => {
    it('should have correct type hash', () => {
      expect(PERMIT_TYPEHASH).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })
  })

  describe('integration test', () => {
    it('should work end-to-end for permit signing', async () => {
      // Setup
      const ownerAddress: Address = '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      const spenderAddress: Address =
        '0x8ba1f109551bD432803012645Hac136c11DdF536'
      const value = 1000000n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

      // Mock token info calls
      mockPublicClient.readContract
        .mockResolvedValueOnce('Test Token') // name
        .mockResolvedValueOnce('TEST') // symbol
        .mockResolvedValueOnce(18) // decimals
        .mockResolvedValueOnce(0n) // nonce

      // Mock signing
      const mockSignature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      mockWalletClient.signTypedData.mockResolvedValue(mockSignature)

      // Get token info and nonce
      const tokenInfo = await getTokenInfo(tokenAddress, mockPublicClient)
      const nonce = await getTokenNonce(
        tokenAddress,
        ownerAddress,
        mockPublicClient
      )

      // Create domain and permit
      const domain = createPermitDomain(tokenAddress, chainId, tokenInfo.name)
      const permit: EIP2612Permit = {
        owner: ownerAddress,
        spender: spenderAddress,
        value,
        nonce,
        deadline,
      }

      // Sign permit
      const permitData = await signPermit(mockWalletClient, domain, permit)

      // Verify result
      expect(permitData).toEqual({
        value,
        deadline,
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })
    })
  })
})
