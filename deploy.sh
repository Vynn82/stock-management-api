#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🚀 Starting Stock Management API Deployment"
echo "=========================================="

APP_DIR="${APP_DIR:-/home/ubuntu/stock-management-api}"

if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
else
  echo "❌ Error: Application directory $APP_DIR does not exist."
  exit 1
fi

# Ensure .env file exists
if [ ! -f .env ]; then
  echo "❌ Error: Production .env file is missing in $APP_DIR"
  exit 1
fi

# Fetch and update latest codebase from git
echo "📥 Fetching latest changes from origin/main..."
git fetch origin main
git reset --hard origin/main

# Rebuild and launch containers
echo "🐳 Building and launching Docker containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# Wait for service health
echo "⏳ Waiting for API service to stabilize..."
sleep 15

# Run TypeORM database migrations
echo "📦 Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T api npm run migration:run || {
  echo "⚠️ Migrations returned non-zero, check logs if any migrations were pending."
}

# Clean dangling Docker images to free disk space on EC2
echo "🧹 Cleaning unused Docker images..."
docker image prune -f

echo "=========================================="
echo "✅ Deployment successfully completed!"
echo "=========================================="
