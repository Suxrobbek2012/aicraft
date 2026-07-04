# TODO

## Fastify CORS fix (frontend http://localhost:3000 -> API http://localhost:4000)
- [x] Verify current CORS setup in `apps/api/src/app.ts`.
- [x] Update `@fastify/cors` registration to ensure it allows `http://localhost:3000`.
- [x] Ensure CORS plugin is registered before any routes.
- [x] Verify OPTIONS preflight handling returns proper CORS headers.
- [x] Add/adjust CORS config in `apps/api/src/config/index.ts` to include `http://localhost:3000` explicitly if needed.
- [x] Restart API and validate registration + OPTIONS preflight via browser.

