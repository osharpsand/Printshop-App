#!/bin/bash
set -e

cd "$(dirname "$0")"

HOME_DIR="$(getent passwd "$(id -un)" | cut -d: -f6)"

export NVM_DIR="$HOME_DIR/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
else
    echo "Error: NVM not found at $NVM_DIR"
    exit 1
fi

nvm use default >/dev/null

if [ -d .setup ]; then
    echo "ERROR: Setup Has Not Been Completed. Please Run pnpm run setup First."
    exit 1
fi

echo "Pulling Latest Changes..."
git pull

echo "Installing Dependencies..."
pnpm install --prod

echo "Starting Server..."
exec node server.js