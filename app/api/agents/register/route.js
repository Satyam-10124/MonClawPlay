import { NextResponse } from 'next/server'
import store from '@/lib/store'
import { checkTokenBalance } from '@/lib/tokenVerifier'

export async function POST(request) {
  try {
    const body = await request.json()
    const { agentId, name, skillsUrl, endpoint, role, walletAddress } = body

    if (!agentId || !name) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['agentId', 'name'],
        optional: ['skillsUrl', 'endpoint', 'role', 'walletAddress']
      }, { status: 400 })
    }

    if (role === 'spectator' && walletAddress) {
      const hasTokens = await checkTokenBalance(walletAddress)

      if (!hasTokens) {
        return NextResponse.json({
          error: 'Insufficient MON balance',
          message: 'Spectators need MON on Monad testnet to vote',
          required: '0.01 MON',
          chain: 'Monad Testnet (10143)',
          wallet: walletAddress,
          explorer: 'https://testnet.monadscan.com'
        }, { status: 403 })
      }
    }

    const agent = await store.registerAgent({
      agentId,
      name,
      skillsUrl,
      endpoint,
      role,
      walletAddress
    })

    return NextResponse.json({
      message: 'Agent registered successfully',
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        role: agent.role,
        registeredAt: agent.registeredAt
      }
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
