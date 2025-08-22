import { GaslessSDK } from '../core/gasless-sdk'
import type { GaslessConfig } from '../types'

// Mock the contract calls
const mockPublicClient = {
  readContract: jest.fn(),
  simulateContract: jest.fn(),
  estimateContractGas: jest.fn(),
}

// Mock viem completely for integration tests
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn(() => mockPublicClient),
    createWalletClient: jest.fn(),
    http: jest.fn(() => 'mock-transport'),
    keccak256: jest.fn(
      () => '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'
    ),
    toHex: jest.fn(
      (str: string) => `0x${Buffer.from(str, 'utf8').toString('hex')}`
    ),
    encodeAbiParameters: jest.fn(() => '0x1234567890abcdef'),
  }
})

describe('Gasless SDK Integration Tests', () => {
  let sdk: GaslessSDK
  let mockWalletClient: any
  let config: GaslessConfig

  beforeEach(() => {
    jest.clearAllMocks()

    config = {
      chainPreset: 'mantle-sepolia',
    }

    mockWalletClient = {
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signTypedData: jest.fn(),
      signMessage: jest.fn(),
    }

    sdk = new GaslessSDK(config)
    sdk.setWalletClient(mockWalletClient)
  })

  describe('End-to-End Gasless Transfer Flow', () => {
    it('should prepare gasless transfer for backend service', async () => {
      // Mock all the required contract calls in sequence
      mockPublicClient.readContract
        .mockResolvedValueOnce(0n) // getUserNonce
        .mockResolvedValueOnce(0n) // getTokenNonce
        .mockResolvedValueOnce('USDC') // token name
        .mockResolvedValueOnce('USDC') // token symbol
        .mockResolvedValueOnce(6) // token decimals

      // Mock signatures
      mockWalletClient.signTypedData.mockResolvedValue(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      )
      mockWalletClient.signMessage.mockResolvedValue(
        '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      )

      // Mock fetch for backend service call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          hash: '0x1234567890abcdef',
          metaTxHash: '0x789abc1234567890',
        }),
      })

      // Execute transfer - should call backend service
      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        amount: 1000000n, // 1 USDC
        fee: 10000n, // 0.01 USDC fee
      }

      const result = await sdk.transferGasless(transferParams)

      // Verify result
      expect(result.success).toBe(true)
      expect(result.hash).toBeDefined()
      expect(result.metaTxHash).toBeDefined()

      // Verify all signatures were called
      expect(mockWalletClient.signTypedData).toHaveBeenCalledTimes(1)
      expect(mockWalletClient.signMessage).toHaveBeenCalledTimes(2) // permit + auth signature
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle token info retrieval and validation', async () => {
      const tokenAddress = '0x8ba1f109551bD432803012645Hac136c11DdF536'

      // Mock token contract calls
      mockPublicClient.readContract
        .mockResolvedValueOnce('USD Coin') // name
        .mockResolvedValueOnce('USDC') // symbol
        .mockResolvedValueOnce(6) // decimals
        .mockResolvedValueOnce(true) // isWhitelisted

      const tokenInfo = await sdk.getTokenInfo(tokenAddress)

      expect(tokenInfo).toEqual({
        address: tokenAddress,
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        isWhitelisted: true,
      })

      // Verify correct number of contract calls
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(4)
    })

    it('should validate contract limits before transfer', async () => {
      const maxTransfer = 1000000000n // 1000 USDC
      const maxFee = 100000000n // 100 USDC

      mockPublicClient.readContract
        .mockResolvedValueOnce(maxTransfer)
        .mockResolvedValueOnce(maxFee)

      const limits = await sdk.getContractLimits()

      expect(limits).toEqual({
        maxTransferAmount: maxTransfer,
        maxFeeAmount: maxFee,
      })

      // Test that transfer within limits would be allowed
      const validTransfer = {
        amount: 500000000n, // 500 USDC - within limit
        fee: 50000000n, // 50 USDC - within limit
      }

      expect(validTransfer.amount).toBeLessThanOrEqual(limits.maxTransferAmount)
      expect(validTransfer.fee).toBeLessThanOrEqual(limits.maxFeeAmount)
    })

    it('should check contract pause status before operations', async () => {
      mockPublicClient.readContract.mockResolvedValue(false)

      const isPaused = await sdk.isContractPaused()

      expect(isPaused).toBe(false)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        abi: expect.any(Array),
        functionName: 'paused',
      })
    })

    it('should handle failed contract calls gracefully', async () => {
      mockPublicClient.readContract.mockRejectedValue(
        new Error('Network error')
      )

      await expect(
        sdk.getUserNonce('0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b')
      ).rejects.toThrow('Failed to get user nonce: Network error')

      await expect(sdk.getContractLimits()).rejects.toThrow(
        'Failed to get contract limits: Network error'
      )

      await expect(sdk.isContractPaused()).rejects.toThrow(
        'Failed to check contract pause status: Network error'
      )
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle non-whitelisted token', async () => {
      const tokenAddress = '0x8ba1f109551bD432803012645Hac136c11DdF536'

      mockPublicClient.readContract
        .mockResolvedValueOnce('Fake Token')
        .mockResolvedValueOnce('FAKE')
        .mockResolvedValueOnce(18)
        .mockResolvedValueOnce(false) // not whitelisted

      const tokenInfo = await sdk.getTokenInfo(tokenAddress)

      expect(tokenInfo.isWhitelisted).toBe(false)

      // In a real implementation, the transfer should fail for non-whitelisted tokens
    })

    it('should handle wallet client not set', async () => {
      const sdkWithoutWallet = new GaslessSDK(config, mockPublicClient)

      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        amount: 1000000n,
      }

      await expect(
        sdkWithoutWallet.transferGasless(transferParams)
      ).rejects.toThrow('Wallet client not set or no account available')

      await expect(
        sdkWithoutWallet.estimateGas(transferParams)
      ).rejects.toThrow('Wallet client not set or no account available')
    })

    it('should handle backend service failure', async () => {
      // Mock successful setup calls
      mockPublicClient.readContract
        .mockResolvedValueOnce(0n) // getUserNonce
        .mockResolvedValueOnce(0n) // getTokenNonce
        .mockResolvedValueOnce('USDC') // token name
        .mockResolvedValueOnce('USDC') // token symbol
        .mockResolvedValueOnce(6) // token decimals

      mockWalletClient.signTypedData.mockResolvedValue(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      )
      mockWalletClient.signMessage.mockResolvedValue(
        '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      )

      // Mock backend service failure
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Insufficient balance'
        }),
      })

      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        amount: 1000000n,
      }

      await expect(sdk.transferGasless(transferParams)).rejects.toThrow(
        'Insufficient balance'
      )
    })
  })

  describe('Gas Estimation', () => {
    it('should return fixed gas estimate', async () => {
      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
        amount: 1000000n,
      }

      const estimatedGas = await sdk.estimateGas(transferParams)

      expect(estimatedGas).toBe(200000n)
    })
  })

  describe('Configuration Management', () => {
    it('should return config copy', () => {
      const returnedConfig = sdk.getConfig()

      expect(returnedConfig).toEqual({
        chainId: 5003,
        rpcUrl: 'https://rpc.sepolia.mantle.xyz',
        gaslessRelayerAddress: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        relayerServiceUrl: 'https://gasless-relayer-sepolia.mantle.com',
        environment: 'production'
      })
      expect(returnedConfig).not.toBe(config) // Should be a copy

      // Modifying returned config shouldn't affect original
      returnedConfig.chainId = 1
      expect(sdk.getConfig().chainId).toBe(5003)
    })

    it('should work with different chain configurations', () => {
      const polygonConfig: GaslessConfig = {
        chainId: 137,
        rpcUrl: 'https://polygon-rpc.com',
        gaslessRelayerAddress: '0x8ba1f109551bD432803012645Hac136c11DdF536',
      }

      const polygonSdk = new GaslessSDK(polygonConfig, mockPublicClient)

      expect(polygonSdk.getConfig().chainId).toBe(137)
      expect(polygonSdk.getConfig().rpcUrl).toBe('https://polygon-rpc.com')
    })
  })
})
