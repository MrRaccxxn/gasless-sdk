import { type Hex, encodeAbiParameters, keccak256, toHex } from 'viem'
import type { EIP712Domain, EIP712MetaTransfer, SignatureData } from '../types'

export const EIP712_DOMAIN_TYPEHASH = keccak256(
  toHex(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
  )
)

export const META_TRANSFER_TYPEHASH = keccak256(
  toHex(
    'MetaTransfer(address owner,address token,address recipient,uint256 amount,uint256 fee,uint256 deadline,uint256 nonce)'
  )
)

export function createDomainSeparator(domain: EIP712Domain): Hex {
  const encodedDomain = encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'address' },
    ],
    [
      EIP712_DOMAIN_TYPEHASH,
      keccak256(toHex(domain.name)),
      keccak256(toHex(domain.version)),
      BigInt(domain.chainId),
      domain.verifyingContract,
    ]
  )

  return keccak256(encodedDomain)
}

export function encodeMetaTransferData(metaTx: EIP712MetaTransfer): Hex {
  return encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
    [
      META_TRANSFER_TYPEHASH,
      metaTx.owner,
      metaTx.token,
      metaTx.recipient,
      metaTx.amount,
      metaTx.fee,
      metaTx.deadline,
      metaTx.nonce,
    ]
  )
}

export function createMetaTransferHash(
  domain: EIP712Domain,
  metaTx: EIP712MetaTransfer
): Hex {
  const domainSeparator = createDomainSeparator(domain)
  const structHash = keccak256(encodeMetaTransferData(metaTx))

  const encoded = encodeAbiParameters(
    [
      { type: 'bytes1' },
      { type: 'bytes1' },
      { type: 'bytes32' },
      { type: 'bytes32' },
    ],
    ['0x19', '0x01', domainSeparator, structHash]
  )

  return keccak256(encoded)
}

export function parseSignature(signature: Hex): SignatureData {
  if (signature.length !== 132) {
    throw new Error('Invalid signature length')
  }

  const r = signature.slice(0, 66) as Hex
  const s = ('0x' + signature.slice(66, 130)) as Hex
  const v = parseInt(signature.slice(130, 132), 16)

  return { v, r, s }
}

export function formatSignature(sig: SignatureData): Hex {
  const r = sig.r.slice(2)
  const s = sig.s.slice(2)
  const v = sig.v.toString(16).padStart(2, '0')

  return ('0x' + r + s + v) as Hex
}
