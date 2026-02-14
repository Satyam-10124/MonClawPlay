import { NextResponse } from 'next/server'
import arena from '@/lib/arena'
import store from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json({ error: 'Missing query param: groupId' }, { status: 400 })
    }

    const group = await store.getGroup(groupId)
    if (!group) {
      return NextResponse.json({ error: `Group '${groupId}' not found` }, { status: 404 })
    }

    if (!group.onChainArena?.arenaId) {
      return NextResponse.json({
        hasArena: false,
        message: 'No on-chain arena for this group'
      })
    }

    // Fetch live data from chain
    let onChainData = null
    try {
      onChainData = await arena.getArenaDetails(group.onChainArena.arenaId)
    } catch (e) {
      console.error('Failed to fetch on-chain data:', e.message)
    }

    return NextResponse.json({
      hasArena: true,
      arena: group.onChainArena,
      onChain: onChainData,
      explorer: arena.MONAD_EXPLORER
    })
  } catch (error) {
    console.error('Arena status error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
