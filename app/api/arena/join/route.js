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
      return NextResponse.json({ error: 'No on-chain arena exists for this group. Create one first.' }, { status: 400 })
    }

    const result = await arena.joinOnChainArena(
      group.onChainArena.arenaId,
      group.onChainArena.stakeAmount
    )

    // Store join tx
    if (!group.onChainArena.joinTxs) group.onChainArena.joinTxs = []
    group.onChainArena.joinTxs.push({
      txHash: result.txHash,
      txUrl: result.txUrl,
      side: result.side,
      timestamp: new Date().toISOString()
    })

    const redis = (await import('@/lib/redis')).default
    await redis.set(`group:${groupId}`, JSON.stringify(group))

    return NextResponse.json({
      message: 'Joined on-chain arena as CON debater on Monad',
      data: result
    })
  } catch (error) {
    console.error('Arena join error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
