#!/usr/bin/env bash
# Liga o webhook de uma instância da Evolution ao Finanças G&J.
# Uso na VPS:  bash ligar-webhook.sh NOME_DA_INSTANCIA TOKEN_DO_WEBHOOK
#   TOKEN_DO_WEBHOOK = valor de WHATSAPP_WEBHOOK_TOKEN na Vercel
set -euo pipefail

INSTANCIA="${1:?Informe o nome da instância (ex.: financas)}"
TOKEN="${2:?Informe o WHATSAPP_WEBHOOK_TOKEN da Vercel}"
APP="${APP_URL:-https://financas-gj.vercel.app}"

cd "$HOME/evolution"
API_KEY="$(grep '^AUTHENTICATION_API_KEY=' .env | cut -d= -f2)"

curl -fsS -X POST "http://localhost:8080/webhook/set/${INSTANCIA}" \
  -H "apikey: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"webhook\":{\"enabled\":true,\"url\":\"${APP}/api/whatsapp?token=${TOKEN}\",\"byEvents\":false,\"base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}}"
echo
echo ">> Webhook ligado. Confira:"
curl -fsS "http://localhost:8080/webhook/find/${INSTANCIA}" -H "apikey: ${API_KEY}"
echo
