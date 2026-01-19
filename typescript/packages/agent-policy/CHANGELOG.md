# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-01-19

### Added

- **Approval Workflow**: Threshold-based multi-approver payment approvals
  - `ApprovalManager` for managing approval lifecycle
  - `RedisApprovalStore` for persistent approval storage
  - `InMemoryApprovalStore` for development/testing
  - MCP tools: `approvals/list`, `approvals/get`, `approvals/decide`
  - Configurable approval thresholds per amount
  - Support for multiple required approvers
  - Approval timeout and expiration handling

- **Webhook Notifications**: HTTP webhooks for approval events
  - `WebhookNotifier` class with HMAC signature support
  - Events: `approval.created`, `approval.approved`, `approval.denied`, `approval.expired`, `approval.cancelled`, `approval.decision_submitted`
  - Retry logic with exponential backoff
  - Event filtering per endpoint
  - Environment variable configuration (`AGENT_POLICY_WEBHOOK_*`)
  - JSON array configuration for multiple endpoints

- **Category Rules**: Payment category classification and restrictions
  - `allowedCategories` and `blockedCategories` configuration
  - Category validation in policy engine

- **Enhanced Time Rules**: Time window intersection support
  - Multiple overlapping time windows
  - Improved time-based access control

- **Redis Integration Tests**: Comprehensive Redis store testing
  - Policy store integration tests
  - Approval store integration tests

### Changed

- `createServerFromEnv()` now supports webhook configuration via environment variables
- `createServerWithRedis()` accepts `webhookEndpoints` and `webhookBlocking` options
- `AgentPolicyMcpServer` constructor accepts `webhooks` in stores parameter

## [0.1.0] - 2026-01-19

### Added

- Initial release
- Core policy engine with rule evaluation
- Spending limits (per-transaction, hourly, daily, weekly, monthly)
- Time rules (allowed windows, blocked periods)
- Merchant rules (whitelist/blacklist)
- Network rules (allowed/blocked networks)
- MCP server with stdio transport
- MCP tools: `authorize`, `budget`, `get`, `set`, `list`, `confirm`, `release`
- Redis-backed policy and limit stores
- In-memory stores for development
- CLI entry point (`agent-policy-mcp`)
- Comprehensive test suite
