import type { Address, Hash, Hex, WalletClient } from 'viem'
import type {
  ForwardRequest,
  MetaTransactionRequest,
  EIP712Domain,
} from '../types'

export class MetaTransactionForwarder {
  private readonly domain: EIP712Domain

  constructor(forwarderAddress: Address, chainId: number) {
    this.domain = {
      name: 'MinimalForwarder',
      version: '0.0.1',
      chainId,
      verifyingContract: forwarderAddress,
    }
  }

  public async signMetaTransaction(
    _request: MetaTransactionRequest,
    _walletClient: WalletClient
  ): Promise<Hex> {
    // TODO: Implement EIP-712 signing
    throw new Error('Not implemented')
  }

  public async executeMetaTransaction(
    _request: ForwardRequest,
    _signature: Hex
  ): Promise<Hash> {
    // TODO: Implement meta-transaction execution
    throw new Error('Not implemented')
  }

  public getTypedData(request: ForwardRequest): {
    domain: EIP712Domain
    types: Record<string, Array<{ name: string; type: string }>>
    primaryType: string
    message: ForwardRequest
  } {
    return {
      domain: this.domain,
      types: {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
      primaryType: 'ForwardRequest',
      message: request,
    }
  }
}
