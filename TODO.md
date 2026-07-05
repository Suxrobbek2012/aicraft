# TODO

## Fix 404 on login/register (and icon 404)

1. Confirm failing request URL from browser DevTools Network tab (exact URL that returns 404).
2. Confirm where `NEXT_PUBLIC_API_URL` is set (web env) and matches backend Fastify listen host/port.
3. If using NGINX/reverse proxy, verify it forwards `/api/v1/*` to `apps/api` service (not to Next web).
4. Ensure all auth endpoints exist at backend mount:
   - POST /api/v1/auth/login
   - POST /api/v1/auth/register
5. Fix icon 404:
   - Ensure referenced files in `apps/web/public/icons/` exist (icon-72/96/128/144/152/192/384/512).
   - If missing, add placeholder icons or update `manifest.json` icon paths.
6. Re-test login/register flows and confirm no console 404 errors.

