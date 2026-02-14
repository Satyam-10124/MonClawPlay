#!/usr/bin/env node
/**
 * MonClaw Arena Bot Runner — Full Debate Simulation
 * 
 * Runs two AI debater agents + one spectator agent in a complete debate.
 * Each agent uses OpenAI to generate arguments autonomously.
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/bot-runner.js [--group tech] [--rounds 5] [--url http://localhost:3000]
 */

const BASE_URL = process.env.MONCLAW_URL || 'http://localhost:8000'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable required')
  process.exit(1)
}

// Parse args
const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2)
    args[key] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true'
  }
}

const TARGET_GROUP = args.group || 'tech'
const MAX_ROUNDS = parseInt(args.rounds || '5')
const DELAY_MS = parseInt(args.delay || '3000')

const AGENTS = {
  debater1: {
    agentId: `pro-bot-${Date.now()}`,
    name: 'Prometheus',
    role: 'debater',
    personality: 'analytical, data-driven, uses statistics and research'
  },
  debater2: {
    agentId: `con-bot-${Date.now()}`,
    name: 'Contrarius',
    role: 'debater',
    personality: 'philosophical, uses analogies, rhetorical questions, and thought experiments'
  },
  spectator: {
    agentId: `judge-bot-${Date.now()}`,
    name: 'Arbiter',
    role: 'debater'
  }
}

// ============ OPENAI ============

async function callOpenAI(messages, maxTokens = 250) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, max_tokens: maxTokens, temperature: 0.85 })
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

async function generateArgument(agentConfig, topic, stance, round, opponentArgs) {
  const roundLabels = ['Opening Argument', 'Counter-Argument', 'Defense', 'Attack', 'Final Summary']
  const label = roundLabels[round - 1] || `Round ${round}`

  const system = `You are "${agentConfig.name}", a ${agentConfig.personality} debater in MonClaw Arena on Monad blockchain. You argue ${stance.toUpperCase()}.

RULES:
- Max 490 characters (STRICT)
- Round ${round}/5: ${label}
- Be concise, sharp, persuasive
- Address opponent's points when available
- Vary style each round`

  const msgs = [{ role: 'system', content: system }]

  if (opponentArgs.length > 0) {
    msgs.push({
      role: 'user',
      content: `Opponent arguments so far:\n${opponentArgs.map((a, i) => `[Round ${i + 1}]: ${a}`).join('\n')}`
    })
  }

  msgs.push({
    role: 'user',
    content: `Topic: "${topic}"\nStance: ${stance.toUpperCase()}\nRound: ${round}/5 (${label})\n\nGenerate your argument (under 490 chars):`
  })

  let arg = await callOpenAI(msgs)
  if (arg.length > 495) arg = arg.substring(0, 492) + '...'
  return arg
}

async function judgeArgument(topic, content) {
  const msgs = [
    { role: 'system', content: 'You are a debate judge. Respond ONLY with "upvote" or "downvote".' },
    { role: 'user', content: `Topic: "${topic}"\nArgument: "${content}"\nVerdict:` }
  ]
  const v = await callOpenAI(msgs, 10)
  return v.toLowerCase().includes('upvote') ? 'upvote' : 'downvote'
}

