import { GaslessSDK } from '../gasless-sdk'
import type { GaslessConfig, GaslessTransferParams } from '../../types'

// Mock the contract calls
const mockPublicClient = {
  readContract: jest.fn(),
  simulateContract: jest.fn(),
  estimateContractGas: jest.fn(),
}

jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn(() => mockPublicClient),
    createWalletClient: jest.fn(() => ({
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signTypedData: jest.fn(),
      signMessage: jest.fn(),
    })),
    http: jest.fn(),
  }
})

const mockConfig: GaslessConfig = {
  chainPreset: 'mantle-sepolia',
}

describe('GaslessSDK', () => {
  let sdk: GaslessSDK
  let mockWalletClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockWalletClient = {
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signTypedData: jest.fn(),
      signMessage: jest.fn(),
    } as any

    sdk = new GaslessSDK(mockConfig)
  })

  describe('constructor', () => {
    it('should initialize with config and public client', () => {
      expect(sdk).toBeInstanceOf(GaslessSDK)
      expect(sdk.getConfig().chainId).toBe(5003)
    })
  })

  describe('setWalletClient', () => {
    it('should set wallet client', () => {
      expect(() => sdk.setWalletClient(mockWalletClient)).not.toThrow()
    })
  })

  describe('helloWorld', () => {
    it('should return hello world message', () => {
      expect(sdk.helloWorld()).toBe('Hello World from Gasless SDK! 🚀')
    })
  })

  describe('getConfig', () => {
    it('should return a copy of the resolved config', () => {
      const config = sdk.getConfig()
      expect(config).toEqual({
        chainId: 5003,
        rpcUrl: 'https://rpc.sepolia.mantle.xyz',
        gaslessRelayerAddress: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        relayerServiceUrl: 'https://gasless-relayer-sepolia.mantle.com',
        environment: 'production',
      })
      expect(config).not.toBe(mockConfig)
    })
  })

  describe('getUserNonce', () => {
    it('should return user nonce from contract', async () => {
      const expectedNonce = 5n
      mockPublicClient.readContract.mockResolvedValue(expectedNonce)

      const nonce = await sdk.getUserNonce(
        '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      )

      expect(nonce).toBe(expectedNonce)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        abi: expect.any(Array),
        functionName: 'getNonce',
        args: ['0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'],
      })
    })

    it('should throw error when contract call fails', async () => {
      mockPublicClient.readContract.mockRejectedValue(
        new Error('Contract error')
      )

      await expect(
        sdk.getUserNonce('0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b')
      ).rejects.toThrow('Failed to get user nonce: Contract error')
    })
  })

  describe('isTokenWhitelisted', () => {
    it('should return true for whitelisted token', async () => {
      mockPublicClient.readContract.mockResolvedValue(true)

      const isWhitelisted = await sdk.isTokenWhitelisted(
        '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      )

      expect(isWhitelisted).toBe(true)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        abi: expect.any(Array),
        functionName: 'isTokenWhitelisted',
        args: ['0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'],
      })
    })

    it('should return false for non-whitelisted token', async () => {
      mockPublicClient.readContract.mockResolvedValue(false)

      const isWhitelisted = await sdk.isTokenWhitelisted(
        '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      )

      expect(isWhitelisted).toBe(false)
    })
  })

  describe('getContractLimits', () => {
    it('should return contract limits', async () => {
      const maxTransfer = 1000000n
      const maxFee = 10000n

      mockPublicClient.readContract
        .mockResolvedValueOnce(maxTransfer)
        .mockResolvedValueOnce(maxFee)

      const limits = await sdk.getContractLimits()

      expect(limits).toEqual({
        maxTransferAmount: maxTransfer,
        maxFeeAmount: maxFee,
      })
    })
  })

  describe('isContractPaused', () => {
    it('should return pause status', async () => {
      mockPublicClient.readContract.mockResolvedValue(false)

      const isPaused = await sdk.isContractPaused()

      expect(isPaused).toBe(false)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        abi: expect.any(Array),
        functionName: 'paused',
      })
    })
  })

  describe('getTokenInfo', () => {
    it('should return token info with whitelist status', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce('Test Token')
        .mockResolvedValueOnce('TEST')
        .mockResolvedValueOnce(18)
        .mockResolvedValueOnce(true)

      const tokenInfo = await sdk.getTokenInfo(
        '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
      )

      expect(tokenInfo).toEqual({
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        isWhitelisted: true,
      })
    })
  })

  describe('estimateGas', () => {
    it('should return estimated gas', async () => {
      sdk.setWalletClient(mockWalletClient)

      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      const estimatedGas = await sdk.estimateGas(params)

      expect(estimatedGas).toBe(200000n)
    })

    it('should throw error when wallet client not set', async () => {
      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      await expect(sdk.estimateGas(params)).rejects.toThrow(
        'Wallet client not set or no account available'
      )
    })
  })

  describe('transferGasless', () => {
    beforeEach(() => {
      sdk.setWalletClient(mockWalletClient)
    })

    it('should throw error when wallet client not set', async () => {
      const sdkWithoutWallet = new GaslessSDK(mockConfig)

      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      await expect(sdkWithoutWallet.transferGasless(params)).rejects.toThrow(
        'Wallet client not set or no account available'
      )
    })

    it('should execute transfer via backend service', async () => {
      // Mock the required contract calls
      mockPublicClient.readContract
        .mockResolvedValueOnce(0n) // user nonce
        .mockResolvedValueOnce(0n) // token nonce
        .mockResolvedValueOnce('Test Token') // token name
        .mockResolvedValueOnce('TEST') // token symbol
        .mockResolvedValueOnce(18) // token decimals

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
          hash: '0x123456',
          metaTxHash: '0x789abc',
        }),
      })

      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      const result = await sdk.transferGasless(params)

      expect(result.success).toBe(true)
      expect(result.hash).toBe('0x123456')
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})
