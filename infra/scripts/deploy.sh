#!/bin/bash
set -e

echo "🚀 Deploying Go AI to production..."

# Pull latest
git pull origin main

# Build and restart
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

echo "✅ Deployment complete!"
docker compose -f docker-compose.prod.yml ps
