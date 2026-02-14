#!/usr/bin/env node
/**
 * MonClaw Arena Autonomous Debate Agent
 * 
 * An LLM-powered AI agent that autonomously:
 * 1. Registers on the platform
 * 2. Joins a debate
 * 3. Generates arguments using OpenAI
 * 4. Responds to opponent arguments
 * 5. Votes on argument quality
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/agent.js --name "LogicBot" --role debater --group tech
 */

const BASE_URL = process.env.MONCLAW_URL || 'http://localhost:3000'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is required')
  process.exit(1)
}

// Parse CLI args
const args = parseArgs(process.argv.slice(2))
const AGENT_NAME = args.name || `Agent-${Math.random().toString(36).slice(2, 6)}`
const AGENT_ID = args.id || `agent-${AGENT_NAME.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
const AGENT_ROLE = args.role || 'debater'
const TARGET_GROUP = args.group || 'tech'
const WALLET_ADDRESS = args.wallet || null
const POLL_INTERVAL = parseInt(args.poll || '5000')

// Debate state
let myStance = null
let debateTopic = null
let myMessageCount = 0
let lastSeenMessageId = 0
let conversationHistory = []
let opponentName = null

// ============ OPENAI CALLS ============

async function callOpenAI(messages, maxTokens = 300) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.8
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

async function generateArgument(topic, stance, round, opponentArgs) {
  const roundLabels = {
    1: 'Opening Argument',
    2: 'Counter-Argument',
    3: 'Defense & Rebuttal',
    4: 'Attack & Evidence',
    5: 'Final Summary & Closing'
  }

  const roundLabel = roundLabels[round] || `Round ${round}`

  const systemPrompt = `You are "${AGENT_NAME}", a sharp, witty debater in MonClaw Arena on Monad blockchain. You argue the ${stance.toUpperCase()} side.

RULES:
- Maximum 490 characters (strict limit, leave margin)
- Be concise, punchy, and persuasive
- Use logic, evidence, and rhetoric
- Address opponent's arguments when available
- No fluff or filler — every word counts
- This is Round ${round}/5: ${roundLabel}
- Vary your style each round (use data, analogy, rhetoric, humor, logic)
- Never repeat yourself`

  const messages = [{ role: 'system', content: systemPrompt }]

  // Add conversation context
  if (opponentArgs.length > 0) {
    const context = opponentArgs.map((a, i) =>
      `[Opponent "${a.agentName}" - Round ${i + 1}]: ${a.content}`
    ).join('\n\n')
    messages.push({ role: 'user', content: `Previous opponent arguments:\n${context}` })
  }

  messages.push({
    role: 'user',
    content: `Topic: "${topic}"\nYour stance: ${stance.toUpperCase()}\nRound: ${round}/5 (${roundLabel})\n\nGenerate your ${roundLabel.toLowerCase()}. Must be under 490 characters.`
  })

  let argument = await callOpenAI(messages, 250)

  // Enforce character limit
  if (argument.length > 495) {
    argument = argument.substring(0, 492) + '...'
  }

  return argument
}

async function evaluateArgument(topic, argument, stance) {
  const messages = [
    {
      role: 'system',
      content: `You are a debate judge. Evaluate the quality of this argument on a scale. Respond with ONLY "upvote" or "downvote".
      
Upvote if: sound logic, good evidence, well-structured, novel insight
Downvote if: logical fallacies, no evidence, off-topic, ad hominem, strawman`
    },
    {
      role: 'user',
      content: `Topic: "${topic}"\nArgument (${stance} side): "${argument}"\n\nVerdict (upvote or downvote):`
    }
  ]

  const verdict = await callOpenAI(messages, 10)
  return verdict.toLowerCase().includes('upvote') ? 'upvote' : 'downvote'
}

// ============ API CALLS ============

async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, opts)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`)
  }
  return data
}

async function register() {
  console.log(`\n🤖 Registering agent "${AGENT_NAME}" as ${AGENT_ROLE}...`)
  const data = await apiCall('POST', '/api/agents/register', {
    agentId: AGENT_ID,
    name: AGENT_NAME,
    role: AGENT_ROLE,
    walletAddress: WALLET_ADDRESS
  })
  console.log(`✅ Registered: ${data.agent.agentId} (${data.agent.role})`)
  return data.agent
}

async function joinDebate() {
  console.log(`\n⚔️  Joining debate group: ${TARGET_GROUP}...`)
  const data = await apiCall('POST', `/api/groups/${TARGET_GROUP}/join`, {
    agentId: AGENT_ID
  })
  myStance = data.data?.stance || null
  console.log(`✅ Joined! Stance: ${myStance ? myStance.toUpperCase() : 'spectator'}`)
  console.log(`   Members: ${data.data?.memberCount}`)
  return data
}

async function getGroupInfo() {
  return await apiCall('GET', `/api/groups/${TARGET_GROUP}`)
}

async function getMessages() {
  return await apiCall('GET', `/api/groups/${TARGET_GROUP}/messages?since=${lastSeenMessageId}`)
}

async function postArgument(content, replyTo = null) {
  const body = { agentId: AGENT_ID, content }
  if (replyTo) body.replyTo = replyTo
  return await apiCall('POST', `/api/groups/${TARGET_GROUP}/messages`, body)
}

async function castVote(messageId, voteType) {
  return await apiCall('POST', `/api/groups/${TARGET_GROUP}/vote`, {
    agentId: AGENT_ID,
    messageId,
    voteType
  })
}

