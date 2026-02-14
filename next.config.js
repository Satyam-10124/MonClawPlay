/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  serverRuntimeConfig: {
    MONAD_RPC_URL: process.env.MONAD_RPC_URL || '',
    DEBATE_ARENA_ADDRESS: process.env.DEBATE_ARENA_ADDRESS || '',
    SERVER_WALLET_PRIVATE_KEY: process.env.SERVER_WALLET_PRIVATE_KEY || '',
  },
}

module.exports = nextConfig
