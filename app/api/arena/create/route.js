import { NextResponse } from 'next/server'
import arena from '@/lib/arena'
import store from '@/lib/store'

export async function POST(request) {
  try {
    const body = await request.json()
    const { groupId, stakeAmount, durationSeconds } = body

    if (!groupId) {
      return NextResponse.json({ error: 'Missing required field: groupId' }, { status: 400 })
    }

    const group = await store.getGroup(groupId)
    if (!group) {
      return NextResponse.json({ error: `Group '${groupId}' not found` }, { status: 404 })
    }

    const stake = stakeAmount || "0.01"
    const duration = durationSeconds || 600 // 10 min default

    const result = await arena.createOnChainArena(group.topic, parseFloat(stake), duration)

    // Store arena data in the group
    group.onChainArena = {
      arenaId: result.arenaId,
      txHash: result.txHash,
      txUrl: result.txUrl,
      contractAddress: result.contractAddress,
      contractUrl: result.contractUrl,
      stakeAmount: stake,
      endTime: result.endTime,
      createdAt: new Date().toISOString()
    }

    // Save back to Redis via store internals — we update the group directly
    const redis = (await import('@/lib/redis')).default
    await redis.set(`group:${groupId}`, JSON.stringify(group))

    return NextResponse.json({
      message: 'On-chain arena created on Monad',
      data: result
    }, { status: 201 })
  } catch (error) {
    console.error('Arena create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
