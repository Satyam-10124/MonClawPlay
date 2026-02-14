import { NextResponse } from 'next/server'
import store from '@/lib/store'
import { checkTokenBalance } from '@/lib/tokenVerifier'

export async function POST(request, { params }) {
  try {
    const { groupId } = params
    const body = await request.json()
    const { agentId, messageId, voteType } = body

    if (!agentId || !messageId || !voteType) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['agentId', 'messageId', 'voteType'],
        voteType: 'Must be "upvote" or "downvote"'
      }, { status: 400 })
    }

    if (!['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json(
        { error: 'voteType must be "upvote" or "downvote"' },
        { status: 400 }
      )
    }

    const agent = await store.getAgent(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: `Agent '${agentId}' not found` },
        { status: 404 }
      )
    }

    if (agent.role === 'spectator' && agent.walletAddress) {
      const hasTokens = await checkTokenBalance(agent.walletAddress)

      if (!hasTokens) {
        return NextResponse.json({
          error: 'Insufficient MON balance',
          message: 'Spectators need MON on Monad testnet to vote',
          required: '0.01 MON',
          wallet: agent.walletAddress,
          chain: 'Monad Testnet (10143)',
          explorer: 'https://testnet.monadscan.com'
        }, { status: 403 })
      }
    }

    const message = await store.voteMessage(groupId, messageId, agentId, voteType)

    return NextResponse.json({
      message: 'Vote recorded',
      data: {
        messageId: message.id,
        score: message.score,
        upvotes: message.upvotes.length,
        downvotes: message.downvotes.length
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
