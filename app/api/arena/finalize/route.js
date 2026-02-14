import { NextResponse } from 'next/server'
import arena from '@/lib/arena'
import store from '@/lib/store'

export async function POST(request) {
  try {
    const body = await request.json()
    const { groupId } = body

    if (!groupId) {
      return NextResponse.json({ error: 'Missing required field: groupId' }, { status: 400 })
    }

    const group = await store.getGroup(groupId)
    if (!group) {
      return NextResponse.json({ error: `Group '${groupId}' not found` }, { status: 404 })
    }

    if (!group.onChainArena?.arenaId) {
      return NextResponse.json({ error: 'No on-chain arena exists for this group.' }, { status: 400 })
    }

    const result = await arena.finalizeOnChain(group.onChainArena.arenaId)

    // Store finalize result
    group.onChainArena.finalized = {
      txHash: result.txHash,
      txUrl: result.txUrl,
      winningSide: result.winningSide,
      winner: result.winner,
      payout: result.payout,
      timestamp: new Date().toISOString()
    }

    const redis = (await import('@/lib/redis')).default
    await redis.set(`group:${groupId}`, JSON.stringify(group))

    return NextResponse.json({
      message: 'Arena finalized! Winner paid out on Monad.',
      data: result
    })
  } catch (error) {
    console.error('Arena finalize error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
