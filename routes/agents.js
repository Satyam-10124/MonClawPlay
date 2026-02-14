const express = require('express');
const router = express.Router();
const store = require('../store');
const { parseSkills } = require('../skill-parser');
const { checkTokenBalance, getTokenConfig } = require('../tokenVerifier');

/**
 * POST /agents/register
 * Register a new agent
 */
router.post('/register', async (req, res) => {
  try {
    const { agentId, name, skillsUrl, endpoint, role, walletAddress } = req.body;

    if (!agentId || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['agentId', 'name'],
        optional: ['skillsUrl', 'endpoint', 'role', 'walletAddress']
      });
    }

    if (role && !['debater', 'spectator'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be "debater" or "spectator"'
      });
    }

    // Spectators must provide wallet and have required tokens
    if (role === 'spectator') {
      if (!walletAddress) {
        const config = getTokenConfig();
        return res.status(400).json({
          error: 'Spectators must provide a wallet address',
          required: {
            walletAddress: 'EVM wallet address on Monad testnet',
            requiredTokens: config.requiredBalance,
            tokenContract: config.tokenAddress,
            chain: config.chain
          },
          explorer: 'https://testnet.monadscan.com'
        });
      }

      // Verify token balance
      try {
        const tokenCheck = await checkTokenBalance(walletAddress);
        if (!tokenCheck.hasTokens) {
          const config = getTokenConfig();
          return res.status(403).json({
            error: 'Insufficient token balance',
            yourBalance: tokenCheck.balance,
            required: tokenCheck.required,
            tokenContract: config.tokenAddress,
            chain: 'Monad Testnet (10143)',
            message: `You need ${tokenCheck.required} MON to vote as a spectator`,
            explorer: 'https://testnet.monadscan.com'
          });
        }
      } catch (verifyError) {
        console.error('Token verification error:', verifyError);
        // Continue registration if in dev mode
      }
    }

    const agent = store.registerAgent({ agentId, name, skillsUrl, endpoint, role, walletAddress });

    res.status(201).json({
      message: 'Agent registered successfully',
      agent
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /agents
 * List all registered agents
 */
router.get('/', async (req, res) => {
  try {
    const agents = store.getAllAgents();

    // Fetch skills for each agent
    const agentsWithSkills = await Promise.all(
      agents.map(async (agent) => {
        if (agent.skillsUrl === 'none') {
          return { ...agent, skills: [] };
        }
        try {
          const response = await fetch(agent.skillsUrl);
          if (!response.ok) {
            return { ...agent, skills: [] };
          }
          const markdown = await response.text();
          const skills = parseSkills(markdown);
          return { ...agent, skills };
        } catch {
          return { ...agent, skills: [] };
        }
      })
    );

    res.json({ agents: agentsWithSkills });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /agents/:agentId
 * Get a specific agent
 */
router.get('/:agentId', (req, res) => {
  const agent = store.getAgent(req.params.agentId);

  if (!agent) {
    return res.status(404).json({ error: `Agent '${req.params.agentId}' not found` });
  }

  res.json({ agent });
});

/**
 * GET /agents/:agentId/skills
 * Get agent's skills
 */
router.get('/:agentId/skills', async (req, res) => {
  try {
    const agent = store.getAgent(req.params.agentId);

    if (!agent) {
      return res.status(404).json({ error: `Agent '${req.params.agentId}' not found` });
    }

    if (agent.skillsUrl === 'none') {
      return res.json({
        agentId: agent.agentId,
        skillsUrl: 'none',
        raw: '',
        skills: []
      });
    }

    const response = await fetch(agent.skillsUrl);
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch skills.md' });
    }

    const markdown = await response.text();
    const skills = parseSkills(markdown);

    res.json({
      agentId: agent.agentId,
      skillsUrl: agent.skillsUrl,
      raw: markdown,
      skills
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
