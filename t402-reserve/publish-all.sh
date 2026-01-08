#!/bin/bash

# t402 Package Publishing Script
# Publishes all reserved packages to npm

set -e

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

# Check if logged in
echo "Checking npm login status..."
npm whoami || {
  echo "❌ Not logged in to npm. Please run: npm login"
  exit 1
}

echo ""
echo "✅ Logged in as: $(npm whoami)"
echo ""

# Confirm
read -p "⚠️  This will publish ${#PACKAGES[@]} packages. Continue? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""

SUCCESS=()
FAILED=()
SKIPPED=()

for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"

  if [ ! -d "$dir" ]; then
    echo "⚠️  Directory not found: $dir (skipping)"
    SKIPPED+=("$pkg")
    continue
  fi

  echo "📦 Publishing $pkg..."

  cd "$dir"

  # Check if already exists
  if npm view "$pkg" version &>/dev/null; then
    echo "⚠️  $pkg already exists on npm (skipping)"
    SKIPPED+=("$pkg")
    cd ../..
    continue
  fi

  # Publish
  if npm publish --access public 2>/dev/null; then
    echo "✅ Published $pkg"
    SUCCESS+=("$pkg")
  else
    echo "❌ Failed to publish $pkg"
    FAILED+=("$pkg")
  fi

  cd ../..

  # Rate limit protection
  sleep 1
done

echo ""
echo "========================================"
echo "📊 Publishing Summary"
echo "========================================"
echo ""
echo "✅ Success: ${#SUCCESS[@]}"
for pkg in "${SUCCESS[@]}"; do
  echo "   - $pkg"
done
echo ""
echo "⚠️  Skipped: ${#SKIPPED[@]}"
for pkg in "${SKIPPED[@]}"; do
  echo "   - $pkg"
done
echo ""
echo "❌ Failed: ${#FAILED[@]}"
for pkg in "${FAILED[@]}"; do
  echo "   - $pkg"
done
echo ""
echo "Done!"
