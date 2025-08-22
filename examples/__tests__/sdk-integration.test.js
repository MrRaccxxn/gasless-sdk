/**
 * SDK Integration Tests
 * 
 * Tests the actual Gasless SDK against the backend relayer service
 * These tests require the backend service to be running
 */

const { GaslessSDK } = require('../../dist/index.js')
const request = require('supertest')
const app = require('../backend-relayer-service')

describe('SDK Integration with Backend Service', () => {
  let sdk
  let server
  let serverPort = 3002 // Use different port for testing

  beforeAll(async () => {
    // Start the backend service on test port
    server = app.listen(serverPort, () => {
      console.log(`Test server running on port ${serverPort}`)
    })

    // Set up SDK to use test server
    sdk = new GaslessSDK({
      chainPreset: 'mantle-sepolia',
      environment: 'local',
      localRelayerUrl: `http://localhost:${serverPort}`
    })

    // Mock environment variable for testing
    process.env.MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  })

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  describe('Backend Service Connectivity', () => {
    it('should connect to backend health endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body.status).toBe('healthy')
      expect(response.body.supportedChains).toContain(5003)
    })

    it('should have correct SDK configuration', () => {
      const config = sdk.getConfig()
      expect(config.chainId).toBe(5003)
      expect(config.relayerServiceUrl).toBe(`http://localhost:${serverPort}`)
      expect(config.gaslessRelayerAddress).toBe('0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9')
    })
  })

  describe('SDK Methods', () => {
    it('should return hello world message', () => {
      expect(sdk.helloWorld()).toBe('Hello World from Gasless SDK! 🚀')
    })

    it('should get contract limits', async () => {
      // Mock the contract call
      jest.spyOn(sdk._publicClient, 'readContract')
        .mockResolvedValueOnce(BigInt('1000000000')) // maxTransferAmount
        .mockResolvedValueOnce(BigInt('100000000'))  // maxFeeAmount

      const limits = await sdk.getContractLimits()
      
      expect(limits.maxTransferAmount).toBe(BigInt('1000000000'))
      expect(limits.maxFeeAmount).toBe(BigInt('100000000'))
    })

    it('should check if token is whitelisted', async () => {
      // Mock the contract call
      jest.spyOn(sdk._publicClient, 'readContract')
        .mockResolvedValueOnce(true)

      const isWhitelisted = await sdk.isTokenWhitelisted('0x8ba1f109551bD432803012645Hac136c11DdF536')
      
      expect(isWhitelisted).toBe(true)
    })

    it('should get user nonce', async () => {
      // Mock the contract call
      jest.spyOn(sdk._publicClient, 'readContract')
        .mockResolvedValueOnce(BigInt('5'))

      const nonce = await sdk.getUserNonce('0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b')
      
      expect(nonce).toBe(BigInt('5'))
    })
  })

  describe('Gasless Transfer Flow (Mocked)', () => {
    let mockWalletClient

    beforeEach(() => {
      // Mock wallet client for testing
      mockWalletClient = {
        account: {
          address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
        },
        signTypedData: jest.fn().mockResolvedValue(
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b'
        ),
        signMessage: jest.fn().mockResolvedValue(
          '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
        )
      }

      sdk.setWalletClient(mockWalletClient)
    })

    it('should prepare transfer data correctly for backend', async () => {
      // Mock all the required contract calls
      jest.spyOn(sdk._publicClient, 'readContract')
        .mockResolvedValueOnce(BigInt('0'))    // getUserNonce
        .mockResolvedValueOnce(BigInt('0'))    // getTokenNonce  
        .mockResolvedValueOnce('Test Token')   // token name
        .mockResolvedValueOnce('TEST')         // token symbol
        .mockResolvedValueOnce(18)             // token decimals

      // Mock fetch to capture the request sent to backend
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          hash: '0x1234567890abcdef',
          metaTxHash: '0x789abc1234567890'
        })
      })
      global.fetch = mockFetch

      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: BigInt('1000000'),
        fee: BigInt('10000')
      }

      const result = await sdk.transferGasless(transferParams)

      // Verify result
      expect(result.success).toBe(true)
      expect(result.hash).toBe('0x1234567890abcdef')

      // Verify the request sent to backend
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:${serverPort}/relay-transaction`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"chainId":5003')
        })
      )

      // Verify request body structure
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody).toEqual({
        metaTx: expect.objectContaining({
          owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
          token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
          recipient: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
          amount: '1000000',  // Should be string for JSON
          fee: '10000',       // Should be string for JSON
          nonce: '0',
          deadline: expect.any(String)
        }),
        permitData: expect.objectContaining({
          value: '1010000',   // amount + fee as string
          deadline: expect.any(String),
          v: expect.any(Number),
          r: expect.any(String),
          s: expect.any(String)
        }),
        signature: expect.any(String),
        chainId: 5003,
        userAddress: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        timestamp: expect.any(Number),
        userSignature: expect.any(String)
      })
    })

    it('should handle backend service errors', async () => {
      // Mock contract calls
      jest.spyOn(sdk._publicClient, 'readContract')
        .mockResolvedValueOnce(BigInt('0'))
        .mockResolvedValueOnce(BigInt('0'))
        .mockResolvedValueOnce('Test Token')
        .mockResolvedValueOnce('TEST')
        .mockResolvedValueOnce(18)

      // Mock fetch to return error
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Insufficient balance'
        })
      })

      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: BigInt('1000000')
      }

      await expect(sdk.transferGasless(transferParams)).rejects.toThrow('Insufficient balance')
    })
  })

  describe('Error Handling', () => {
    it('should throw error when wallet client not set', async () => {
      const sdkWithoutWallet = new GaslessSDK({
        chainPreset: 'mantle-sepolia',
        environment: 'local',
        localRelayerUrl: `http://localhost:${serverPort}`
      })

      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: BigInt('1000000')
      }

      await expect(sdkWithoutWallet.transferGasless(transferParams))
        .rejects.toThrow('Wallet client not set or no account available')
    })

    it('should handle network errors to backend service', async () => {
      // Create SDK pointing to non-existent service
      const sdkWithBadUrl = new GaslessSDK({
        chainPreset: 'mantle-sepolia',
        environment: 'local',
        localRelayerUrl: 'http://localhost:9999'
      })

      const mockWalletClient = {
        account: { address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b' },
        signTypedData: jest.fn().mockResolvedValue('0x123'),
        signMessage: jest.fn().mockResolvedValue('0x456')
      }

      sdkWithBadUrl.setWalletClient(mockWalletClient)

      // Mock contract calls
      jest.spyOn(sdkWithBadUrl._publicClient, 'readContract')
        .mockResolvedValueOnce(BigInt('0'))
        .mockResolvedValueOnce(BigInt('0'))
        .mockResolvedValueOnce('Test Token')
        .mockResolvedValueOnce('TEST')
        .mockResolvedValueOnce(18)

      const transferParams = {
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        to: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: BigInt('1000000')
      }

      await expect(sdkWithBadUrl.transferGasless(transferParams))
        .rejects.toThrow(/Relayer service error/)
    })
  })
})