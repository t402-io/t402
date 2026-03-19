#!/bin/bash
# T402 New Services — Deployment Script
#
# Run on production server (220.134.32.65):
#   ssh doge@220.134.32.65
#   cd /home/doge/github/t402/services
#   bash deploy-new-services.sh
#
# Or from local machine:
#   ssh doge@220.134.32.65 'cd /home/doge/github/t402/services && bash deploy-new-services.sh'

set -euo pipefail

echo "🚀 T402 New Services Deployment"
echo "================================"
echo ""

# Step 1: Pull latest code
echo "📦 Step 1: Pulling latest code..."
cd "$(dirname "$0")"
git pull origin main
echo "   ✅ Code updated"
echo ""

# Step 2: Build and start containers
echo "🐳 Step 2: Building and starting containers..."
docker compose -f docker-compose.new-services.yml build --no-cache
docker compose -f docker-compose.new-services.yml up -d
echo "   ✅ Containers started"
echo ""

# Step 3: Wait for services to be healthy
echo "⏳ Step 3: Waiting for health checks (30s)..."
sleep 30

echo ""
echo "🏥 Step 4: Health check results:"
for svc in bazaar:3402 status:3403 explorer:3404 agent-dashboard:3405 sandbox:3406; do
  name="${svc%%:*}"
  port="${svc##*:}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:${port}/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "   ✅ ${name} (port ${port}) — healthy"
  else
    echo "   ❌ ${name} (port ${port}) — HTTP ${code}"
  fi
done

echo ""
echo "📋 Step 5: Cloudflare Tunnel configuration"
echo "   Add the following to ~/.cloudflared/config.yml:"
echo ""
echo "   - hostname: bazaar.t402.io"
echo "     service: http://localhost:3402"
echo "   - hostname: status.t402.io"
echo "     service: http://localhost:3403"
echo "   - hostname: explorer.t402.io"
echo "     service: http://localhost:3404"
echo "   - hostname: agents.t402.io"
echo "     service: http://localhost:3405"
echo "   - hostname: sandbox.t402.io"
echo "     service: http://localhost:3406"
echo ""
echo "   Then restart cloudflared:"
echo "   sudo systemctl restart cloudflared"
echo ""

echo "🌐 Step 6: Cloudflare DNS (one-time)"
echo "   Create CNAME records in Cloudflare Dashboard:"
echo "   bazaar.t402.io   → d4000e5f-9db4-430f-961b-6fa2d7fb9aac.cfargotunnel.com"
echo "   status.t402.io   → d4000e5f-9db4-430f-961b-6fa2d7fb9aac.cfargotunnel.com"
echo "   explorer.t402.io → d4000e5f-9db4-430f-961b-6fa2d7fb9aac.cfargotunnel.com"
echo "   agents.t402.io   → d4000e5f-9db4-430f-961b-6fa2d7fb9aac.cfargotunnel.com"
echo "   sandbox.t402.io  → d4000e5f-9db4-430f-961b-6fa2d7fb9aac.cfargotunnel.com"
echo ""
echo "✅ Deployment complete!"
