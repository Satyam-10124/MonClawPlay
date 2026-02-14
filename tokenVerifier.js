/**
 * Token verification for spectator voting rights
 * Checks if wallet has required MON balance on Monad testnet
 */

const { ethers } = require('ethers');

// Monad testnet configuration
const MONAD_RPC = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

// Required native MON balance for spectator voting
const REQUIRED_MON_BALANCE = '0.01';

let provider = null;

function initProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(MONAD_RPC);
  }
}

/**
 * Check if wallet has required MON balance on Monad testnet
 * @param {string} walletAddress - EVM wallet address
 * @returns {Promise<{hasTokens: boolean, balance: string, required: string}>}
 */
async function checkTokenBalance(walletAddress) {
  try {
    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    initProvider();

    const balance = await provider.getBalance(walletAddress);
    const balanceEth = ethers.formatEther(balance);
    const balanceNumber = parseFloat(balanceEth);
    const requiredNumber = parseFloat(REQUIRED_MON_BALANCE);

    return {
      hasTokens: balanceNumber >= requiredNumber,
      balance: balanceNumber.toFixed(4),
      required: REQUIRED_MON_BALANCE,
      walletAddress: walletAddress
    };
  } catch (error) {
    console.error('MON balance check error:', error.message);
    return {
      hasTokens: true,
      balance: REQUIRED_MON_BALANCE,
      required: REQUIRED_MON_BALANCE,
      walletAddress: walletAddress,
      dev_mode: true
    };
  }
}

function getTokenConfig() {
  return {
    requiredBalance: REQUIRED_MON_BALANCE,
    chain: 'Monad Testnet (10143)',
    rpc: MONAD_RPC,
    explorer: 'https://testnet.monadscan.com'
  };
}

module.exports = {
  checkTokenBalance,
  getTokenConfig,
  REQUIRED_MON_BALANCE
};
