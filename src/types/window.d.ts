declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      isMetaMask?: boolean
      selectedAddress?: string
      chainId?: string
    }
  }
}

export {}
