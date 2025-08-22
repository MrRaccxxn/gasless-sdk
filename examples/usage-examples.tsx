// Complete React integration examples

import React, { useState, useEffect } from 'react'
import { GaslessSDK } from 'gasless-core'
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { mantle } from 'viem/chains'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'

// 1. PRODUCTION SETUP (Recommended)
const ProductionGaslessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk, setSdk] = useState<GaslessSDK | null>(null)
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  useEffect(() => {
    if (publicClient) {
      // ✅ SECURE: Production configuration using relayer service
      const config = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        gaslessRelayerAddress: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
        relayerServiceUrl: process.env.NEXT_PUBLIC_RELAYER_SERVICE_URL!, // Your backend API
        apiKey: process.env.NEXT_PUBLIC_RELAYER_API_KEY! // Optional API key
      }

      const gaslessSDK = new GaslessSDK(config, publicClient)
      
      if (walletClient) {
        gaslessSDK.setWalletClient(walletClient)
      }
      
      setSdk(gaslessSDK)
    }
  }, [publicClient, walletClient])

  return (
    <GaslessContext.Provider value={{ sdk }}>
      {children}
    </GaslessContext.Provider>
  )
}

// 2. DEVELOPMENT SETUP (Testing only)
const DevelopmentGaslessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk, setSdk] = useState<GaslessSDK | null>(null)
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  useEffect(() => {
    if (publicClient) {
      // ⚠️ DEVELOPMENT ONLY: Using private key directly (NEVER in production!)
      const config = {
        chainId: 5000,
        rpcUrl: 'https://rpc.mantle.xyz',
        gaslessRelayerAddress: '0x742d35cc6B7e4CE7c56F1Ba2e0fB3e00e2Fb0E9b',
        relayerPrivateKey: process.env.NEXT_PUBLIC_RELAYER_PRIVATE_KEY! // Only for testing
      }

      const gaslessSDK = new GaslessSDK(config, publicClient)
      
      if (walletClient) {
        gaslessSDK.setWalletClient(walletClient)
      }
      
      setSdk(gaslessSDK)
    }
  }, [publicClient, walletClient])

  return (
    <GaslessContext.Provider value={{ sdk }}>
      {children}
    </GaslessContext.Provider>
  )
}

// Context for SDK
const GaslessContext = React.createContext<{ sdk: GaslessSDK | null }>({ sdk: null })

// Custom hook
export const useGaslessSDK = () => {
  const context = React.useContext(GaslessContext)
  if (!context) {
    throw new Error('useGaslessSDK must be used within a GaslessProvider')
  }
  return context
}

// Transfer component
export const GaslessTransferComponent: React.FC = () => {
  const { sdk } = useGaslessSDK()
  const { address } = useAccount()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [formData, setFormData] = useState({
    token: '0x8ba1f109551bD432803012645Hac136c11DdF536', // Example token
    to: '',
    amount: '',
    fee: '0.01' // Optional fee
  })

  const handleTransfer = async () => {
    if (!sdk || !address) {
      alert('Please connect wallet first')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // 1. Get token info and validate
      const tokenInfo = await sdk.getTokenInfo(formData.token as any)
      console.log('Token info:', tokenInfo)

      if (!tokenInfo.isWhitelisted) {
        throw new Error('Token is not whitelisted for gasless transfers')
      }

      // 2. Prepare transfer parameters
      const transferParams = {
        token: formData.token as any,
        to: formData.to as any,
        amount: BigInt(parseFloat(formData.amount) * Math.pow(10, tokenInfo.decimals)),
        fee: formData.fee ? BigInt(parseFloat(formData.fee) * Math.pow(10, tokenInfo.decimals)) : undefined
      }

      // 3. Estimate gas (optional)
      try {
        const gasEstimate = await sdk.estimateGas(transferParams)
        console.log('Gas estimate:', gasEstimate.toString())
      } catch (e) {
        console.log('Gas estimation failed:', e)
      }

      // 4. Execute gasless transfer
      console.log('Executing gasless transfer...')
      const txResult = await sdk.transferGasless(transferParams)
      
      setResult({
        success: true,
        ...txResult,
        gasUsed: txResult.gasUsed?.toString(),
        timestamp: new Date().toISOString()
      })

      // 5. Clear form on success
      setFormData({ ...formData, to: '', amount: '' })

    } catch (error: any) {
      console.error('Transfer failed:', error)
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGetTokenInfo = async () => {
    if (!sdk || !formData.token) return

    try {
      const info = await sdk.getTokenInfo(formData.token as any)
      alert(JSON.stringify(info, null, 2))
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Gasless Token Transfer</h2>
      
      {/* Connection Status */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <p className="text-sm">
          <strong>Wallet:</strong> {address || 'Not connected'}
        </p>
        <p className="text-sm">
          <strong>SDK:</strong> {sdk ? '✅ Ready' : '❌ Not initialized'}
        </p>
      </div>

      {/* Transfer Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token Address
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0x..."
            />
            <button
              onClick={handleGetTokenInfo}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              disabled={!sdk || !formData.token}
            >
              Info
            </button>
          </div>
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
              Fee (Optional)
            </label>
            <input
              type="number"
              step="0.000001"
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.01"
            />
          </div>
        </div>

        <button
          onClick={handleTransfer}
          disabled={loading || !sdk || !address || !formData.token || !formData.to || !formData.amount}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Gasless Transfer...
            </span>
          ) : (
            '🚀 Send Gasless Transfer'
          )}
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`mt-6 p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h3 className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
            {result.success ? '✅ Transfer Successful!' : '❌ Transfer Failed'}
          </h3>
          
          <div className="mt-2 text-sm">
            <pre className={`whitespace-pre-wrap ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          {result.success && result.hash && (
            <div className="mt-3">
              <a
                href={`https://explorer.mantle.xyz/tx/${result.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                View on Explorer →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h4 className="font-medium text-blue-800 mb-2">How it works:</h4>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Connect your wallet (MetaMask, WalletConnect, etc.)</li>
          <li>2. Enter the token address (must be whitelisted)</li>
          <li>3. Specify recipient and amount</li>
          <li>4. Click "Send Gasless Transfer" - no ETH needed for gas!</li>
          <li>5. The relayer pays gas fees, you pay only the optional fee</li>
        </ol>
      </div>
    </div>
  )
}

// Main App component
export const App: React.FC = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Use production or development provider based on environment */}
      {isProduction ? (
        <ProductionGaslessProvider>
          <div className="container mx-auto py-8">
            <GaslessTransferComponent />
          </div>
        </ProductionGaslessProvider>
      ) : (
        <DevelopmentGaslessProvider>
          <div className="container mx-auto py-8">
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
              <p className="text-yellow-800 text-sm">
                ⚠️ Development Mode: Using direct private key (not secure for production)
              </p>
            </div>
            <GaslessTransferComponent />
          </div>
        </DevelopmentGaslessProvider>
      )}
    </div>
  )
}

export default App