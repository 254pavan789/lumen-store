#!/usr/bin/env bash
# macOS / Linux launcher: installs dependencies on first run, then starts the server.
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env - edit DB_USER / DB_PASSWORD, then run ./start.sh again."
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
  python3 -m pip install -r requirements.txt
  python3 engine/migrate.py --seed
fi

exec node backend/server.js
