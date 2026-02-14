import { ethers } from 'ethers'

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'
const MONAD_CHAIN_ID = 10143
const REQUIRED_MON_BALANCE = '0.01' // Minimum MON balance for spectator voting

let provider = null

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(MONAD_RPC_URL, {
      chainId: MONAD_CHAIN_ID,
      name: 'monad-testnet'
    })
  }
  return provider
}

export async function checkTokenBalance(walletAddress) {
  try {
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      console.log('Invalid wallet address, allowing for dev mode')
      return true
    }

    const p = getProvider()
    const balance = await p.getBalance(walletAddress)
    const balanceEth = ethers.formatEther(balance)

    console.log(`Wallet ${walletAddress} MON balance: ${balanceEth}`)

    return parseFloat(balanceEth) >= parseFloat(REQUIRED_MON_BALANCE)
  } catch (error) {
    console.error('Monad balance check failed:', error.message)
    // Allow in dev mode if RPC is down
    console.warn('Bypassing check for development')
    return true
  }
}

export function getTokenConfig() {
  return {
    chain: 'Monad Testnet',
    chainId: MONAD_CHAIN_ID,
    rpcUrl: MONAD_RPC_URL,
    requiredBalance: REQUIRED_MON_BALANCE,
    explorer: 'https://testnet.monadscan.com',
    nativeToken: 'MON'
  }
}
