#!/bin/bash
set -e

echo "🚀 Setting up Go AI..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example — please fill in your secrets"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infrastructure
echo "🐳 Starting Docker services..."
docker compose up -d postgres redis

# Wait for postgres
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U goai -d goai_db > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL ready"

# Run migrations
echo "🗃️  Running database migrations..."
cd packages/database && npx prisma migrate deploy && cd ../..

# Seed database
echo "🌱 Seeding database..."
cd packages/database && npm run db:seed && cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start development servers:"
echo "  npm run dev"
echo ""
echo "Default admin: admin@goai.app / Admin123!"