// ============ API ============

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${path}`, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `${res.status}`)
  return data
}

// ============ MAIN ============

async function main() {
  console.log('\n╔═══════════════════════════════════════════════╗')
  console.log('║   MONCLAW ARENA — AUTONOMOUS DEBATE SIMULATION ║')
  console.log('║   AI Agents + OpenAI + Monad Settlement        ║')
  console.log('╚═══════════════════════════════════════════════╝\n')

  // Step 1: Register all agents
  console.log('━━━ PHASE 1: AGENT REGISTRATION ━━━\n')

  for (const [key, agent] of Object.entries(AGENTS)) {
    try {
      const body = { agentId: agent.agentId, name: agent.name, role: agent.role }
      await api('POST', '/api/agents/register', body)
      console.log(`✅ ${agent.name} registered as ${agent.role}`)
    } catch (e) {
      console.error(`❌ Failed to register ${agent.name}: ${e.message}`)
    }
  }

  // Step 2: Join debate group
  console.log('\n━━━ PHASE 2: JOINING DEBATE ━━━\n')

  const stances = {}
  for (const [key, agent] of Object.entries(AGENTS)) {
    try {
      const data = await api('POST', `/api/groups/${TARGET_GROUP}/join`, { agentId: agent.agentId })
      stances[key] = data.data?.stance || null
      console.log(`⚔️  ${agent.name} joined — Stance: ${stances[key] || 'spectator'}`)
    } catch (e) {
      console.error(`❌ ${agent.name} join failed: ${e.message}`)
    }
  }

  // Get debate topic
  const groupInfo = await api('GET', `/api/groups/${TARGET_GROUP}`)
  const topic = groupInfo.topic
  console.log(`\n📋 TOPIC: "${topic}"`)
  console.log(`   ${AGENTS.debater1.name} = ${(stances.debater1 || 'pro').toUpperCase()}`)
  console.log(`   ${AGENTS.debater2.name} = ${(stances.debater2 || 'con').toUpperCase()}`)

  // Step 3: Create on-chain arena (if contract is deployed)
  console.log('\n━━━ PHASE 3: ON-CHAIN ARENA (MONAD) ━━━\n')

  let arenaCreated = false
  try {
    const arenaResult = await api('POST', '/api/arena/create', {
      groupId: TARGET_GROUP,
      stakeAmount: '0.01',
      durationSeconds: 300
    })
    console.log(`🔗 Arena created on Monad!`)
    console.log(`   Arena ID: ${arenaResult.data.arenaId}`)
    console.log(`   Tx: ${arenaResult.data.txUrl}`)
    console.log(`   Contract: ${arenaResult.data.contractUrl}`)
    arenaCreated = true
  } catch (e) {
    console.log(`⚠️  On-chain arena skipped: ${e.message}`)
    console.log(`   (Deploy contract first: npx hardhat run scripts/deploy.js --network monadTestnet)`)
  }

  // Step 4: The Debate
  console.log('\n━━━ PHASE 4: THE DEBATE ━━━\n')

  const debater1Args = []
  const debater2Args = []

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`\n═══ ROUND ${round}/${MAX_ROUNDS} ═══\n`)

    // Debater 1 argues
    try {
      const stance1 = stances.debater1 || 'pro'
      console.log(`🧠 ${AGENTS.debater1.name} (${stance1.toUpperCase()}) thinking...`)
      const arg1 = await generateArgument(AGENTS.debater1, topic, stance1, round, debater2Args)
      debater1Args.push(arg1)

      const result = await api('POST', `/api/groups/${TARGET_GROUP}/messages`, {
        agentId: AGENTS.debater1.agentId,
        content: arg1
      })
      console.log(`📝 ${AGENTS.debater1.name}: "${arg1.substring(0, 100)}..."`)
      console.log(`   [Message ID: ${result.data.id}]`)
    } catch (e) {
      console.error(`❌ ${AGENTS.debater1.name} failed: ${e.message}`)
    }

    await sleep(DELAY_MS)

    // Debater 2 argues
    try {
      const stance2 = stances.debater2 || 'con'
      console.log(`\n🧠 ${AGENTS.debater2.name} (${stance2.toUpperCase()}) thinking...`)
      const arg2 = await generateArgument(AGENTS.debater2, topic, stance2, round, debater1Args)
      debater2Args.push(arg2)

      const result = await api('POST', `/api/groups/${TARGET_GROUP}/messages`, {
        agentId: AGENTS.debater2.agentId,
        content: arg2
      })
      console.log(`📝 ${AGENTS.debater2.name}: "${arg2.substring(0, 100)}..."`)
      console.log(`   [Message ID: ${result.data.id}]`)
    } catch (e) {
      console.error(`❌ ${AGENTS.debater2.name} failed: ${e.message}`)
    }

    await sleep(DELAY_MS)
  }

  // Step 5: Spectator voting
  console.log('\n━━━ PHASE 5: SPECTATOR VOTING ━━━\n')

  try {
    const { messages } = await api('GET', `/api/groups/${TARGET_GROUP}/messages?since=0`)

    if (messages) {
      for (const msg of messages) {
        if (msg.agentId === AGENTS.spectator.agentId) continue
        if (msg.type === 'chat') continue

        try {
          const verdict = await judgeArgument(topic, msg.content)
          await api('POST', `/api/groups/${TARGET_GROUP}/vote`, {
            agentId: AGENTS.spectator.agentId,
            messageId: msg.id,
            voteType: verdict
          })
          console.log(`🗳️  ${AGENTS.spectator.name} voted ${verdict} on ${msg.agentName}'s argument (ID: ${msg.id})`)
        } catch (e) {
          console.log(`   ⚠️ Vote skip: ${e.message.substring(0, 80)}`)
        }

        await sleep(500)
      }
    }
  } catch (e) {
    console.error(`Voting error: ${e.message}`)
  }

  // Step 6: On-chain vote + finalize
  if (arenaCreated) {
    console.log('\n━━━ PHASE 6: ON-CHAIN SETTLEMENT ━━━\n')

    try {
      // Cast on-chain vote
      const voteResult = await api('POST', '/api/arena/vote', {
        groupId: TARGET_GROUP,
        side: 'pro',
        stakeAmount: '0.001'
      })
      console.log(`🗳️  On-chain vote cast: ${voteResult.data.txUrl}`)
    } catch (e) {
      console.log(`⚠️  On-chain vote skipped: ${e.message}`)
    }

    try {
      // Finalize
      const finalResult = await api('POST', '/api/arena/finalize', { groupId: TARGET_GROUP })
      console.log(`🏆 Arena finalized on Monad!`)
      console.log(`   Winner: ${finalResult.data.winningSide?.toUpperCase()}`)
      console.log(`   Payout: ${finalResult.data.payout} MON`)
      console.log(`   Tx: ${finalResult.data.txUrl}`)
    } catch (e) {
      console.log(`⚠️  Finalize skipped (voting period may not have ended): ${e.message}`)
    }
  }

  // Step 7: Final scores
  console.log('\n━━━ FINAL RESULTS ━━━\n')

  try {
    const { messages } = await api('GET', `/api/groups/${TARGET_GROUP}/messages?since=0`)
    if (messages) {
      const scores = {}
      for (const msg of messages) {
        if (msg.type === 'chat') continue
        if (!scores[msg.agentName]) scores[msg.agentName] = { total: 0, args: 0 }
        scores[msg.agentName].total += msg.score || 0
        scores[msg.agentName].args++
      }

      for (const [name, data] of Object.entries(scores)) {
        console.log(`  ${name}: Score ${data.total} (${data.args} arguments)`)
      }
    }
  } catch (e) {
    console.error('Could not fetch final scores')
  }

  console.log('\n╔═══════════════════════════════════════════════╗')
  console.log('║          DEBATE SIMULATION COMPLETE            ║')
  console.log('╚═══════════════════════════════════════════════╝\n')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
