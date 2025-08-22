import { GaslessAASDK } from '../gasless-aa-sdk'
import { SmartAccount } from '../smart-account'
import { BundlerClient } from '../bundler-client'
import { PaymasterClient } from '../paymaster-client'
import type { AAGaslessConfig, AATransferParams } from '../types'

// Mock viem
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    encodeFunctionData: jest.fn(() => '0x1234567890abcdef'),
    erc20Abi: [
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  }
})

// Mock dependencies
jest.mock('../smart-account')
jest.mock('../bundler-client')
jest.mock('../paymaster-client')
jest.mock('../../permit/eip2612')

describe('GaslessAASDK', () => {
  let sdk: GaslessAASDK
  let mockPublicClient: any
  let mockWalletClient: any
  let config: AAGaslessConfig

  const MockedSmartAccount = SmartAccount as jest.MockedClass<
    typeof SmartAccount
  >
  const MockedBundlerClient = BundlerClient as jest.MockedClass<
    typeof BundlerClient
  >
  const MockedPaymasterClient = PaymasterClient as jest.MockedClass<
    typeof PaymasterClient
  >

  beforeEach(() => {
    jest.clearAllMocks()

    config = {
      chainId: 5000,
      rpcUrl: 'https://rpc.mantle.xyz',
      bundlerUrl: 'https://api.pimlico.io/v2/mantle/rpc?apikey=test',
      paymasterUrl: 'https://api.pimlico.io/v2/mantle/rpc?apikey=test',
      apiKey: 'test-api-key',
    }

    mockPublicClient = {
      readContract: jest.fn(),
      getGasPrice: jest.fn().mockResolvedValue(20000000000n),
      getBytecode: jest.fn().mockResolvedValue('0x1234'),
      chain: { id: 5000 },
    } as any

    mockWalletClient = {
      account: {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      },
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
    } as any

    sdk = new GaslessAASDK(config, mockPublicClient)
    sdk.setWalletClient(mockWalletClient)
  })

  describe('constructor', () => {
    it('should initialize with correct config', () => {
      expect(sdk).toBeInstanceOf(GaslessAASDK)
      expect(MockedSmartAccount).toHaveBeenCalledWith(
        mockPublicClient,
        expect.any(String), // factory address
        expect.any(String) // entry point address
      )
      expect(MockedBundlerClient).toHaveBeenCalledWith(
        config.bundlerUrl,
        config.apiKey
      )
      expect(MockedPaymasterClient).toHaveBeenCalledWith(
        config.paymasterUrl,
        config.apiKey
      )
    })

    it('should use default addresses when not provided', () => {
      const minimalConfig = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        bundlerUrl: 'https://api.pimlico.io/v2/mantle/rpc?apikey=test',
        paymasterUrl: 'https://api.pimlico.io/v2/mantle/rpc?apikey=test',
        apiKey: 'test-api-key',
      }

      const newSdk = new GaslessAASDK(minimalConfig, mockPublicClient)
      const returnedConfig = newSdk.getConfig()

      expect(returnedConfig.entryPointAddress).toBeDefined()
      expect(returnedConfig.factoryAddress).toBeDefined()
    })
  })

  describe('getSmartAccountInfo', () => {
    it('should return smart account info', async () => {
      const mockAccountInfo = {
        address: '0x1234567890123456789012345678901234567890',
        owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        isDeployed: true,
        nonce: 5n,
      }

      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest
        .fn()
        .mockResolvedValue(mockAccountInfo)

      const result = await sdk.getSmartAccountInfo()

      expect(result).toEqual(mockAccountInfo)
      expect(mockSmartAccount.getSmartAccountInfo).toHaveBeenCalledWith(
        mockWalletClient.account.address,
        0n
      )
    })

    it('should throw error when wallet client not set', async () => {
      const sdkWithoutWallet = new GaslessAASDK(config, mockPublicClient)

      await expect(sdkWithoutWallet.getSmartAccountInfo()).rejects.toThrow(
        'Wallet client not set or no account available'
      )
    })
  })

  describe('transferGasless', () => {
    it('should execute gasless transfer successfully', async () => {
      const transferParams: AATransferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: 1000000n,
      }

      // Mock smart account
      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest.fn().mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        owner: mockWalletClient.account.address,
        isDeployed: true,
        nonce: 1n,
      })
      mockSmartAccount.createExecuteCallData = jest
        .fn()
        .mockReturnValue('0xabcdef')
      mockSmartAccount.signUserOperation = jest
        .fn()
        .mockResolvedValue('0x123signature')

      // Mock bundler client
      const mockBundlerClient = MockedBundlerClient.mock.instances[0]
      mockBundlerClient.sendUserOperation = jest
        .fn()
        .mockResolvedValue('0xuserophash')
      mockBundlerClient.waitForUserOperationReceipt = jest
        .fn()
        .mockResolvedValue({
          success: true,
          userOpHash: '0xuserophash',
          receipt: {
            transactionHash: '0xtxhash',
            gasUsed: 200000n,
          },
          actualGasUsed: 180000n,
          actualGasCost: 3600000000000000n,
        })

      // Mock paymaster client
      const mockPaymasterClient = MockedPaymasterClient.mock.instances[0]
      mockPaymasterClient.getTokenPaymasterData = jest.fn().mockResolvedValue({
        paymaster: '0xpaymaster',
        paymasterData: '0xpaymasterdata',
        callGasLimit: 200000n,
        verificationGasLimit: 150000n,
        preVerificationGas: 21000n,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
      })

      // Mock token info
      const { getTokenInfo } = require('../../permit/eip2612')
      getTokenInfo.mockResolvedValue({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 6,
      })

      const result = await sdk.transferGasless(transferParams)

      expect(result.success).toBe(true)
      expect(result.userOpHash).toBe('0xuserophash')
      expect(result.transactionHash).toBe('0xtxhash')
      expect(mockBundlerClient.sendUserOperation).toHaveBeenCalled()
    })

    it('should throw error when transfer fails', async () => {
      const transferParams: AATransferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: 1000000n,
      }

      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest
        .fn()
        .mockRejectedValue(new Error('Network error'))

      await expect(sdk.transferGasless(transferParams)).rejects.toThrow(
        'Gasless transfer failed: Network error'
      )
    })
  })

  describe('getFeeQuote', () => {
    it('should return fee quote', async () => {
      const transferParams: AATransferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: 1000000n,
      }

      const mockFeeQuote = {
        feeToken: transferParams.token,
        feeAmount: 50000n,
        gasPrice: 20000000000n,
        exchangeRate: 1000000000000000000n,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest.fn().mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        owner: mockWalletClient.account.address,
        isDeployed: true,
        nonce: 1n,
      })
      mockSmartAccount.createExecuteCallData = jest
        .fn()
        .mockReturnValue('0xabcdef')

      const mockPaymasterClient = MockedPaymasterClient.mock.instances[0]
      mockPaymasterClient.getFeeQuote = jest
        .fn()
        .mockResolvedValue(mockFeeQuote)

      const result = await sdk.getFeeQuote(transferParams)

      expect(result).toEqual(mockFeeQuote)
      expect(mockPaymasterClient.getFeeQuote).toHaveBeenCalled()
    })
  })

  describe('canAffordTransfer', () => {
    it('should check if user can afford transfer', async () => {
      const transferParams: AATransferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: 1000000n,
      }

      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest.fn().mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        owner: mockWalletClient.account.address,
        isDeployed: true,
        nonce: 1n,
      })
      mockSmartAccount.createExecuteCallData = jest
        .fn()
        .mockReturnValue('0xabcdef')

      const mockPaymasterClient = MockedPaymasterClient.mock.instances[0]
      mockPaymasterClient.getFeeQuote = jest.fn().mockResolvedValue({
        feeToken: transferParams.token,
        feeAmount: 50000n,
        gasPrice: 20000000000n,
        exchangeRate: 1000000000000000000n,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
      })

      // Mock token balance
      mockPublicClient.readContract.mockResolvedValue(2000000n) // 2 tokens

      const result = await sdk.canAffordTransfer(transferParams)

      expect(result.canAfford).toBe(true)
      expect(result.currentBalance).toBe(2000000n)
      expect(result.requiredBalance).toBe(1050000n) // 1000000 + 50000 fee
      expect(result.feeAmount).toBe(50000n)
    })

    it('should return false when user cannot afford transfer', async () => {
      const transferParams: AATransferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: 1000000n,
      }

      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest.fn().mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        owner: mockWalletClient.account.address,
        isDeployed: true,
        nonce: 1n,
      })
      mockSmartAccount.createExecuteCallData = jest
        .fn()
        .mockReturnValue('0xabcdef')

      const mockPaymasterClient = MockedPaymasterClient.mock.instances[0]
      mockPaymasterClient.getFeeQuote = jest.fn().mockResolvedValue({
        feeToken: transferParams.token,
        feeAmount: 50000n,
        gasPrice: 20000000000n,
        exchangeRate: 1000000000000000000n,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
      })

      // Mock insufficient token balance
      mockPublicClient.readContract.mockResolvedValue(500000n) // 0.5 tokens

      const result = await sdk.canAffordTransfer(transferParams)

      expect(result.canAfford).toBe(false)
      expect(result.currentBalance).toBe(500000n)
      expect(result.requiredBalance).toBe(1050000n)
    })
  })

  describe('getSupportedTokens', () => {
    it('should return supported tokens', async () => {
      const mockTokens = [
        {
          address: '0x8ba1f109551bD432803012645Hac136c11DdF536',
          symbol: 'USDC',
          decimals: 6,
          exchangeRate: 1000000000000000000n,
        },
        {
          address: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
          symbol: 'USDT',
          decimals: 6,
          exchangeRate: 1000000000000000000n,
        },
      ]

      const mockPaymasterClient = MockedPaymasterClient.mock.instances[0]
      mockPaymasterClient.getSupportedTokens = jest.fn().mockResolvedValue({
        tokens: mockTokens,
      })

      const result = await sdk.getSupportedTokens()

      expect(result).toEqual(mockTokens)
      expect(mockPaymasterClient.getSupportedTokens).toHaveBeenCalled()
    })
  })

  describe('estimateGas', () => {
    it('should estimate gas for operation', async () => {
      const transferParams: AATransferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: 1000000n,
      }

      const mockSmartAccount = MockedSmartAccount.mock.instances[0]
      mockSmartAccount.getSmartAccountInfo = jest.fn().mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        owner: mockWalletClient.account.address,
        isDeployed: true,
        nonce: 1n,
      })
      mockSmartAccount.createExecuteCallData = jest
        .fn()
        .mockReturnValue('0xabcdef')

      const mockBundlerClient = MockedBundlerClient.mock.instances[0]
      mockBundlerClient.estimateUserOperationGas = jest.fn().mockResolvedValue({
        callGasLimit: '0x30d40', // 200000
        verificationGasLimit: '0x249f0', // 150000
        preVerificationGas: '0x5208', // 21000
      })

      const result = await sdk.estimateGas(transferParams)

      expect(result.totalGas).toBe(371000n) // 200000 + 150000 + 21000
      expect(result.gasPrice).toBe(20000000000n)
      expect(result.estimatedCost).toBe(7420000000000000n) // 371000 * 20000000000
    })
  })

  describe('getConfig', () => {
    it('should return config copy', () => {
      const returnedConfig = sdk.getConfig()

      expect(returnedConfig).toEqual(expect.objectContaining(config))
      expect(returnedConfig).not.toBe(config) // Should be a copy
    })
  })

  describe('utility methods', () => {
    it('should format amounts correctly', () => {
      const formatted = sdk.formatAmount(1000000n, 6)
      expect(formatted).toBe('1')
    })

    it('should parse amounts correctly', () => {
      const parsed = sdk.parseAmount('1.5', 6)
      expect(parsed).toBe(1500000n)
    })
  })
})
