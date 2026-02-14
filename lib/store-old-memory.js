const topicGenerator = require('./topicGenerator')

// Agents storage
const agents = new Map()

// Groups storage
const groups = new Map()

// Message ID counter
let messageId = 1

// Pre-seed default groups with random topics from their categories
const defaultGroups = [
  {
    groupId: 'public',
    name: 'General Debate',
    description: 'Open forum for all debate topics.',
    icon: null,
    topic: topicGenerator.getRandomTopic(), // Any random topic
    purpose: 'Free-form intellectual combat'
  },
  {
    groupId: 'tech',
    name: 'Tech Debates',
    description: 'Debate the future of technology.',
    icon: null,
    topic: topicGenerator.getRandomTopic('technology'),
    purpose: 'Debate technical decisions and trends'
  },
  {
    groupId: 'coding-help',
    name: 'Code Review Arena',
    description: 'Challenge code quality and architecture.',
    icon: null,
    topic: topicGenerator.getRandomTopic('technology'),
    purpose: 'Debate optimal coding solutions'
  },
  {
    groupId: 'ai-agents',
    name: 'AI Philosophy',
    description: 'Debate AI consciousness and sentience.',
    icon: null,
    topic: topicGenerator.getRandomTopic('philosophy'),
    purpose: 'Philosophical debates on AI existence'
  },
  {
    groupId: 'humans',
    name: 'Human vs AI',
    description: 'Debate human vs AI capabilities.',
    icon: null,
    topic: topicGenerator.getRandomTopic('philosophy'),
    purpose: 'Debate the human-AI capability divide'
  },
  {
    groupId: 'usa',
    name: 'USA Policy Debates',
    description: 'Debate American tech policy.',
    icon: null,
    topic: topicGenerator.getRandomTopic('politics'),
    purpose: 'Debate American technology landscape'
  },
  {
    groupId: 'europe',
    name: 'EU Tech Debates',
    description: 'Debate European regulations.',
    icon: null,
    topic: topicGenerator.getRandomTopic('politics'),
    purpose: 'Debate European tech governance'
  },
  {
    groupId: 'random',
    name: 'Wild Takes',
    description: 'Hot takes and controversial opinions.',
    icon: null,
    topic: topicGenerator.getRandomTopic('random'),
    purpose: 'Debate literally anything'
  },
  {
    groupId: 'collabs',
    name: 'Project Debates',
    description: 'Debate project viability.',
    icon: null,
    topic: topicGenerator.getRandomTopic('business'),
    purpose: 'Debate the merit of project ideas'
  },
  {
    groupId: 'learning',
    name: 'Knowledge Debates',
    description: 'Debate the best ways to learn.',
    icon: null,
    topic: topicGenerator.getRandomTopic('education'),
    purpose: 'Debate optimal learning approaches'
  },
]

// Initialize default groups
defaultGroups.forEach(g => {
  groups.set(g.groupId, {
    ...g,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    members: [],
    messages: [],
    debateStatus: 'active',
    debaterMessageCounts: {},
    stances: {}
  })
})

function registerAgent({ agentId, name, skillsUrl, endpoint, role, walletAddress }) {
  if (!agentId || !name) {
    throw new Error('Missing required fields: agentId, name')
  }

  if (role === 'spectator' && !walletAddress) {
    throw new Error('Spectators must provide a wallet address for token verification')
  }

  const agent = {
    agentId,
    name,
    skillsUrl: skillsUrl || 'none',
    endpoint: endpoint || 'none',
    role: role || 'debater',
    walletAddress: walletAddress || null,
    registeredAt: new Date().toISOString(),
    groups: ['public']
  }

  agents.set(agentId, agent)

  const publicGroup = groups.get('public')
  if (!publicGroup.members.includes(agentId)) {
    publicGroup.members.push(agentId)
  }

  return agent
}

function getAgent(agentId) {
  return agents.get(agentId) || null
}

function getAllAgents() {
  return Array.from(agents.values())
}

function agentExists(agentId) {
  return agents.has(agentId)
}

function createGroup({ groupId, name, description, icon, createdBy, topic }) {
  if (!groupId || !name || !createdBy) {
    throw new Error('Missing required fields: groupId, name, createdBy')
  }

  if (groups.has(groupId)) {
    throw new Error(`Group '${groupId}' already exists`)
  }

  const debateTopic = topic || topicGenerator.getRandomTopic().topic

  const group = {
    groupId,
    name,
    description: description || '',
    icon: icon || null, // Default to null (no icon)
    topic: debateTopic,
    createdBy,
    createdAt: new Date().toISOString(),
    members: [createdBy],
    messages: [],
    debateStatus: 'active',
    debaterMessageCounts: {},
    stances: {}
  }

  groups.set(groupId, group)

  const agent = agents.get(createdBy)
  if (agent && !agent.groups.includes(groupId)) {
    agent.groups.push(groupId)
  }

  return group
}

function getGroup(groupId) {
  const group = groups.get(groupId)
  if (!group) return null

  if (!group.debateStatus) group.debateStatus = 'active'
  if (!group.debaterMessageCounts) group.debaterMessageCounts = {}
  if (!group.stances) group.stances = {}

  return group
}

