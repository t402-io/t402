#!/bin/bash

# t402 Package Publishing Script with Token

TOKEN="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"
BASE_DIR="/Users/doge/github/x402/t402-reserve/packages"

PACKAGES=(
  "t402"
  "t402-core"
  "t402-client"
  "t402-server"
  "t402-evm"
  "t402-tron"
  "t402-solana"
  "t402-ton"
  "t402-express"
  "t402-next"
  "t402-react"
  "t402-vue"
  "t402-hono"
  "t402-fastify"
  "t402-axios"
  "t402-fetch"
  "t402-sdk"
  "t402-cli"
  "t402-paywall"
  "t402-widget"
  "t402-protocol"
  "tether402"
  "tether-402"
  "usdt402"
  "usdt-402"
)

echo "🚀 t402 Package Publisher"
echo "========================="
echo ""

SUCCESS=0
FAILED=0

for pkg in "${PACKAGES[@]}"; do
  PKG_DIR="$BASE_DIR/$pkg"

  if [ ! -d "$PKG_DIR" ]; then
    echo "⚠️  $pkg: 目錄不存在"
    continue
  fi

  echo -n "📦 $pkg... "

  # Check if already exists
  if npm view "$pkg" version 2>/dev/null; then
    echo "⚠️  已存在"
    continue
  fi

  # Publish
  RESULT=$(cd "$PKG_DIR" && npm publish --access public --registry https://registry.npmjs.org/ --//registry.npmjs.org/:_authToken="$TOKEN" 2>&1)

  if echo "$RESULT" | grep -q "npm notice"; then
    echo "✅"
    ((SUCCESS++))
  else
    echo "❌"
    ((FAILED++))
  fi

  sleep 1
done

echo ""
echo "========================="
echo "✅ 成功: $SUCCESS"
echo "❌ 失敗: $FAILED"
