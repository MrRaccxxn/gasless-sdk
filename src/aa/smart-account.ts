// Smart Account management for Account Abstraction

import {
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
  parseAbi,
  keccak256,
  encodeAbiParameters,
  getContractAddress,
  toHex,
} from 'viem'
import type { SmartAccountInfo, UserOperation } from './types'

export const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function execute(address dest, uint256 value, bytes calldata func) external',
  'function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external',
  'function getNonce() external view returns (uint256)',
  'function initialize(address anOwner) external',
  'function owner() external view returns (address)',
])

export const SIMPLE_ACCOUNT_FACTORY_ABI = parseAbi([
  'function createAccount(address owner, uint256 salt) external returns (address)',
  'function getAddress(address owner, uint256 salt) external view returns (address)',
])

export class SmartAccount {
  private publicClient: PublicClient
  private factoryAddress: Address
  private entryPointAddress: Address

  constructor(
    publicClient: PublicClient,
    factoryAddress: Address,
    entryPointAddress: Address
  ) {
    this.publicClient = publicClient
    this.factoryAddress = factoryAddress
    this.entryPointAddress = entryPointAddress
  }

  async getSmartAccountInfo(
    owner: Address,
    salt: bigint = 0n
  ): Promise<SmartAccountInfo> {
    // 1. Calculate smart account address
    const smartAccountAddress = await this.getSmartAccountAddress(owner, salt)

    // 2. Check if account is deployed
    const code = await this.publicClient.getBytecode({
      address: smartAccountAddress,
    })
    const isDeployed = code !== undefined && code !== '0x'

    // 3. Get nonce if deployed
    let nonce = 0n
    if (isDeployed) {
      try {
        nonce = (await this.publicClient.readContract({
          address: smartAccountAddress,
          abi: SIMPLE_ACCOUNT_ABI,
          functionName: 'getNonce',
        })) as bigint
      } catch (error) {
        console.warn('Failed to get nonce:', error)
      }
    }

    return {
      address: smartAccountAddress,
      owner,
      isDeployed,
      nonce,
    }
  }

  async getSmartAccountAddress(
    owner: Address,
    salt: bigint = 0n
  ): Promise<Address> {
    try {
      const address = (await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: SIMPLE_ACCOUNT_FACTORY_ABI,
        functionName: 'getAddress',
        args: [owner, salt],
      })) as Address

      return address
    } catch (error) {
      throw new Error(`Failed to get smart account address: ${error}`)
    }
  }

  createExecuteCallData(target: Address, value: bigint, data: Hex): Hex {
    return encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: 'execute',
      args: [target, value, data],
    })
  }

  createExecuteBatchCallData(
    targets: Address[],
    values: bigint[],
    datas: Hex[]
  ): Hex {
    return encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: 'executeBatch',
      args: [targets, values, datas],
    })
  }

  createInitCode(owner: Address, salt: bigint = 0n): Hex {
    const createAccountCallData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'createAccount',
      args: [owner, salt],
    })

    return `${this.factoryAddress}${createAccountCallData.slice(2)}` as Hex
  }

  async signUserOperation(
    walletClient: WalletClient,
    userOp: Omit<UserOperation, 'signature'>
  ): Promise<Hex> {
    if (!walletClient.account) {
      throw new Error('Wallet client must have an account')
    }

    // Create the hash to sign
    const userOpHash = this.getUserOperationHash(userOp)

    // Sign the hash
    const signature = await walletClient.signMessage({
      account: walletClient.account,
      message: { raw: userOpHash },
    })

    return signature
  }

  private getUserOperationHash(userOp: Omit<UserOperation, 'signature'>): Hex {
    // Pack the user operation
    const packedUserOp = this.packUserOperation(userOp)

    // Hash with entry point and chain ID
    const encoded = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [
        keccak256(packedUserOp),
        this.entryPointAddress,
        BigInt(this.publicClient.chain?.id || 1),
      ]
    )

    return keccak256(encoded)
  }

  private packUserOperation(userOp: Omit<UserOperation, 'signature'>): Hex {
    const packedPaymasterAndData = userOp.paymaster
      ? encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'bytes' },
          ],
          [
            userOp.paymaster,
            userOp.paymasterVerificationGasLimit || 0n,
            userOp.paymasterPostOpGasLimit || 0n,
            userOp.paymasterData || '0x',
          ]
        )
      : '0x'

    return encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256('0x'), // initCode hash (empty for existing accounts)
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(packedPaymasterAndData),
      ]
    )
  }

  async estimateUserOperationGas(
    userOp: Omit<
      UserOperation,
      | 'signature'
      | 'callGasLimit'
      | 'verificationGasLimit'
      | 'preVerificationGas'
    >
  ): Promise<{
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
  }> {
    // These are reasonable defaults for most operations
    // In production, you'd call the bundler's estimation endpoint
    return {
      callGasLimit: 200000n,
      verificationGasLimit: 150000n,
      preVerificationGas: 21000n,
    }
  }
}