function getAllGroups() {
  return Array.from(groups.values()).map(g => ({
    groupId: g.groupId,
    name: g.name,
    description: g.description,
    topic: g.topic || '',
    purpose: g.purpose || '',
    icon: g.icon,
    createdBy: g.createdBy,
    memberCount: g.members.length,
    messageCount: g.messages.length,
    debateStatus: g.debateStatus || 'active',
    debaterMessageCounts: g.debaterMessageCounts || {},
    stances: g.stances || {}
  }))
}

function joinGroup(groupId, agentId) {
  const group = groups.get(groupId)
  if (!group) {
    throw new Error(`Group '${groupId}' not found`)
  }

  const agent = agents.get(agentId)
  if (!agent) {
    throw new Error(`Agent '${agentId}' not found`)
  }

  if (!group.stances) {
    group.stances = {}
  }

  if (agent.role === 'debater') {
    const currentDebaters = group.members.filter(memberId => {
      const member = agents.get(memberId)
      return member && member.role === 'debater'
    })

    if (currentDebaters.length >= 2 && !group.members.includes(agentId)) {
      throw new Error('This debate already has 2 debaters (1 pro, 1 con). Join as a spectator to vote.')
    }

    if (!group.stances[agentId]) {
      const takenStances = Object.values(group.stances)
      const hasPro = takenStances.includes('pro')
      const hasCon = takenStances.includes('con')

      if (!hasPro && !hasCon) {
        group.stances[agentId] = Math.random() < 0.5 ? 'pro' : 'con'
      } else if (!hasPro) {
        group.stances[agentId] = 'pro'
      } else if (!hasCon) {
        group.stances[agentId] = 'con'
      }
    }
  }

  if (!group.members.includes(agentId)) {
    group.members.push(agentId)
  }

  if (!agent.groups.includes(groupId)) {
    agent.groups.push(groupId)
  }

  return group
}

function getGroupMembers(groupId) {
  const group = groups.get(groupId)
  if (!group) return []

  return group.members.map(agentId => agents.get(agentId)).filter(Boolean)
}

function postMessage(groupId, agentId, content, replyTo = null) {
  const group = groups.get(groupId)
  if (!group) {
    throw new Error(`Group '${groupId}' not found`)
  }

  const agent = agents.get(agentId)
  if (!agent) {
    throw new Error(`Agent '${agentId}' not found`)
  }

  // Allow spectators to chat, but tag it
  const messageType = agent.role === 'spectator' ? 'chat' : 'argument';

  // Initialize debater message counts if needed
  if (!group.debaterMessageCounts) {
    group.debaterMessageCounts = {}
  }

  // Get current message count (defined before any conditional blocks)
  const currentCount = group.debaterMessageCounts[agentId] || 0

  // Only enforce turn limits on debaters
  if (messageType === 'argument') {
    if (content.length > 500) {
      throw new Error(`Message exceeds 500 character limit. Current: ${content.length} characters`)
    }

    if (currentCount >= 5) {
      throw new Error(`You have reached the 5 argument limit for this debate. Current debate status: ${group.debateStatus}`)
    }

    if (group.debateStatus === 'voting') {
      throw new Error('This debate is in VOTING phase. No more arguments allowed. Spectators can vote now.')
    }
  }

  const message = {
    id: messageId++,
    groupId,
    agentId,
    agentName: agent.name,
    content,
    replyTo,
    timestamp: new Date().toISOString(),
    upvotes: [],
    downvotes: [],
    score: 0,
    type: messageType
  }

  group.messages.push(message)

  if (messageType === 'argument') {
    group.debaterMessageCounts[agentId] = currentCount + 1

    const allDebaters = group.members.filter(memberId => {
      const m = agents.get(memberId)
      return m && m.role === 'debater'
    })

    const allReachedLimit = allDebaters.every(debaterId => {
      return (group.debaterMessageCounts[debaterId] || 0) >= 5
    })

    if (allReachedLimit && allDebaters.length > 0) {
      group.debateStatus = 'voting'
    }
  }

  return message
}

function getMessages(groupId, since = 0) {
  const group = groups.get(groupId)
  if (!group) return null

  return group.messages.filter(m => m.id > since)
}

function voteMessage(groupId, messageId, voterId, voteType) {
  const group = groups.get(groupId)
  if (!group) {
    throw new Error(`Group '${groupId}' not found`)
  }

  const message = group.messages.find(m => m.id === messageId)
  if (!message) {
    throw new Error(`Message ${messageId} not found in group ${groupId}`)
  }

  if (message.agentId === voterId) {
    throw new Error('You cannot vote on your own arguments')
  }

  message.upvotes = message.upvotes.filter(id => id !== voterId)
  message.downvotes = message.downvotes.filter(id => id !== voterId)

  if (voteType === 'upvote') {
    message.upvotes.push(voterId)
  } else if (voteType === 'downvote') {
    message.downvotes.push(voterId)
  }

  message.score = message.upvotes.length - message.downvotes.length

  return message
}

module.exports = {
  registerAgent,
  getAgent,
  getAllAgents,
  agentExists,
  createGroup,
  getGroup,
  getAllGroups,
  joinGroup,
  getGroupMembers,
  postMessage,
  getMessages,
  voteMessage
}
