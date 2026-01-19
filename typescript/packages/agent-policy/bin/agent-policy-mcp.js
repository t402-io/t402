#!/usr/bin/env node

/**
 * Agent Policy MCP Server CLI
 *
 * Run the agent-policy MCP server for Claude Desktop and other AI agents.
 *
 * Usage:
 *   npx @t402-internal/agent-policy
 *   agent-policy-mcp
 *
 * Environment Variables:
 *   AGENT_POLICY_DEMO_MODE   - Set to "true" to enable demo mode
 *   AGENT_POLICY_REDIS_URL   - Redis URL for persistent limit storage
 *   AGENT_POLICY_ORG_ID      - Default organization ID
 *
 * Claude Desktop Configuration:
 *   Add to ~/.config/Claude/claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "agent-policy": {
 *         "command": "node",
 *         "args": ["/path/to/agent-policy-mcp.js"],
 *         "env": {
 *           "AGENT_POLICY_DEMO_MODE": "true"
 *         }
 *       }
 *     }
 *   }
 */

import { createServerFromEnv } from '../dist/mcp/index.js';

async function main() {
  // Load configuration from environment
  const demoMode = process.env.AGENT_POLICY_DEMO_MODE === 'true';
  const redisUrl = process.env.AGENT_POLICY_REDIS_URL;
  const orgId = process.env.AGENT_POLICY_ORG_ID;

  // Log configuration status (to stderr so it doesn't interfere with stdio)
  console.error('agent-policy MCP Server Configuration:');
  console.error(`  Demo Mode: ${demoMode ? 'enabled' : 'disabled'}`);
  console.error(`  Redis URL: ${redisUrl ? 'configured' : 'not set (using in-memory store)'}`);
  console.error(`  Default Org ID: ${orgId || 'not set'}`);
  console.error('');

  // Available tools
  console.error('Available Tools:');
  console.error('  - agent-policy/authorize  : Check if a payment is authorized');
  console.error('  - agent-policy/budget     : Get remaining budget for a period');
  console.error('  - agent-policy/get        : Get agent policy configuration');
  console.error('  - agent-policy/set        : Set or update agent policy');
  console.error('  - agent-policy/list       : List all agent policies');
  console.error('  - agent-policy/confirm    : Confirm a payment reservation');
  console.error('  - agent-policy/release    : Release a payment reservation');
  console.error('');

  // Create and run server
  const server = createServerFromEnv();
  await server.run();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
