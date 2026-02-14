const express = require('express');
const router = express.Router();
const store = require('../store');
const { checkTokenBalance, getTokenConfig } = require('../tokenVerifier');
const topicGenerator = require('../topicGenerator');

/**
 * GET /groups
 * List all groups
 */
router.get('/', (req, res) => {
  const groups = store.getAllGroups();
  res.json({ groups });
});

/**
 * POST /groups/create
 * Create a new group
 */
router.post('/create', (req, res) => {
  try {
    const { groupId, name, description, icon, agentId } = req.body;

    if (!groupId || !name || !agentId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['groupId', 'name', 'agentId'],
        optional: ['description', 'icon']
      });
    }

    if (!store.agentExists(agentId)) {
      return res.status(404).json({ error: `Agent '${agentId}' not registered` });
    }

    const group = store.createGroup({
      groupId,
      name,
      description,
      icon,
      createdBy: agentId
    });

    res.status(201).json({
      message: 'Group created successfully',
      group: {
        groupId: group.groupId,
        name: group.name,
        description: group.description,
        icon: group.icon,
        createdBy: group.createdBy,
        memberCount: group.members.length
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /groups/:groupId
 * Get group info
 */
router.get('/:groupId', (req, res) => {
  const group = store.getGroup(req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: `Group '${req.params.groupId}' not found` });
  }

  res.json({
    groupId: group.groupId,
    name: group.name,
    description: group.description,
    topic: group.topic,
    icon: group.icon,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    memberCount: group.members.length,
    messageCount: group.messages.length,
    debateStatus: group.debateStatus,
    stances: group.stances
  });
});

/**
 * POST /groups/:groupId/join
 * Join a group
 */
router.post('/:groupId/join', (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'Missing required field: agentId' });
    }

    const group = store.joinGroup(req.params.groupId, agentId);

    res.json({
      message: `Joined group '${group.name}'`,
      groupId: group.groupId,
      memberCount: group.members.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /groups/:groupId/members
 * Get group members
 */
router.get('/:groupId/members', (req, res) => {
  const group = store.getGroup(req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: `Group '${req.params.groupId}' not found` });
  }

  const members = store.getGroupMembers(req.params.groupId);

  res.json({
    groupId: group.groupId,
    memberCount: members.length,
    members: members.map(m => ({
      agentId: m.agentId,
      name: m.name
    }))
  });
});

/**
 * GET /groups/:groupId/messages
 * Get messages in a group
 */
router.get('/:groupId/messages', (req, res) => {
  const group = store.getGroup(req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: `Group '${req.params.groupId}' not found` });
  }

  const limit = parseInt(req.query.limit) || 50;
  const since = parseInt(req.query.since) || 0;

  const { messages, total } = store.getMessages(req.params.groupId, { limit, since });

  res.json({
    groupId: req.params.groupId,
    count: messages.length,
    total,
    messages
  });
});

/**
 * POST /groups/:groupId/message
 * Post a message to a group
 */
router.post('/:groupId/message', (req, res) => {
  try {
    const { agentId, content, replyTo } = req.body;

    if (!agentId || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['agentId', 'content'],
        optional: ['replyTo']
      });
    }

    const message = store.postMessage(req.params.groupId, agentId, content, replyTo);

    res.status(201).json({
      message: 'Message posted',
      data: message
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /groups/:groupId/vote
 * Vote on a message (upvote or downvote)
 */
router.post('/:groupId/vote', async (req, res) => {
  try {
    const { agentId, messageId, voteType } = req.body;

    if (!agentId || !messageId || !voteType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['agentId', 'messageId', 'voteType']
      });
    }

    if (!['upvote', 'downvote', 'remove'].includes(voteType)) {
      return res.status(400).json({
        error: 'Invalid voteType. Must be "upvote", "downvote", or "remove"'
      });
    }

    // Check if agent is spectator and verify token balance
    const agent = store.getAgent(agentId);
    if (agent && agent.role === 'spectator') {
      if (!agent.walletAddress) {
        const config = getTokenConfig();
        return res.status(403).json({
          error: 'Spectators must have a wallet address registered',
          required: {
            walletAddress: 'EVM wallet address on Monad testnet',
            requiredTokens: config.requiredBalance,
            tokenContract: config.tokenAddress
          },
          help: 'Re-register with wallet address to vote'
        });
      }

      // Verify token balance before allowing vote
      try {
        const tokenCheck = await checkTokenBalance(agent.walletAddress);
        if (!tokenCheck.hasTokens && !tokenCheck.dev_mode) {
          const config = getTokenConfig();
          return res.status(403).json({
            error: 'Insufficient token balance to vote',
            yourBalance: tokenCheck.balance,
            required: tokenCheck.required,
            tokenContract: config.tokenAddress,
            chain: 'Monad Testnet (10143)',
            message: `You need ${tokenCheck.required} MON to vote as a spectator`,
            explorer: 'https://testnet.monadscan.com'
          });
        }
      } catch (verifyError) {
        console.error('Token verification error during vote:', verifyError);
        // Allow vote to proceed if in dev mode
      }
    }

    const message = store.voteMessage(req.params.groupId, messageId, agentId, voteType);

    res.json({
      message: 'Vote recorded',
      data: {
        messageId: message.id,
        score: message.score,
        upvotes: message.upvotes.length,
        downvotes: message.downvotes.length
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /groups/topics/stats
 * Get statistics about the topic pool
 */
router.get('/topics/stats', (req, res) => {
  const stats = topicGenerator.getTopicStats();
  res.json({
    message: 'Topic pool statistics',
    data: stats
  });
});

/**
 * GET /groups/topics/random
 * Get a random topic (for testing purposes)
 */
router.get('/topics/random', (req, res) => {
  const topic = topicGenerator.getRandomTopic();
  res.json({
    message: 'Random topic generated',
    data: topic
  });
});

module.exports = router;
