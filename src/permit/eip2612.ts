import {
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
  encodeAbiParameters,
  keccak256,
  toHex,
} from 'viem'
import type { EIP712Domain, EIP2612Permit, PermitData } from '../types'
import { parseSignature } from '../eip712'

export const PERMIT_TYPEHASH = keccak256(
  toHex(
    'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
  )
)

export function createPermitDomain(
  tokenAddress: Address,
  chainId: number,
  tokenName: string,
  tokenVersion: string = '1'
): EIP712Domain {
  return {
    name: tokenName,
    version: tokenVersion,
    chainId,
    verifyingContract: tokenAddress,
  }
}

export function encodePermitData(permit: EIP2612Permit): Hex {
  return encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
    [
      PERMIT_TYPEHASH,
      permit.owner,
      permit.spender,
      permit.value,
      permit.nonce,
      permit.deadline,
    ]
  )
}

export async function signPermit(
  walletClient: WalletClient,
  domain: EIP712Domain,
  permit: EIP2612Permit
): Promise<PermitData> {
  if (!walletClient.account) {
    throw new Error('Wallet client must have an account')
  }

  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
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
    message: permit,
  })

  const { v, r, s } = parseSignature(
    signature.length === 132 ? signature : ((signature + '1b') as Hex)
  )

  return {
    value: permit.value,
    deadline: permit.deadline,
    v,
    r,
    s,
  }
}

export async function getTokenNonce(
  tokenAddress: Address,
  owner: Address,
  publicClient: PublicClient
): Promise<bigint> {
  try {
    const result = await publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          name: 'nonces',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'nonces',
      args: [owner],
    })

    return result as bigint
  } catch (error) {
    throw new Error(
      `Failed to get token nonce: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function getTokenVersion(
  tokenAddress: Address,
  publicClient: PublicClient
): Promise<string> {
  try {
    const result = await publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          name: 'version',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
        },
      ],
      functionName: 'version',
    })
    return result as string
  } catch (error) {
    // Fallback: try to get it from eip712Domain()
    try {
      const domain = await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'eip712Domain',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [
              { name: 'fields', type: 'bytes1' },
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
              { name: 'salt', type: 'bytes32' },
              { name: 'extensions', type: 'uint256[]' },
            ],
          },
        ],
        functionName: 'eip712Domain',
      })
      return (domain as any)[2] // version is at index 2
    } catch {
      // Final fallback - try common versions
      return '1'
    }
  }
}

export async function getTokenInfo(
  tokenAddress: Address,
  publicClient: PublicClient
): Promise<{ name: string; symbol: string; decimals: number }> {
  try {
    const [name, symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'name',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'string' }],
          },
        ],
        functionName: 'name',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'symbol',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'string' }],
          },
        ],
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'decimals',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint8' }],
          },
        ],
        functionName: 'decimals',
      }),
    ])

    return {
      name: name as string,
      symbol: symbol as string,
      decimals: decimals as number,
    }
  } catch (error) {
    throw new Error(
      `Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
