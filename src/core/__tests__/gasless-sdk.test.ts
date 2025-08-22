import { GaslessSDK } from '../gasless-sdk'
import type { GaslessConfig, GaslessTransferParams } from '../../types'

// Mock the contract calls
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      readContract: jest.fn(),
      simulateContract: jest.fn(),
      estimateContractGas: jest.fn(),
    })),
    createWalletClient: jest.fn(() => ({
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signTypedData: jest.fn(),
      signMessage: jest.fn(),
    })),
  }
})

const mockConfig: GaslessConfig = {
  chainId: 5000,
  rpcUrl: 'https://rpc.mantle.xyz',
  gaslessRelayerAddress: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
}

describe('GaslessSDK', () => {
  let sdk: GaslessSDK
  let mockPublicClient: any
  let mockWalletClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockPublicClient = {
      readContract: jest.fn(),
      simulateContract: jest.fn(),
      estimateContractGas: jest.fn(),
    } as any

    mockWalletClient = {
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signTypedData: jest.fn(),
      signMessage: jest.fn(),
    } as any

    sdk = new GaslessSDK(mockConfig, mockPublicClient)
  })

  describe('constructor', () => {
    it('should initialize with config and public client', () => {
      expect(sdk).toBeInstanceOf(GaslessSDK)
      expect(sdk.getConfig()).toEqual(mockConfig)
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
    it('should return a copy of the config', () => {
      const config = sdk.getConfig()
      expect(config).toEqual(mockConfig)
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
        address: mockConfig.gaslessRelayerAddress,
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
        address: mockConfig.gaslessRelayerAddress,
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
        address: mockConfig.gaslessRelayerAddress,
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
      const sdkWithoutWallet = new GaslessSDK(mockConfig, mockPublicClient)

      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      await expect(sdkWithoutWallet.transferGasless(params)).rejects.toThrow(
        'Wallet client not set or no account available'
      )
    })

    it('should throw error when relayer service not implemented', async () => {
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

      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      await expect(sdk.transferGasless(params)).rejects.toThrow(
        'Either relayerPrivateKey or relayerServiceUrl must be provided'
      )
    })

    it('should execute transfer with relayer private key', async () => {
      const configWithKey: GaslessConfig = {
        ...mockConfig,
        relayerPrivateKey:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }

      const sdkWithKey = new GaslessSDK(configWithKey, mockPublicClient)
      sdkWithKey.setWalletClient(mockWalletClient)

      // Mock the required contract calls
      mockPublicClient.readContract
        .mockResolvedValueOnce(0n) // user nonce
        .mockResolvedValueOnce(0n) // token nonce
        .mockResolvedValueOnce('Test Token') // token name
        .mockResolvedValueOnce('TEST') // token symbol
        .mockResolvedValueOnce(18) // token decimals

      mockPublicClient.simulateContract.mockResolvedValue({
        result: undefined,
        request: {
          abi: [],
          address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
          functionName: 'executeMetaTransfer',
          args: [],
        },
      })

      mockWalletClient.signTypedData.mockResolvedValue(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
      )
      mockWalletClient.signMessage.mockResolvedValue(
        '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      )

      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        amount: 1000000n,
      }

      const result = await sdkWithKey.transferGasless(params)

      expect(result).toEqual({
        hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        success: true,
        metaTxHash:
          '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      })
    })
  })
})
