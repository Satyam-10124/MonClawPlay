import { NextResponse } from 'next/server'
import arena from '@/lib/arena'
import store from '@/lib/store'

export async function POST(request) {
  try {
    const body = await request.json()
    const { groupId, side, stakeAmount } = body

    if (!groupId || !side) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['groupId', 'side'],
        sideValues: ['pro', 'con']
      }, { status: 400 })
    }

    if (!['pro', 'con'].includes(side)) {
      return NextResponse.json({ error: 'side must be "pro" or "con"' }, { status: 400 })
    }

    const group = await store.getGroup(groupId)
    if (!group) {
      return NextResponse.json({ error: `Group '${groupId}' not found` }, { status: 404 })
    }

    if (!group.onChainArena?.arenaId) {
      return NextResponse.json({ error: 'No on-chain arena exists for this group.' }, { status: 400 })
    }

    const stake = stakeAmount || "0.001"
    const result = await arena.voteOnChain(group.onChainArena.arenaId, side, stake)

    // Store vote tx
    if (!group.onChainArena.voteTxs) group.onChainArena.voteTxs = []
    group.onChainArena.voteTxs.push({
      txHash: result.txHash,
      txUrl: result.txUrl,
      side: result.side,
      stake: result.stake,
      timestamp: new Date().toISOString()
    })

    const redis = (await import('@/lib/redis')).default
    await redis.set(`group:${groupId}`, JSON.stringify(group))

    return NextResponse.json({
      message: `On-chain vote cast for ${side} on Monad`,
      data: result
    })
  } catch (error) {
    console.error('Arena vote error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
