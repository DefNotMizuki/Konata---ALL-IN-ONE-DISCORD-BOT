# Konata - ALL IN ONE DISCORD BOT (Phase 1)

This repository contains the Phase 1 scaffold for Konata, a modular, TypeScript-based Discord economy bot built for production and horizontal scaling.

## Quickstart

1. Copy .env.example to .env and fill values (DISCORD_TOKEN, MONGODB_URI, REDIS_URL, DEFAULT_PREFIX).
2. Install dependencies:
   - npm ci
3. Development (hot-reload):
   - npm run dev
4. Build & run:
   - npm run build
   - npm start
5. Seed sample data (requires MongoDB running):
   - npm run seed

## Using Docker / Docker Compose

Local dev (Mongo + Redis + app):

1. Fill environment variables in a .env file (or set them in your environment).
2. Run:
   - docker-compose up --build

## Environment variables

- DISCORD_TOKEN - your Discord bot token
- MONGODB_URI - MongoDB connection string
- REDIS_URL - Redis connection string (optional but recommended)
- DEFAULT_PREFIX - default command prefix (default: h!)
- NODE_ENV - development or production

## Developer notes

- Node 20 LTS is required.
- TypeScript + ES Modules.
- Commands are loaded from src/commands.
- Models use Mongoose; use transactions for multi-document writes when needed.
- Redis is used for distributed locks (ioredis) and queues (BullMQ).

## Contributing

Please open issues for bugs or feature requests. Follow the pull request template when submitting changes.

## License

MIT © 2026 DefNotMizuki
