#!/bin/bash
set -e

echo "🚀 Iniciando stack Trelk..."

# =========================
# 1. Redis
# =========================
echo "🟥 Starting Redis..."
redis-server --daemonize yes

sleep 1
echo "✅ Redis listo"

# =========================
# 2. Telegram Bot API
# =========================
echo "🤖 Starting Telegram Bot API..."

./telegram-bot-api \
  --api-id=17391152 \
  --api-hash=28963f73d4705eeab75b4763e44f6097 \
  --local \
  > telegram.log 2>&1 &

TELEGRAM_PID=$!
echo "✅ Telegram Bot API corriendo (PID: $TELEGRAM_PID)"

sleep 2

# =========================
# 3. Cloudflared Tunnel
# =========================
echo "☁️ Starting Cloudflare Tunnel..."

cloudflared tunnel run --token eyJhIjoiYzU0MWFkMzNhZDc5YjhhYWE3OWZhMjNkMTI4MWNiYjEiLCJ0IjoiMDVhYmQwY2EtMzJlOS00OTMyLTlhMDgtODFiNGJkNjBhYzAwIiwicyI6Ik1UTXpNbVl5T1RJdE1EY3dOUzAwTVRNNUxXSm1NV1V0WldRelpEQTVaV1F5TVdJMCJ9
