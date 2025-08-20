import { createPublicClient, createWalletClient, http } from 'viem'
import { GaslessSDK } from '../gasless-sdk'
import type { GaslessConfig } from '../../types'

const mockConfig: GaslessConfig = {
  chainId: 5000,
  rpcUrl: 'https://rpc.mantle.xyz',
  relayerUrl: 'https://relayer.example.com',
  forwarderAddress: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
}

const mockPublicClient = createPublicClient({
  transport: http(mockConfig.rpcUrl),
})

describe('GaslessSDK', () => {
  let sdk: GaslessSDK

  beforeEach(() => {
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
      const mockWalletClient = createWalletClient({
        transport: http(mockConfig.rpcUrl),
      })

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
      expect(config).not.toBe(mockConfig) // Should be a copy
    })
  })

  describe('transferGasless', () => {
    it('should execute mock transfer successfully', async () => {
      const transferParams = {
        token: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b' as const,
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        amount: 1000000000000000000n,
        userAddress: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
      }

      const result = await sdk.transferGasless(transferParams)

      expect(result).toEqual({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        success: true,
        gasUsed: 21000n,
      })
    })
  })

  describe('getTokenInfo', () => {
    it('should throw not implemented error', async () => {
      await expect(
        sdk.getTokenInfo('0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b')
      ).rejects.toThrow('Not implemented')
    })
  })

  describe('estimateGas', () => {
    it('should throw not implemented error', async () => {
      const transferParams = {
        token: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b' as const,
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536' as const,
        amount: 1000000000000000000n,
        userAddress: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4' as const,
      }

      await expect(sdk.estimateGas(transferParams)).rejects.toThrow(
        'Not implemented'
      )
    })
  })

  describe('getUserNonce', () => {
    it('should throw not implemented error', async () => {
      await expect(
        sdk.getUserNonce('0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b')
      ).rejects.toThrow('Not implemented')
    })
  })
})
