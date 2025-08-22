import type { ChainPreset, ChainConfig, Environment } from '../types'

interface EnvironmentUrls {
  readonly production: string
  readonly staging: string
  readonly development: string
  readonly local: string
  readonly test: string
}

// Environment-specific relayer service URLs
const RELAYER_URLS: Record<ChainPreset, EnvironmentUrls> = {
  'mantle-sepolia': {
    production: 'https://gasless-relayer-sepolia.mantle.com',
    staging: 'https://gasless-relayer-sepolia-staging.mantle.com',
    development: 'https://gasless-relayer-sepolia-dev.mantle.com',
    local: 'http://localhost:3001',
    test: 'http://localhost:3001',
  },
}

function createChainConfig(
  preset: ChainPreset,
  environment: Environment = 'production'
): ChainConfig {
  const relayerUrls = RELAYER_URLS[preset]

  const baseConfigs = {
    'mantle-sepolia': {
      chainId: 5003,
      rpcUrl: 'https://rpc.sepolia.mantle.xyz',
      gaslessRelayerAddress:
        '0xc500592C002a23EeeB4e93CCfBA60B4c2683fDa9' as const,
      relayerServiceUrl: relayerUrls[environment],
    },
  }

  return baseConfigs[preset]
}

// Default chain configs (production environment)
export const CHAIN_CONFIGS: Record<ChainPreset, ChainConfig> = {
  'mantle-sepolia': createChainConfig('mantle-sepolia'),
}

export function getChainConfig(
  preset: ChainPreset,
  environment?: Environment
): ChainConfig {
  if (environment) {
    return createChainConfig(preset, environment)
  }

  const config = CHAIN_CONFIGS[preset]
  if (!config) {
    throw new Error(`Unsupported chain preset: ${preset}`)
  }
  return config
}
