const request = require('supertest')
const app = require('../backend-relayer-service')

// Mock viem to avoid real blockchain calls during testing
jest.mock('viem', () => {
  const mockPublicClient = {
    simulateContract: jest.fn(),
  }
  
  const mockWalletClient = {
    writeContract: jest.fn(),
    getBalance: jest.fn(),
  }

  return {
    createPublicClient: jest.fn(() => mockPublicClient),
    createWalletClient: jest.fn(() => mockWalletClient),
    http: jest.fn(),
  }
})

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({
    address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b'
  }))
}))

describe('Backend Relayer Service', () => {
  // Mock environment variables for testing
  beforeAll(() => {
    process.env.MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  })

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        supportedChains: [5003]
      })
    })
  })

  describe('Relayer Balance Endpoint', () => {
    it('should return relayer balance for valid chain', async () => {
      const { createPublicClient } = require('viem')
      const mockPublicClient = createPublicClient()
      mockPublicClient.getBalance.mockResolvedValue(BigInt('1000000000000000000')) // 1 ETH

      const response = await request(app)
        .get('/relayer-balance/5003')
        .expect(200)

      expect(response.body).toEqual({
        chainId: 5003,
        relayerAddress: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        balance: '1000000000000000000',
        balanceETH: '1.0000'
      })
    })

    it('should return error for unsupported chain', async () => {
      const response = await request(app)
        .get('/relayer-balance/999')
        .expect(400)

      expect(response.body).toEqual({
        error: 'Unsupported chain ID: 999'
      })
    })
  })

  describe('Relay Transaction Endpoint', () => {
    const validTransactionData = {
      metaTx: {
        owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        recipient: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        amount: '1000000',
        fee: '10000',
        nonce: '0',
        deadline: '1640995200'
      },
      permitData: {
        value: '1010000',
        deadline: '1640995200',
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      },
      signature: '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      chainId: 5003,
      userAddress: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      timestamp: Math.floor(Date.now() / 1000),
      userSignature: '0xuser123456789'
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should successfully execute gasless transaction', async () => {
      const { createPublicClient, createWalletClient } = require('viem')
      const mockPublicClient = createPublicClient()
      const mockWalletClient = createWalletClient()

      mockPublicClient.simulateContract.mockResolvedValue({
        result: undefined,
        request: {}
      })
      
      mockWalletClient.writeContract.mockResolvedValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')

      const response = await request(app)
        .post('/relay-transaction')
        .send(validTransactionData)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        chainId: 5003,
        gasUsed: null,
        metaTxHash: '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      })

      // Verify contract calls were made with correct parameters
      expect(mockPublicClient.simulateContract).toHaveBeenCalledWith({
        address: '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9',
        abi: expect.any(Array),
        functionName: 'executeMetaTransfer',
        args: [
          expect.objectContaining({
            owner: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
            token: '0x8ba1f109551bD432803012645Hac136c11DdF536',
            recipient: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
            amount: BigInt('1000000'),
            fee: BigInt('10000'),
            nonce: BigInt('0'),
            deadline: BigInt('1640995200')
          }),
          expect.objectContaining({
            value: BigInt('1010000'),
            deadline: BigInt('1640995200'),
            v: 27
          }),
          '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
        ],
        account: expect.any(Object)
      })
    })

    it('should reject transaction with missing fields', async () => {
      const incompleteData = { ...validTransactionData }
      delete incompleteData.metaTx

      const response = await request(app)
        .post('/relay-transaction')
        .send(incompleteData)
        .expect(400)

      expect(response.body).toEqual({
        error: 'Missing required fields: metaTx, permitData, signature, chainId'
      })
    })

    it('should reject transaction for unsupported chain', async () => {
      const invalidChainData = {
        ...validTransactionData,
        chainId: 999
      }

      const response = await request(app)
        .post('/relay-transaction')
        .send(invalidChainData)
        .expect(400)

      expect(response.body).toEqual({
        error: 'Unsupported chain ID: 999'
      })
    })

    it('should handle contract simulation failure', async () => {
      const { createPublicClient } = require('viem')
      const mockPublicClient = createPublicClient()

      mockPublicClient.simulateContract.mockRejectedValue(
        new Error('Insufficient balance')
      )

      const response = await request(app)
        .post('/relay-transaction')
        .send(validTransactionData)
        .expect(400)

      expect(response.body).toEqual({
        error: 'Transaction validation failed: Insufficient balance'
      })
    })

    it('should handle transaction execution failure', async () => {
      const { createPublicClient, createWalletClient } = require('viem')
      const mockPublicClient = createPublicClient()
      const mockWalletClient = createWalletClient()

      mockPublicClient.simulateContract.mockResolvedValue({
        result: undefined,
        request: {}
      })
      
      mockWalletClient.writeContract.mockRejectedValue(
        new Error('Gas estimation failed')
      )

      const response = await request(app)
        .post('/relay-transaction')
        .send(validTransactionData)
        .expect(500)

      expect(response.body).toEqual({
        error: 'Transaction execution failed: Gas estimation failed'
      })
    })

    it('should handle missing relayer private key', async () => {
      // Temporarily remove the private key
      const originalKey = process.env.MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY
      delete process.env.MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY

      const response = await request(app)
        .post('/relay-transaction')
        .send(validTransactionData)
        .expect(500)

      expect(response.body).toEqual({
        error: 'Relayer key not configured for this chain'
      })

      // Restore the key
      process.env.MANTLE_SEPOLIA_RELAYER_PRIVATE_KEY = originalKey
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests quickly to test rate limiting
      const requests = Array(12).fill().map(() =>
        request(app).get('/health')
      )

      const responses = await Promise.all(requests)
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBeDefined()
    })
  })

  describe('BigInt Conversion', () => {
    it('should properly convert string numbers to BigInt', async () => {
      const { createPublicClient, createWalletClient } = require('viem')
      const mockPublicClient = createPublicClient()
      const mockWalletClient = createWalletClient()

      mockPublicClient.simulateContract.mockResolvedValue({
        result: undefined,
        request: {}
      })
      
      mockWalletClient.writeContract.mockResolvedValue('0x123')

      await request(app)
        .post('/relay-transaction')
        .send(validTransactionData)
        .expect(200)

      // Verify that BigInt conversion happened correctly
      const simulateCall = mockPublicClient.simulateContract.mock.calls[0][0]
      const [metaTx, permitData] = simulateCall.args

      expect(typeof metaTx.amount).toBe('bigint')
      expect(typeof metaTx.fee).toBe('bigint')
      expect(typeof metaTx.nonce).toBe('bigint')
      expect(typeof metaTx.deadline).toBe('bigint')
      expect(typeof permitData.value).toBe('bigint')
      expect(typeof permitData.deadline).toBe('bigint')
    })
  })
})