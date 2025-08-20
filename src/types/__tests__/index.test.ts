import type {
  GaslessConfig,
  TokenInfo,
  MetaTransactionRequest,
  PermitSignature,
  GaslessTransferParams,
  TransactionResult,
  EIP712Domain,
  ForwardRequest,
  PermitData,
} from '../index'

describe('Types', () => {
  describe('Type validations', () => {
    it('should accept valid GaslessConfig', () => {
      const config: GaslessConfig = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        relayerUrl: 'https://relayer.example.com',
        forwarderAddress: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
      }

      expect(config.chainId).toBe(5000)
      expect(config.rpcUrl).toBe('https://rpc.mantle.xyz')
    })

    it('should accept valid TokenInfo', () => {
      const tokenInfo: TokenInfo = {
        address: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
        name: 'MockToken',
        symbol: 'MTK',
        decimals: 18,
      }

      expect(tokenInfo.decimals).toBe(18)
      expect(tokenInfo.symbol).toBe('MTK')
    })

    it('should accept valid MetaTransactionRequest', () => {
      const request: MetaTransactionRequest = {
        from: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        to: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
        value: 0n,
        gas: 21000n,
        nonce: 0n,
        data: '0x',
      }

      expect(request.gas).toBe(21000n)
      expect(request.value).toBe(0n)
    })

    it('should accept valid PermitSignature', () => {
      const signature: PermitSignature = {
        v: 27,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      expect(signature.v).toBe(27)
      expect(typeof signature.deadline).toBe('bigint')
    })

    it('should accept valid GaslessTransferParams', () => {
      const params: GaslessTransferParams = {
        token: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
        to: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        amount: 1000000000000000000n,
        userAddress: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
      }

      expect(params.amount).toBe(1000000000000000000n)
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

    it('should accept valid EIP712Domain', () => {
      const domain: EIP712Domain = {
        name: 'MockToken',
        version: '1',
        chainId: 5000,
        verifyingContract: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
      }

      expect(domain.chainId).toBe(5000)
      expect(domain.version).toBe('1')
    })

    it('should accept valid ForwardRequest', () => {
      const request: ForwardRequest = {
        from: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        to: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
        value: 0n,
        gas: 21000n,
        nonce: 0n,
        data: '0x',
      }

      expect(request.nonce).toBe(0n)
      expect(request.data).toBe('0x')
    })

    it('should accept valid PermitData', () => {
      const permitData: PermitData = {
        owner: '0x9C8f48C2e7a3E3E3c8F1A2b4c8e2b1a2e8f1a2b4',
        spender: '0x8ba1f109551bD432803012645Hac136c11DdF536',
        value: 1000000000000000000n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }

      expect(permitData.value).toBe(1000000000000000000n)
      expect(typeof permitData.deadline).toBe('bigint')
    })
  })
})
