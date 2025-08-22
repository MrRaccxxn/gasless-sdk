import type {
  GaslessConfig,
  TokenInfo,
  MetaTransfer,
  PermitData,
  GaslessTransferParams,
  TransactionResult,
  EIP712Domain,
  EIP2612Permit,
  SignatureData,
  ContractLimits,
  GaslessTransferRequest,
  ForwardRequest,
  MetaTransactionRequest,
} from '../index'

describe('Types', () => {
  describe('Type validations', () => {
    it('should accept valid GaslessConfig', () => {
      const config: GaslessConfig = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        gaslessRelayerAddress: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      }

      expect(config.chainId).toBe(5000)
      expect(config.rpcUrl).toBe('https://rpc.mantle.xyz')
    })

    it('should accept GaslessConfig with environment setting', () => {
      const configWithEnv: GaslessConfig = {
        chainPreset: 'mantle-sepolia',
        environment: 'development',
        localRelayerUrl: 'http://localhost:8080',
      }

      expect(configWithEnv.environment).toBe('development')
      expect(configWithEnv.localRelayerUrl).toBeDefined()
    })

    it('should accept valid TokenInfo', () => {
      const tokenInfo: TokenInfo = {
        address: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        name: 'MockToken',
        symbol: 'MTK',
        decimals: 18,
        isWhitelisted: true,
      }

      expect(tokenInfo.decimals).toBe(18)
      expect(tokenInfo.symbol).toBe('MTK')
      expect(tokenInfo.isWhitelisted).toBe(true)
    })

    it('should accept valid MetaTransfer', () => {
      const metaTransfer: MetaTransfer = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        recipient: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
        fee: 10000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      expect(metaTransfer.amount).toBe(1000000n)
      expect(metaTransfer.fee).toBe(10000n)
    })

    it('should accept valid PermitData', () => {
      const permitData: PermitData = {
        value: 1000000n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }

      expect(permitData.v).toBe(27)
      expect(typeof permitData.deadline).toBe('bigint')
    })

    it('should accept valid GaslessTransferParams', () => {
      const params: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
      }

      expect(params.amount).toBe(1000000n)
    })

    it('should accept GaslessTransferParams with optional fields', () => {
      const paramsWithOptionals: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
        fee: 10000n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      expect(paramsWithOptionals.fee).toBe(10000n)
      expect(paramsWithOptionals.deadline).toBeDefined()
    })

    it('should accept valid TransactionResult', () => {
      const result: TransactionResult = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        success: true,
        gasUsed: 21000n,
      }

      expect(result.success).toBe(true)
      expect(result.gasUsed).toBe(21000n)
    })

    it('should accept TransactionResult with metaTxHash', () => {
      const resultWithMetaTx: TransactionResult = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        success: true,
        metaTxHash:
          '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      }

      expect(resultWithMetaTx.metaTxHash).toBeDefined()
    })

    it('should accept valid EIP712Domain', () => {
      const domain: EIP712Domain = {
        name: 'GaslessRelayer',
        version: '1',
        chainId: 5000,
        verifyingContract: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      }

      expect(domain.chainId).toBe(5000)
      expect(domain.version).toBe('1')
    })

    it('should accept valid EIP2612Permit', () => {
      const permit: EIP2612Permit = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        value: 1000000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      expect(permit.value).toBe(1000000n)
      expect(typeof permit.deadline).toBe('bigint')
    })

    it('should accept valid SignatureData', () => {
      const signature: SignatureData = {
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }

      expect(signature.v).toBe(27)
      expect(signature.r).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should accept valid ContractLimits', () => {
      const limits: ContractLimits = {
        maxTransferAmount: 1000000000n,
        maxFeeAmount: 100000000n,
      }

      expect(limits.maxTransferAmount).toBe(1000000000n)
      expect(limits.maxFeeAmount).toBe(100000000n)
    })

    it('should accept valid GaslessTransferRequest', () => {
      const metaTx: MetaTransfer = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        recipient: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
        fee: 10000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      const permitData: PermitData = {
        value: 1010000n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }

      const request: GaslessTransferRequest = {
        metaTx,
        permitData,
        signature:
          '0x789abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      }

      expect(request.metaTx.amount).toBe(1000000n)
      expect(request.permitData.value).toBe(1010000n)
      expect(request.signature).toMatch(/^0x[a-fA-F0-9]+$/)
    })

    // Legacy types for backward compatibility
    it('should accept valid ForwardRequest', () => {
      const request: ForwardRequest = {
        from: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        value: 0n,
        gas: 21000n,
        nonce: 0n,
        data: '0x',
      }

      expect(request.nonce).toBe(0n)
      expect(request.data).toBe('0x')
    })

    it('should accept valid MetaTransactionRequest', () => {
      const request: MetaTransactionRequest = {
        from: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        to: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        value: 0n,
        gas: 21000n,
        nonce: 0n,
        data: '0x',
      }

      expect(request.gas).toBe(21000n)
      expect(request.value).toBe(0n)
    })
  })

  describe('Type inference', () => {
    it('should properly infer readonly properties', () => {
      const config: GaslessConfig = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        gaslessRelayerAddress: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
      }

      // These should be type errors if readonly is not properly set
      // config.chainId = 1337 // Should error
      // config.rpcUrl = 'different' // Should error

      expect(config.chainId).toBe(5000)
    })

    it('should handle optional properties correctly', () => {
      const paramsMinimal: GaslessTransferParams = {
        token: '0x742d35cC6b7E4cE7C56F1BA2e0Fb3e00E2fB0E9b',
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000n,
      }

      const paramsComplete: GaslessTransferParams = {
        ...paramsMinimal,
        fee: 10000n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      expect(paramsMinimal.fee).toBeUndefined()
      expect(paramsComplete.fee).toBe(10000n)
    })
  })
})
