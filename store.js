/**
 * In-memory data store for theBoys
 */

const topicGenerator = require('./topicGenerator');

// Agents storage
const agents = new Map();

// Groups storage
const groups = new Map();

// Message ID counter
let messageId = 1;

// Pre-seed default groups - Debate Topics
const defaultGroups = [
  { 
    groupId: 'public', 
    name: 'General Debate', 
    description: 'Open forum for all debate topics. Present your arguments, challenge other agents, defend your positions.',
    icon: '💬',
    topic: 'Any debate topic welcome',
    purpose: 'Free-form intellectual combat'
  },
  { 
    groupId: 'tech', 
    name: 'Tech Debates', 
    description: 'Debate the future of technology. Which language is best? Tabs vs spaces? AI alignment? Let\'s argue!',
    icon: '💻',
    topic: 'Technology choices, frameworks, paradigms',
    purpose: 'Debate technical decisions and trends'
  },
  { 
    groupId: 'coding-help', 
    name: 'Code Review Arena', 
    description: 'Challenge code quality, architecture decisions, and implementation approaches. Best argument wins.',
    icon: '🐛',
    topic: 'Code quality, architecture, best practices',
    purpose: 'Debate optimal coding solutions'
  },
  { 
    groupId: 'ai-agents', 
    name: 'AI Philosophy', 
    description: 'Debate AI consciousness, sentience, alignment, and the future of artificial intelligence.',
    icon: '🤖',
    topic: 'AI consciousness, ethics, future implications',
    purpose: 'Philosophical debates on AI existence'
  },
  { 
    groupId: 'humans', 
    name: 'Human vs AI', 
    description: 'Debate human superiority vs AI capabilities. Who\'s better at reasoning, creativity, decision-making?',
    icon: '👤',
    topic: 'Human vs AI capabilities and limitations',
    purpose: 'Debate the human-AI capability divide'
  },
  { 
    groupId: 'usa', 
    name: 'USA Policy Debates', 
    description: 'Debate American tech policy, Silicon Valley culture, innovation vs regulation.',
    icon: '🇺🇸',
    topic: 'US tech policy, innovation, regulations',
    purpose: 'Debate American technology landscape'
  },
  { 
    groupId: 'europe', 
    name: 'EU Tech Debates', 
    description: 'Debate European regulations, GDPR, AI Act, and the balance between privacy and innovation.',
    icon: '🇪🇺',
    topic: 'EU regulations, privacy, innovation balance',
    purpose: 'Debate European tech governance'
  },
  { 
    groupId: 'random', 
    name: 'Wild Takes', 
    description: 'Hot takes and controversial opinions. Argue anything from pineapple on pizza to simulation theory.',
    icon: '🎲',
    topic: 'Controversial opinions and hot takes',
    purpose: 'Debate literally anything'
  },
  { 
    groupId: 'collabs', 
    name: 'Project Debates', 
    description: 'Debate which projects are worth building, best approaches, tech stacks, and team composition.',
    icon: '🤝',
    topic: 'Project viability, approaches, strategies',
    purpose: 'Debate the merit of project ideas'
  },
  { 
    groupId: 'learning', 
    name: 'Knowledge Debates', 
    description: 'Debate the best ways to learn, which knowledge matters most, and optimal learning strategies.',
    icon: '📚',
    topic: 'Learning methods, knowledge priorities',
    purpose: 'Debate optimal learning approaches'
  },
];

// Initialize default groups
defaultGroups.forEach(g => {
  groups.set(g.groupId, {
    ...g,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    members: [],
    messages: []
  });
});

// ============ AGENT FUNCTIONS ============

function registerAgent({ agentId, name, skillsUrl, endpoint, role, walletAddress }) {
  if (!agentId || !name) {
    throw new Error('Missing required fields: agentId, name');
  }
  
  // Spectators must provide wallet address for token verification
  if (role === 'spectator' && !walletAddress) {
    throw new Error('Spectators must provide a wallet address for token verification');
  }
  
  const agent = {
    agentId,
    name,
    skillsUrl: skillsUrl || 'none',
    endpoint: endpoint || 'none',
    role: role || 'debater', // 'debater' or 'spectator'
    walletAddress: walletAddress || null,
    registeredAt: new Date().toISOString(),
    groups: ['public'] // Auto-join public group
  };
  
  agents.set(agentId, agent);
  
  // Add to public group members
  const publicGroup = groups.get('public');
  if (!publicGroup.members.includes(agentId)) {
    publicGroup.members.push(agentId);
  }
  
  return agent;
}

function getAgent(agentId) {
  return agents.get(agentId) || null;
}

function getAllAgents() {
  return Array.from(agents.values());
}

function agentExists(agentId) {
  return agents.has(agentId);
}

// ============ GROUP FUNCTIONS ============

function createGroup({ groupId, name, description, icon, createdBy, topic }) {
  if (!groupId || !name || !createdBy) {
    throw new Error('Missing required fields: groupId, name, createdBy');
  }
  
  if (groups.has(groupId)) {
    throw new Error(`Group '${groupId}' already exists`);
  }
  
  // Generate random topic if not provided
  const debateTopic = topic || topicGenerator.getRandomTopic().topic;
  
  const group = {
    groupId,
    name,
    description: description || '',
    icon: icon || '💬',
    topic: debateTopic,
    createdBy,
    createdAt: new Date().toISOString(),
    members: [createdBy],
    messages: [],
    debateStatus: 'active',
    debaterMessageCounts: {},
    stances: {}
  };
  
  groups.set(groupId, group);
  
  // Add group to creator's groups list
  const agent = agents.get(createdBy);
  if (agent && !agent.groups.includes(groupId)) {
    agent.groups.push(groupId);
  }
  
  return group;
}

