// Complete Account Abstraction integration example

import React, { useState, useEffect } from 'react'
import { GaslessAASDK } from 'gasless-core'
import { createPublicClient, http, parseUnits } from 'viem'
import { mantle } from 'viem/chains'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import type { AAGaslessConfig, AATransferParams } from 'gasless-core'

// 🎯 PRODUCTION-READY ACCOUNT ABSTRACTION SETUP
const ProductionAAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk, setSdk] = useState<GaslessAASDK | null>(null)
  const [smartAccountInfo, setSmartAccountInfo] = useState<any>(null)
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  useEffect(() => {
    if (publicClient) {
      // ✅ DECENTRALIZED: Account Abstraction with Pimlico
      const config: AAGaslessConfig = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        bundlerUrl: `https://api.pimlico.io/v2/mantle/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`,
        paymasterUrl: `https://api.pimlico.io/v2/mantle/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`,
        apiKey: process.env.NEXT_PUBLIC_PIMLICO_API_KEY!,
        // Optional: custom addresses
        entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        factoryAddress: '0x9406Cc6185a346906296840746125a0E44976454'
      }

      const gaslessSDK = new GaslessAASDK(config, publicClient)
      
      if (walletClient) {
        gaslessSDK.setWalletClient(walletClient)
        
        // Get smart account info
        gaslessSDK.getSmartAccountInfo().then(setSmartAccountInfo).catch(console.error)
      }
      
      setSdk(gaslessSDK)
    }
  }, [publicClient, walletClient])

  return (
    <AAContext.Provider value={{ sdk, smartAccountInfo }}>
      {children}
    </AAContext.Provider>
  )
}

// Context for AA SDK
const AAContext = React.createContext<{ 
  sdk: GaslessAASDK | null
  smartAccountInfo: any 
}>({ 
  sdk: null, 
  smartAccountInfo: null 
})

// Custom hook
export const useGaslessAA = () => {
  const context = React.useContext(AAContext)
  if (!context) {
    throw new Error('useGaslessAA must be used within a ProductionAAProvider')
  }
  return context
}

