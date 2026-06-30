#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ -d .setup ]; then
    echo "ERROR: Setup Has Not Been Completed. Please Run pnpm run setup First."
fi

echo "Pulling Latest Changes..."
git pull

echo "Installing Dependencies..."
pnpm install --prod

echo "Starting Server..."
exec node server.js