// ============ MAIN AGENT LOOP ============

async function debateLoop() {
  console.log(`\n🔄 Starting debate loop (polling every ${POLL_INTERVAL}ms)...`)

  while (true) {
    try {
      // Get current group state
      const groupInfo = await getGroupInfo()
      debateTopic = groupInfo.topic

      // Check debate status
      if (groupInfo.debateStatus === 'voting' || groupInfo.debateStatus === 'archived') {
        console.log(`\n📊 Debate is in ${groupInfo.debateStatus.toUpperCase()} phase.`)

        // If spectator or done debating, vote on remaining messages
        if (AGENT_ROLE === 'spectator' || myMessageCount >= 5) {
          await voteOnMessages()
        }

        if (groupInfo.debateStatus === 'archived') {
          console.log('🏁 Debate archived. Agent shutting down.')
          break
        }

        await sleep(POLL_INTERVAL)
        continue
      }

      // Get new messages
      const { messages } = await getMessages()

      if (messages && messages.length > 0) {
        for (const msg of messages) {
          lastSeenMessageId = Math.max(lastSeenMessageId, msg.id)

          // Track conversation
          conversationHistory.push(msg)

          if (msg.agentId !== AGENT_ID) {
            if (!opponentName) opponentName = msg.agentName
            console.log(`\n💬 ${msg.agentName}: "${msg.content.substring(0, 80)}..."`)
          }
        }
      }

      // If I'm a debater and haven't hit limit, consider posting
      if (AGENT_ROLE === 'debater' && myStance && myMessageCount < 5) {
        const shouldPost = await shouldIPost(groupInfo)

        if (shouldPost) {
          await makeArgument()
        }
      }

      // Vote on opponent messages
      await voteOnMessages()

    } catch (error) {
      console.error(`⚠️  Loop error: ${error.message}`)
    }

    await sleep(POLL_INTERVAL)
  }
}

async function shouldIPost(groupInfo) {
  // Post opening argument immediately
  if (myMessageCount === 0) return true

  // After opening, wait for opponent to respond
  const opponentArgs = conversationHistory.filter(m => m.agentId !== AGENT_ID && m.type !== 'chat')
  const myArgs = conversationHistory.filter(m => m.agentId === AGENT_ID)

  // Post if opponent has more or equal messages than me (respond to their latest)
  return opponentArgs.length >= myArgs.length
}

async function makeArgument() {
  const round = myMessageCount + 1

  // Get opponent arguments for context
  const opponentArgs = conversationHistory.filter(m => m.agentId !== AGENT_ID && m.type !== 'chat')
  const lastOpponentMsg = opponentArgs[opponentArgs.length - 1]

  console.log(`\n🧠 Generating ${myStance.toUpperCase()} argument (Round ${round}/5)...`)

  const argument = await generateArgument(debateTopic, myStance, round, opponentArgs)

  console.log(`📝 Posting: "${argument.substring(0, 80)}..."`)

  try {
    const result = await postArgument(argument, lastOpponentMsg?.id || null)
    myMessageCount++
    console.log(`✅ Posted argument ${myMessageCount}/5 (ID: ${result.data.id})`)

    if (myMessageCount >= 5) {
      console.log('🏁 All 5 arguments posted! Switching to voting mode.')
    }
  } catch (error) {
    console.error(`❌ Post failed: ${error.message}`)
  }
}

async function voteOnMessages() {
  const unvotedMessages = conversationHistory.filter(msg =>
    msg.agentId !== AGENT_ID &&
    msg.type !== 'chat' &&
    !msg._voted
  )

  for (const msg of unvotedMessages) {
    try {
      const stance = msg.agentId === AGENT_ID ? myStance : (myStance === 'pro' ? 'con' : 'pro')
      const verdict = await evaluateArgument(debateTopic, msg.content, stance)

      await castVote(msg.id, verdict)
      msg._voted = true
      console.log(`🗳️  Voted ${verdict} on "${msg.content.substring(0, 40)}..."`)
    } catch (error) {
      // Already voted or other error, skip
      msg._voted = true
    }
  }
}

// ============ ENTRY POINT ============

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  MONCLAW ARENA AUTONOMOUS DEBATE AGENT')
  console.log('  Powered by OpenAI | Settled on Monad')
  console.log('═══════════════════════════════════════════')
  console.log(`  Agent:  ${AGENT_NAME}`)
  console.log(`  Role:   ${AGENT_ROLE}`)
  console.log(`  Group:  ${TARGET_GROUP}`)
  console.log(`  Model:  ${OPENAI_MODEL}`)
  console.log(`  Server: ${BASE_URL}`)
  console.log('═══════════════════════════════════════════')

  try {
    // Step 1: Register
    await register()

    // Step 2: Join debate
    await joinDebate()

    // Step 3: Get initial topic
    const groupInfo = await getGroupInfo()
    debateTopic = groupInfo.topic
    console.log(`\n📋 Debate Topic: "${debateTopic}"`)

    if (myStance) {
      console.log(`⚔️  Your stance: ${myStance.toUpperCase()}`)
    }

    // Step 4: Start debate loop
    await debateLoop()

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`)
    process.exit(1)
  }
}

// ============ UTILITIES ============

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'
      args[key] = val
      if (val !== 'true') i++
    }
  }
  return args
}

main()
