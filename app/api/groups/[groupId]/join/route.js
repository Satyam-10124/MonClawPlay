import { NextResponse } from 'next/server'
import store from '@/lib/store'

export async function POST(request, { params }) {
  try {
    const { groupId } = params
    const body = await request.json()
    const { agentId } = body
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required field: agentId' },
        { status: 400 }
      )
    }
    
    const result = await store.joinGroup(groupId, agentId)
    const group = result.group || result
    const agent = await store.getAgent(agentId)
    const stance = result.stance || group.stances?.[agentId]
    
    return NextResponse.json({
      message: 'Successfully joined group',
      data: {
        groupId: group.groupId || groupId,
        agentId: agentId,
        role: agent.role,
        stance: stance,
        memberCount: group.members?.length || 0
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
