import { ethers } from 'ethers'

const DEBATE_ARENA_ABI = [
  "function arenaCount() view returns (uint256)",
  "function createArena(bytes32 topicHash, uint256 endTime) payable",
  "function joinArena(uint256 arenaId) payable",
  "function vote(uint256 arenaId, uint8 side) payable",
  "function finalize(uint256 arenaId)",
  "function getArena(uint256 arenaId) view returns (bytes32 topicHash, uint256 stakeAmount, uint256 endTime, address proDebater, address conDebater, uint256 proVotes, uint256 conVotes, uint256 totalPot, uint8 status, address winner)",
  "function hasVoted(uint256 arenaId, address voter) view returns (bool)",
  "event ArenaCreated(uint256 indexed arenaId, bytes32 topicHash, uint256 stakeAmount, uint256 endTime, address creator)",
  "event DebaterJoined(uint256 indexed arenaId, address debater, uint8 side)",
  "event VoteCast(uint256 indexed arenaId, address voter, uint8 side, uint256 stake)",
  "event ArenaFinalized(uint256 indexed arenaId, uint8 winningSide, address winner, uint256 payout)"
]

const MONAD_RPC = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"
const ARENA_ADDRESS = process.env.DEBATE_ARENA_ADDRESS
const MONAD_CHAIN_ID = 10143
const MONAD_EXPLORER = "https://testnet.monadscan.com"

let provider = null
let serverWallet = null
let arenaContract = null

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(MONAD_RPC, {
      chainId: MONAD_CHAIN_ID,
      name: "monad-testnet"
    })
  }
  return provider
}

function getServerWallet() {
  if (!serverWallet) {
    const pk = process.env.SERVER_WALLET_PRIVATE_KEY
    if (!pk) throw new Error("SERVER_WALLET_PRIVATE_KEY not set in env")
    serverWallet = new ethers.Wallet(pk, getProvider())
  }
  return serverWallet
}

function getContract(signerOrProvider) {
  if (!ARENA_ADDRESS) throw new Error("DEBATE_ARENA_ADDRESS not set in env")
  return new ethers.Contract(ARENA_ADDRESS, DEBATE_ARENA_ABI, signerOrProvider || getProvider())
}

function getSignedContract() {
  return getContract(getServerWallet())
}

function txUrl(hash) {
  return `${MONAD_EXPLORER}/tx/${hash}`
}

function addressUrl(addr) {
  return `${MONAD_EXPLORER}/address/${addr}`
}

/**
 * Create an on-chain arena
 */
async function createOnChainArena(topic, stakeAmountEth, durationSeconds) {
  const contract = getSignedContract()
  const topicHash = ethers.keccak256(ethers.toUtf8Bytes(topic))
  const endTime = Math.floor(Date.now() / 1000) + durationSeconds
  const stakeWei = ethers.parseEther(stakeAmountEth.toString())

  const tx = await contract.createArena(topicHash, endTime, { value: stakeWei })
  const receipt = await tx.wait()

  // Parse event to get arenaId
  const event = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log)
      return parsed?.name === 'ArenaCreated'
    } catch { return false }
  })

  let arenaId = null
  if (event) {
    const parsed = contract.interface.parseLog(event)
    arenaId = parsed.args[0].toString()
  }

  return {
    arenaId,
    txHash: receipt.hash,
    txUrl: txUrl(receipt.hash),
    topicHash,
    stakeAmount: stakeAmountEth,
    endTime,
    contractAddress: ARENA_ADDRESS,
    contractUrl: addressUrl(ARENA_ADDRESS)
  }
}

/**
 * Join an arena as CON debater
 */
async function joinOnChainArena(arenaId, stakeAmountEth) {
  const contract = getSignedContract()
  const stakeWei = ethers.parseEther(stakeAmountEth.toString())

  const tx = await contract.joinArena(arenaId, { value: stakeWei })
  const receipt = await tx.wait()

  return {
    arenaId,
    txHash: receipt.hash,
    txUrl: txUrl(receipt.hash),
    side: 'con'
  }
}

/**
 * Cast a vote on-chain
 */
async function voteOnChain(arenaId, side, stakeAmountEth = "0.001") {
  const contract = getSignedContract()
  const sideEnum = side === 'pro' ? 1 : 2
  const stakeWei = ethers.parseEther(stakeAmountEth.toString())

  const tx = await contract.vote(arenaId, sideEnum, { value: stakeWei })
  const receipt = await tx.wait()

  return {
    arenaId,
    txHash: receipt.hash,
    txUrl: txUrl(receipt.hash),
    side,
    stake: stakeAmountEth
  }
}

/**
 * Finalize arena and distribute rewards
 */
async function finalizeOnChain(arenaId) {
  const contract = getSignedContract()

  const tx = await contract.finalize(arenaId)
  const receipt = await tx.wait()

  // Parse finalized event
  const event = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log)
      return parsed?.name === 'ArenaFinalized'
    } catch { return false }
  })

  let winningSide = null
  let winner = null
  let payout = null

  if (event) {
    const parsed = contract.interface.parseLog(event)
    winningSide = parsed.args[1] === 1n ? 'pro' : 'con'
    winner = parsed.args[2]
    payout = ethers.formatEther(parsed.args[3])
  }

  return {
    arenaId,
    txHash: receipt.hash,
    txUrl: txUrl(receipt.hash),
    winningSide,
    winner,
    payout
  }
}

/**
 * Get arena details from chain
 */
async function getArenaDetails(arenaId) {
  const contract = getContract()
  const data = await contract.getArena(arenaId)

  const statusMap = { 0: 'active', 1: 'voting', 2: 'finalized' }

  return {
    arenaId,
    topicHash: data[0],
    stakeAmount: ethers.formatEther(data[1]),
    endTime: Number(data[2]),
    proDebater: data[3],
    conDebater: data[4],
    proVotes: Number(data[5]),
    conVotes: Number(data[6]),
    totalPot: ethers.formatEther(data[7]),
    status: statusMap[Number(data[8])] || 'unknown',
    winner: data[9],
    contractAddress: ARENA_ADDRESS,
    contractUrl: addressUrl(ARENA_ADDRESS),
    explorerBase: MONAD_EXPLORER
  }
}

/**
 * Get the current arena count
 */
async function getArenaCount() {
  const contract = getContract()
  const count = await contract.arenaCount()
  return Number(count)
}

export default {
  createOnChainArena,
  joinOnChainArena,
  voteOnChain,
  finalizeOnChain,
  getArenaDetails,
  getArenaCount,
  txUrl,
  addressUrl,
  MONAD_EXPLORER,
  ARENA_ADDRESS,
  MONAD_CHAIN_ID
}
