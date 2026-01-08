#!/bin/bash

# t402 Package Reservation Script
# This script generates placeholder packages for npm reservation

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

DESCRIPTION_MAP=(
  "t402:The Tether Payment Protocol - HTTP 402 for USDT"
  "t402-core:t402 core protocol implementation"
  "t402-client:t402 client library"
  "t402-server:t402 server middleware"
  "t402-evm:t402 EVM blockchain implementation"
  "t402-tron:t402 TRON blockchain implementation"
  "t402-solana:t402 Solana blockchain implementation"
  "t402-ton:t402 TON blockchain implementation"
  "t402-express:t402 Express.js middleware"
  "t402-next:t402 Next.js integration"
  "t402-react:t402 React components"
  "t402-vue:t402 Vue components"
  "t402-hono:t402 Hono middleware"
  "t402-fastify:t402 Fastify middleware"
  "t402-axios:t402 Axios interceptor"
  "t402-fetch:t402 Fetch API wrapper"
  "t402-sdk:t402 full SDK"
  "t402-cli:t402 command line interface"
  "t402-paywall:t402 paywall component"
  "t402-widget:t402 embeddable widget"
  "t402-protocol:t402 protocol specification"
  "tether402:Tether HTTP 402 Payment Protocol"
  "tether-402:Tether HTTP 402 Payment Protocol"
  "usdt402:USDT HTTP 402 Payment Protocol"
  "usdt-402:USDT HTTP 402 Payment Protocol"
)

get_description() {
  local pkg=$1
  for item in "${DESCRIPTION_MAP[@]}"; do
    key="${item%%:*}"
    value="${item#*:}"
    if [ "$key" == "$pkg" ]; then
      echo "$value"
      return
    fi
  done
  echo "t402 package"
}

generate_package() {
  local name=$1
  local desc=$(get_description "$name")
  local dir="packages/$name"

  echo "📦 Generating $name..."

  mkdir -p "$dir"

  # package.json
  cat > "$dir/package.json" << EOF
{
  "name": "$name",
  "version": "0.0.1",
  "description": "$desc. Visit https://t402.io for documentation.",
  "main": "index.js",
  "types": "index.d.ts",
  "keywords": [
    "t402",
    "tether",
    "usdt",
    "payment",
    "http-402",
    "cryptocurrency",
    "stablecoin",
    "blockchain",
    "web3"
  ],
  "author": "t402 Protocol",
  "license": "Apache-2.0",
  "homepage": "https://t402.io",
  "repository": {
    "type": "git",
    "url": "https://github.com/t402-protocol/t402.git"
  }
}
EOF

  # index.js
  cat > "$dir/index.js" << 'EOF'
'use strict';

const pkg = require('./package.json');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  t402 - The Tether Payment Protocol                          ║
║  Package: ${pkg.name}
║  Website: https://t402.io                                    ║
║  Full implementation coming soon!                            ║
╚══════════════════════════════════════════════════════════════╝
`);

module.exports = {
  version: pkg.version,
  name: pkg.name,
  website: 'https://t402.io'
};
EOF

  # index.d.ts
  cat > "$dir/index.d.ts" << EOF
export declare const version: string;
export declare const name: string;
export declare const website: string;
EOF

  # README.md
  cat > "$dir/README.md" << EOF
# $name

$desc

## Overview

This package is part of the **t402** ecosystem - The Tether Payment Protocol.

Visit [https://t402.io](https://t402.io) for documentation.

## Installation

\`\`\`bash
npm install $name
\`\`\`

## License

Apache-2.0
EOF

  echo "✅ Generated $name"
}

# Main
echo "🚀 t402 Package Generator"
echo "========================="
echo ""

mkdir -p packages

for pkg in "${PACKAGES[@]}"; do
  generate_package "$pkg"
done

echo ""
echo "✅ All packages generated!"
echo ""
echo "To publish, run: ./publish-all.sh"