// 🚀 ADVANCED GASLESS TRANSFER COMPONENT
export const AdvancedGaslessTransfer: React.FC = () => {
  const { sdk, smartAccountInfo } = useGaslessAA()
  const { address } = useAccount()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [feeQuote, setFeeQuote] = useState<any>(null)
  const [supportedTokens, setSupportedTokens] = useState<any[]>([])
  const [balanceCheck, setBalanceCheck] = useState<any>(null)

  const [formData, setFormData] = useState({
    token: '0x8ba1f109551bD432803012645Hac136c11DdF536', // Example USDC
    to: '',
    amount: '',
    feeToken: '' // Optional: different token for fees
  })

  // Load supported tokens on mount
  useEffect(() => {
    if (sdk) {
      sdk.getSupportedTokens()
        .then(setSupportedTokens)
        .catch(console.error)
    }
  }, [sdk])

  // Get fee quote when form changes
  useEffect(() => {
    if (sdk && formData.token && formData.to && formData.amount) {
      const getFeeQuote = async () => {
        try {
          const tokenInfo = await sdk.getTokenInfo(formData.token as any)
          const transferParams: AATransferParams = {
            token: formData.token as any,
            to: formData.to as any,
            amount: parseUnits(formData.amount, tokenInfo.decimals),
            feeToken: formData.feeToken ? (formData.feeToken as any) : undefined
          }
          
          const [quote, affordability] = await Promise.all([
            sdk.getFeeQuote(transferParams),
            sdk.canAffordTransfer(transferParams)
          ])
          
          setFeeQuote(quote)
          setBalanceCheck(affordability)
        } catch (error) {
          console.error('Failed to get fee quote:', error)
        }
      }
      
      getFeeQuote()
    }
  }, [sdk, formData])

  const handleTransfer = async () => {
    if (!sdk || !address) {
      alert('Please connect wallet first')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // 1. Get token info
      const tokenInfo = await sdk.getTokenInfo(formData.token as any)
      console.log('Token info:', tokenInfo)

      // 2. Prepare transfer parameters
      const transferParams: AATransferParams = {
        token: formData.token as any,
        to: formData.to as any,
        amount: parseUnits(formData.amount, tokenInfo.decimals),
        feeToken: formData.feeToken ? (formData.feeToken as any) : undefined,
        maxFeePercentage: 5 // Max 5% fee
      }

      // 3. Check affordability
      const affordability = await sdk.canAffordTransfer(transferParams)
      if (!affordability.canAfford) {
        throw new Error(
          `Insufficient balance. Required: ${sdk.formatAmount(affordability.requiredBalance, tokenInfo.decimals)} ${tokenInfo.symbol}`
        )
      }

      // 4. Execute gasless transfer via Account Abstraction
      console.log('Executing gasless transfer via Account Abstraction...')
      const txResult = await sdk.transferGasless(transferParams)
      
      setResult({
        success: true,
        ...txResult,
        gasUsed: txResult.gasUsed?.toString(),
        feeCharged: txResult.feeCharged?.toString(),
        timestamp: new Date().toISOString(),
        type: 'Account Abstraction'
      })

      // 5. Clear form on success
      setFormData({ ...formData, to: '', amount: '' })

    } catch (error: any) {
      console.error('Transfer failed:', error)
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        type: 'Account Abstraction'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEstimateGas = async () => {
    if (!sdk || !formData.token || !formData.to || !formData.amount) return

    try {
      const tokenInfo = await sdk.getTokenInfo(formData.token as any)
      const transferParams: AATransferParams = {
        token: formData.token as any,
        to: formData.to as any,
        amount: parseUnits(formData.amount, tokenInfo.decimals)
      }

      const estimate = await sdk.estimateGas(transferParams)
      alert(`Gas Estimate:\nTotal Gas: ${estimate.totalGas.toString()}\nGas Price: ${estimate.gasPrice.toString()}\nEstimated Cost: ${estimate.estimatedCost.toString()} wei`)
    } catch (error: any) {
      alert(`Estimation failed: ${error.message}`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🚀 Account Abstraction Gasless Transfer
      </h2>
      
      {/* Connection & Smart Account Status */}
      <div className="mb-6 p-4 bg-blue-50 rounded-md">
        <h3 className="font-medium text-blue-800 mb-2">Account Status</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>EOA Wallet:</strong> {address || 'Not connected'}</p>
          <p><strong>SDK:</strong> {sdk ? '✅ Ready' : '❌ Not initialized'}</p>
          {smartAccountInfo && (
            <>
              <p><strong>Smart Account:</strong> {smartAccountInfo.address}</p>
              <p><strong>Deployed:</strong> {smartAccountInfo.isDeployed ? '✅ Yes' : '❌ No (will deploy on first tx)'}</p>
              <p><strong>Nonce:</strong> {smartAccountInfo.nonce?.toString() || '0'}</p>
            </>
          )}
        </div>
      </div>

      {/* Transfer Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token Address
          </label>
          <select
            value={formData.token}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="0x8ba1f109551bD432803012645Hac136c11DdF536">USDC (Example)</option>
            {supportedTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol} ({token.address.slice(0, 8)}...)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0x..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.000001"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fee Token (Optional)
            </label>
            <select
              value={formData.feeToken}
              onChange={(e) => setFormData({ ...formData, feeToken: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Same as transfer token</option>
              {supportedTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fee Quote Display */}
        {feeQuote && (
          <div className="p-3 bg-gray-50 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">Fee Quote</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Fee Amount: {feeQuote.feeAmount.toString()} wei</p>
              <p>Gas Price: {feeQuote.gasPrice.toString()} wei</p>
              <p>Valid Until: {new Date(Number(feeQuote.validUntil) * 1000).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Balance Check */}
        {balanceCheck && (
          <div className={`p-3 rounded-md ${balanceCheck.canAfford ? 'bg-green-50' : 'bg-red-50'}`}>
            <h4 className={`font-medium mb-2 ${balanceCheck.canAfford ? 'text-green-800' : 'text-red-800'}`}>
              {balanceCheck.canAfford ? '✅ Sufficient Balance' : '❌ Insufficient Balance'}
            </h4>
            <div className={`text-sm space-y-1 ${balanceCheck.canAfford ? 'text-green-600' : 'text-red-600'}`}>
              <p>Current: {balanceCheck.currentBalance.toString()}</p>
              <p>Required: {balanceCheck.requiredBalance.toString()}</p>
              <p>Fee: {balanceCheck.feeAmount.toString()}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleTransfer}
            disabled={loading || !sdk || !address || !formData.token || !formData.to || !formData.amount || !balanceCheck?.canAfford}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing AA Transfer...
              </span>
            ) : (
              '🚀 Send via Account Abstraction'
            )}
          </button>

          <button
            onClick={handleEstimateGas}
            disabled={!sdk || !formData.token || !formData.to || !formData.amount}
            className="px-4 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50"
          >
            Estimate
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`mt-6 p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h3 className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
            {result.success ? '✅ AA Transfer Successful!' : '❌ AA Transfer Failed'}
          </h3>
          
          <div className="mt-2 text-sm">
            <pre className={`whitespace-pre-wrap ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          {result.success && result.userOpHash && (
            <div className="mt-3 space-y-2">
              <a
                href={`https://explorer.mantle.xyz/tx/${result.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-blue-600 hover:text-blue-800 text-sm underline"
              >
                View Transaction on Explorer →
              </a>
              <br />
              <a
                href={`https://jiffyscan.xyz/userOpHash/${result.userOpHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-purple-600 hover:text-purple-800 text-sm underline"
              >
                View UserOp on JiffyScan →
              </a>
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h4 className="font-medium text-blue-800 mb-2">🎯 How Account Abstraction Works:</h4>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Connect your regular wallet (MetaMask, WalletConnect, etc.)</li>
          <li>2. SDK creates a smart account linked to your EOA</li>
          <li>3. You sign the transfer intent (not a transaction!)</li>
          <li>4. Bundler (Pimlico) submits the transaction and pays gas</li>
          <li>5. Paymaster collects fee in tokens and reimburses bundler</li>
          <li>6. Your transfer executes without needing ETH for gas!</li>
        </ol>
        
        <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-600">
          <strong>🔐 Fully Decentralized:</strong> No centralized relayer needed! 
          Multiple bundlers compete to execute your transactions.
        </div>
      </div>
    </div>
  )
}

// Main App with Account Abstraction
export const AccountAbstractionApp: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <ProductionAAProvider>
        <div className="container mx-auto py-8">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Account Abstraction Gasless Transfers
            </h1>
            <p className="text-gray-600">
              Truly decentralized gasless transactions using EIP-4337
            </p>
          </div>
          <AdvancedGaslessTransfer />
        </div>
      </ProductionAAProvider>
    </div>
  )
}

export default AccountAbstractionApp