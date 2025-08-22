import React, { useState } from 'react'
import { Gasless } from './src'

// React component example showing browser wallet integration
export function GaslessTransfer() {
  const [gasless] = useState(() => new Gasless({ chainPreset: 'mantle-mainnet' }))
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')

  const handleConnectWallet = async () => {
    try {
      setLoading(true)
      setStatus('Connecting wallet...')
      
      const address = await gasless.connectWallet()
      setUserAddress(address)
      setStatus(`✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}`)
    } catch (error) {
      setStatus(`❌ Connection failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!userAddress) {
      setStatus('❌ Please connect wallet first')
      return
    }

    const formData = new FormData(e.currentTarget)
    const to = formData.get('to') as string
    const amount = formData.get('amount') as string
    const token = formData.get('token') as string

    try {
      setLoading(true)
      setStatus('Preparing transfer...')

      // Check balance first
      const balance = await gasless.getBalance(token as `0x${string}`, userAddress as `0x${string}`)
      const transferAmount = BigInt(amount)
      
      if (balance < transferAmount) {
        setStatus('❌ Insufficient token balance')
        return
      }

      setStatus('Please sign permit in MetaMask...')
      
      // Execute gasless transfer
      const result = await gasless.transfer({
        to: to as `0x${string}`,
        amount: transferAmount,
        token: token as `0x${string}`
      })

      setStatus(`✅ Transfer successful! Tx: ${result.hash.slice(0, 10)}...`)
      
      // Clear form
      e.currentTarget.reset()
      
    } catch (error) {
      setStatus(`❌ Transfer failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>🚀 Gasless Token Transfer</h2>
      
      {/* Wallet Connection */}
      <div style={{ marginBottom: '20px' }}>
        {!userAddress ? (
          <button 
            onClick={handleConnectWallet} 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        ) : (
          <div style={{ padding: '12px', backgroundColor: '#d4edda', borderRadius: '4px', textAlign: 'center' }}>
            ✅ Wallet Connected: {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
          </div>
        )}
      </div>

      {/* Transfer Form */}
      {userAddress && (
        <form onSubmit={handleTransfer}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Token Address:</label>
            <input 
              type="text" 
              name="token"
              placeholder="0x..." 
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Recipient Address:</label>
            <input 
              type="text" 
              name="to"
              placeholder="0x..." 
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Amount (in wei/token units):</label>
            <input 
              type="text" 
              name="amount"
              placeholder="1000000" 
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Processing...' : 'Send Gasless Transfer'}
          </button>
        </form>
      )}

      {/* Status */}
      {status && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: status.includes('❌') ? '#f8d7da' : '#d1ecf1',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {status}
        </div>
      )}

      {/* Info */}
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <h4>How it works:</h4>
        <ol>
          <li>Connect your MetaMask wallet (no private keys needed)</li>
          <li>Enter transfer details</li>
          <li>Sign permit in MetaMask (gives permission to move your tokens)</li>
          <li>SDK automatically executes transaction using built-in relayer</li>
          <li>You pay ZERO gas fees! 🎉</li>
        </ol>
      </div>
    </div>
  )
}

// Usage in your app:
// import { GaslessTransfer } from './GaslessTransfer'
// 
// function App() {
//   return (
//     <div>
//       <GaslessTransfer />
//     </div>
//   )
// }