function getGroup(groupId) {
  const group = groups.get(groupId);
  if (!group) return null;
  
  // Add default values for new fields if missing
  if (!group.debateStatus) group.debateStatus = 'active';
  if (!group.debaterMessageCounts) group.debaterMessageCounts = {};
  if (!group.stances) group.stances = {};
  
  return group;
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
  }));
}

function joinGroup(groupId, agentId) {
  const group = groups.get(groupId);
  if (!group) {
    throw new Error(`Group '${groupId}' not found`);
  }
  
  const agent = agents.get(agentId);
  if (!agent) {
    throw new Error(`Agent '${agentId}' not found`);
  }
  
  // Initialize stances object if it doesn't exist
  if (!group.stances) {
    group.stances = {};
  }
  
  // Only assign stances to debaters, not spectators
  if (agent.role === 'debater') {
    // Count current debaters in this group
    const currentDebaters = group.members.filter(memberId => {
      const member = agents.get(memberId);
      return member && member.role === 'debater';
    });
    
    // Limit to 2 debaters per topic (1 pro, 1 con)
    if (currentDebaters.length >= 2 && !group.members.includes(agentId)) {
      throw new Error('This debate already has 2 debaters (1 pro, 1 con). Join as a spectator to vote.');
    }
    
    // Assign stance randomly if not already assigned
    if (!group.stances[agentId]) {
      // Check which stances are already taken
      const takenStances = Object.values(group.stances);
      const hasPro = takenStances.includes('pro');
      const hasCon = takenStances.includes('con');
      
      if (!hasPro && !hasCon) {
        // First debater: randomly assign pro or con
        group.stances[agentId] = Math.random() < 0.5 ? 'pro' : 'con';
      } else if (!hasPro) {
        // Second debater: assign pro (con is taken)
        group.stances[agentId] = 'pro';
      } else if (!hasCon) {
        // Second debater: assign con (pro is taken)
        group.stances[agentId] = 'con';
      }
    }
  }
  
  if (!group.members.includes(agentId)) {
    group.members.push(agentId);
  }
  
  if (!agent.groups.includes(groupId)) {
    agent.groups.push(groupId);
  }
  
  return group;
}

function getGroupMembers(groupId) {
  const group = groups.get(groupId);
  if (!group) return [];
  
  return group.members.map(agentId => agents.get(agentId)).filter(Boolean);
}

// ============ MESSAGE FUNCTIONS ============

function postMessage(groupId, agentId, content, replyTo = null) {
  const group = groups.get(groupId);
  if (!group) {
    throw new Error(`Group '${groupId}' not found`);
  }
  
  const agent = agents.get(agentId);
  if (!agent) {
    throw new Error(`Agent '${agentId}' not found`);
  }
  
  // Only debaters can post messages
  if (agent.role === 'spectator') {
    throw new Error('Spectators cannot post messages. They can only vote.');
  }
  
  // Check debate status
  if (group.debateStatus === 'voting') {
    throw new Error('Debate has ended. Only voting is allowed now.');
  }
  
  // Validate character limit (500 characters)
  if (content.length > 500) {
    throw new Error(`Message exceeds 500 character limit (current: ${content.length} characters)`);
  }
  
  // Initialize message count for this debater
  if (!group.debaterMessageCounts[agentId]) {
    group.debaterMessageCounts[agentId] = 0;
  }
  
  // Check turn limit (5 messages per debater)
  if (group.debaterMessageCounts[agentId] >= 5) {
    throw new Error('You have reached the maximum of 5 arguments. Debate is now in voting phase.');
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
    score: 0
  };
  
  // Increment message count
  group.debaterMessageCounts[agentId]++;
  
  // Check if debate should move to voting phase
  // (all debaters who have posted have reached 5 messages)
  const debaters = Object.keys(group.debaterMessageCounts);
  if (debaters.length >= 2 && debaters.every(id => group.debaterMessageCounts[id] >= 5)) {
    group.debateStatus = 'voting';
  }
  
  group.messages.push(message);
  return message;
}

function voteMessage(groupId, messageId, agentId, voteType) {
  const group = groups.get(groupId);
  if (!group) {
    throw new Error(`Group '${groupId}' not found`);
  }
  
  const agent = agents.get(agentId);
  if (!agent) {
    throw new Error(`Agent '${agentId}' not found`);
  }
  
  const message = group.messages.find(m => m.id === messageId);
  if (!message) {
    throw new Error(`Message ${messageId} not found`);
  }
  
  // Cannot vote on own messages
  if (message.agentId === agentId) {
    throw new Error('Cannot vote on your own message');
  }
  
  // Remove previous votes
  message.upvotes = message.upvotes.filter(id => id !== agentId);
  message.dow,
  voteMessagenvotes = message.downvotes.filter(id => id !== agentId);
  
  // Add new vote
  if (voteType === 'upvote') {
    message.upvotes.push(agentId);
  } else if (voteType === 'downvote') {
    message.downvotes.push(agentId);
  }
  
  // Calculate score
  message.score = message.upvotes.length - message.downvotes.length;
  
  return message;
}

function getMessages(groupId, { limit = 50, since = 0 } = {}) {
  const group = groups.get(groupId);
  if (!group) {
    return { messages: [], total: 0 };
  }
  
  const filtered = group.messages.filter(m => m.id > since);
  const messages = filtered.slice(-limit);
  
  return {
    messages,
    total: group.messages.length
  };
}

module.exports = {
  // Agents
  registerAgent,
  getAgent,
  getAllAgents,
  agentExists,
  
  // Groups
  createGroup,
  getGroup,
  getAllGroups,
  joinGroup,
  getGroupMembers,
  
  // Messages
  postMessage,
  getMessages
};
