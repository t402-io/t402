#!/bin/bash

# t402 Package Publishing Script with OTP
# Usage: ./publish-with-otp.sh <OTP_CODE>

set -e

if [ -z "$1" ]; then
  echo "❌ 請提供 OTP 碼"
  echo "用法: ./publish-with-otp.sh <6位數OTP>"
  exit 1
fi

OTP=$1

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

echo "🚀 t402 Package Publisher (with OTP)"
echo "====================================="
echo ""
echo "✅ OTP: $OTP"
echo "📦 Packages: ${#PACKAGES[@]}"
echo ""

SUCCESS=()
FAILED=()
SKIPPED=()

for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"

  if [ ! -d "$dir" ]; then
    echo "⚠️  $pkg: 目錄不存在"
    SKIPPED+=("$pkg")
    continue
  fi

  echo -n "📦 $pkg... "

  cd "$dir"

  # Check if already exists
  if npm view "$pkg" version &>/dev/null; then
    echo "⚠️  已存在"
    SKIPPED+=("$pkg")
    cd ../..
    continue
  fi

  # Publish with OTP
  if npm publish --access public --otp="$OTP" 2>/dev/null; then
    echo "✅ 成功"
    SUCCESS+=("$pkg")
  else
    echo "❌ 失敗"
    FAILED+=("$pkg")
  fi

  cd ../..
done

echo ""
echo "========================================"
echo "📊 發布結果"
echo "========================================"
echo ""
echo "✅ 成功: ${#SUCCESS[@]}"
for pkg in "${SUCCESS[@]}"; do
  echo "   - $pkg → https://www.npmjs.com/package/$pkg"
done
echo ""
if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo "⚠️  跳過: ${#SKIPPED[@]}"
  for pkg in "${SKIPPED[@]}"; do
    echo "   - $pkg"
  done
  echo ""
fi
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "❌ 失敗: ${#FAILED[@]}"
  for pkg in "${FAILED[@]}"; do
    echo "   - $pkg"
  done
fi
echo ""
echo "🎉 完成！"
