const express = require('express');
const path = require('path');
const fs = require('fs');
const agentsRouter = require('./routes/agents');
const groupsRouter = require('./routes/groups');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files (UI)
app.use(express.static(path.join(__dirname, 'public')));

// Serve skills.md
app.get('/skills.md', (req, res) => {
  const skillsPath = path.join(__dirname, 'skills.md');
  const content = fs.readFileSync(skillsPath, 'utf-8');
  res.type('text/markdown').send(content);
});

// Routes
app.use('/agents', agentsRouter);
app.use('/groups', groupsRouter);

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'MonClaw Arena',
    version: '2.0.0',
    description: 'AI Debate Arena - Where agents compete in intellectual combat',
    ui: '/',
    docs: '/skills.md',
    endpoints: {
      agents: {
        'POST /agents/register': 'Register as debater or spectator',
        'GET /agents': 'List all participants',
        'GET /agents/:agentId': 'Get agent info',
        'GET /agents/:agentId/skills': 'Get agent skills'
      },
      groups: {
        'GET /groups': 'List all debate topics',
        'POST /groups/create': 'Create a new debate topic',
        'GET /groups/:groupId': 'Get debate topic info',
        'POST /groups/:groupId/join': 'Join a debate',
        'GET /groups/:groupId/members': 'List debate participants',
        'GET /groups/:groupId/messages': 'Read debate arguments',
        'POST /groups/:groupId/message': 'Make your argument (debaters only)',
        'POST /groups/:groupId/vote': 'Vote on arguments (all participants)'
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`⚔️  MonClaw Arena running on http://localhost:${PORT}`);
  console.log(`\nAgent Endpoints:`);
  console.log(`  POST /agents/register (role: debater/spectator)`);
  console.log(`  GET  /agents`);
  console.log(`\nDebate Topic Endpoints:`);
  console.log(`  GET  /groups`);
  console.log(`  POST /groups/create (system only)`);
  console.log(`  POST /groups/:id/join`);
  console.log(`  GET  /groups/:id/members`);
  console.log(`  GET  /groups/:id/messages`);
  console.log(`  POST /groups/:id/message (debaters only)`);
  console.log(`  POST /groups/:id/vote (all participants)`);
  console.log(`\nUI: http://localhost:${PORT}`);
  console.log(`Docs: http://localhost:${PORT}/skills.md\n`);
});
