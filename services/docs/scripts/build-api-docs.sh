#!/bin/bash
# Build TypeDoc API documentation and copy to docs/public/api
# This script should be run from the docs/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DOCS_DIR/.." && pwd)"
TS_DIR="$ROOT_DIR/typescript"

echo "=== Building TypeDoc API Documentation ==="
echo "Docs dir: $DOCS_DIR"
echo "TypeScript dir: $TS_DIR"

# Enable corepack for pnpm (needed in Cloudflare Pages)
if command -v corepack &> /dev/null; then
  echo "Enabling corepack..."
  corepack enable
fi

# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm@10
fi

# Install TypeScript dependencies
cd "$TS_DIR"
if [ -d "node_modules" ] && [ -d "node_modules/.pnpm" ]; then
  echo "Using existing TypeScript node_modules..."
else
  echo "Installing TypeScript dependencies..."
  pnpm install --frozen-lockfile
fi

# Generate TypeDoc
echo "Generating TypeDoc..."
pnpm docs

# Copy to docs/public/api
echo "Copying API docs to docs/public/api..."
mkdir -p "$DOCS_DIR/public/api"
rm -rf "$DOCS_DIR/public/api"
cp -r "$TS_DIR/api-docs" "$DOCS_DIR/public/api"

echo "=== API Documentation Built Successfully ==="
echo "Will be available at: https://docs.t402.io/api/"
