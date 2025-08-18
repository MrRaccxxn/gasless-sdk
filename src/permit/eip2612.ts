import type { Address, Hex, WalletClient } from 'viem'
import type { PermitData, PermitSignature, EIP712Domain } from '../types'

export class EIP2612Permit {
  private readonly domain: EIP712Domain

  constructor(
    tokenAddress: Address,
    tokenName: string,
    tokenVersion: string,
    chainId: number
  ) {
    this.domain = {
      name: tokenName,
      version: tokenVersion,
      chainId,
      verifyingContract: tokenAddress,
    }
  }

  public async signPermit(
    _permitData: PermitData,
    _walletClient: WalletClient
  ): Promise<PermitSignature> {
    // TODO: Implement EIP-2612 permit signing
    throw new Error('Not implemented')
  }

  public getTypedData(permitData: PermitData): {
    domain: EIP712Domain
    types: Record<string, Array<{ name: string; type: string }>>
    primaryType: string
    message: PermitData
  } {
    return {
      domain: this.domain,
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: permitData,
    }
  }

  public encodePermitCall(
    _permitData: PermitData,
    _signature: PermitSignature
  ): Hex {
    // TODO: Implement permit function call encoding
    throw new Error('Not implemented')
  }
}
