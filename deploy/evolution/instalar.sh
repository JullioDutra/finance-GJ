#!/usr/bin/env bash
# Instala a Evolution API (v2.3.7) com Postgres e Redis via Docker, pronta para o Finanças G&J.
# Uso na VPS (Ubuntu/Debian):  bash instalar.sh
set -euo pipefail

PASTA="$HOME/evolution"
VERSAO="v2.3.7"

# 1) Docker
if ! command -v docker >/dev/null 2>&1; then
  echo ">> Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
fi

mkdir -p "$PASTA" && cd "$PASTA"

# 2) Endereço público da VPS (usado nas respostas do robô)
IP_PUBLICO="$(curl -fsS https://api.ipify.org || true)"
read -r -p "Endereço público da Evolution [http://${IP_PUBLICO}:8080]: " SERVER_URL
SERVER_URL="${SERVER_URL:-http://${IP_PUBLICO}:8080}"

# 3) Senhas (geradas só na primeira vez)
if [ ! -f .env ]; then
  API_KEY="$(openssl rand -hex 24)"
  PG_PASS="$(openssl rand -hex 16)"
  cat > .env <<ENV
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=${SERVER_URL}
LANGUAGE=en

AUTHENTICATION_API_KEY=${API_KEY}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
DEL_INSTANCE=false

DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:${PG_PASS}@postgres:5432/evolution?schema=evolution_api
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_HISTORIC=false

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

CONFIG_SESSION_PHONE_CLIENT=Financas GJ
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30

POSTGRES_PASSWORD=${PG_PASS}
ENV
  chmod 600 .env
fi

# 4) docker-compose
cat > docker-compose.yml <<YML
services:
  api:
    image: evoapicloud/evolution-api:${VERSAO}
    restart: always
    depends_on: [postgres, redis]
    ports:
      - "8080:8080"
    env_file: .env
    volumes:
      - instancias:/evolution/instances

  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - postgres:/var/lib/postgresql/data

  redis:
    image: redis:7
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis:/data

volumes:
  instancias:
  postgres:
  redis:
YML

docker compose up -d

echo
echo "=============================================="
echo " Evolution no ar em: ${SERVER_URL}/manager"
echo " Chave da API (guarde!): $(grep AUTHENTICATION_API_KEY .env | cut -d= -f2)"
echo " Logs:   cd $PASTA && docker compose logs -f api"
echo "=============================================="
