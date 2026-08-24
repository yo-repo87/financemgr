# FinanceMgr

Self-hosted personal finance manager: multi-user signup, Plaid account linking
(balances, transactions, credit card statement dates), budgeting, spending
analytics, and an OpenAI-powered advisor using your own API key.

## Stack

- **frontend**: React + Vite + TypeScript + Tailwind + Recharts, served by nginx (port `3140`)
- **backend**: Node 20 + Express + TypeScript + Prisma (port `3141`)
- **db**: Postgres 16 with SSL enabled, loopback-only (port `127.0.0.1:5441`)

All three run in Docker on a dedicated `financemgr-net` network via `docker-compose.yml`.

## Security notes

- Passwords hashed with argon2id. Sessions are JWT access tokens (15 min) +
  rotating refresh tokens (7 days), delivered as `httpOnly`, `Secure`,
  `SameSite=Strict` cookies — never `localStorage`.
- Plaid access tokens, each user's OpenAI API key, and AI advisor chat history
  are encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY` in `.env`). Losing
  that key makes the encrypted data unrecoverable — back it up somewhere safe,
  outside of git.
- Backend↔Postgres traffic is TLS-encrypted (self-signed cert baked into the
  `db` image, `sslmode=require` on the connection string).
- **Because cookies are `Secure`, browsers will only send them over HTTPS** (an
  exception is made for `http://localhost`). That means:
  - Testing directly on this machine via `http://localhost:3140` works out of the box.
  - Accessing from another device on your LAN via `http://<pi-ip>:3140` will let
    you log in, but the browser will silently drop the cookie and you'll appear
    logged out on the next request, since that's not `localhost` and not HTTPS.
  - **To use this from other devices, put it behind real TLS** — your existing
    nginx-proxy-manager (already listening on 80/443) is the natural fit. Add a
    proxy host forwarding a subdomain (e.g. `finance.yourdomain.com`) to
    `3140` for the app and a second one to `3141` for `/api` (or reverse-proxy
    `/api` through the same host), request a Let's Encrypt cert, and set
    `FRONTEND_URL` / `VITE_API_URL` in `.env` to the HTTPS URLs, then rebuild
    the frontend. I didn't touch nginx-proxy-manager myself since it's shared
    infrastructure — happy to walk through it whenever you're ready.

## First-time setup

1. **Plaid Sandbox keys** (optional to start, required for account linking):
   sign up free at https://dashboard.plaid.com/signup, then fill in
   `PLAID_CLIENT_ID` and `PLAID_SECRET` in `.env` (already set to
   `PLAID_ENV=sandbox`). Sandbox test login: `user_good` / `pass_good`.
2. `docker compose up -d --build`
3. Open `http://localhost:3140`, register an account, and:
   - Go to **Accounts** → Connect an account (once Plaid keys are set)
   - Go to **Settings** → paste your own OpenAI API key (used only for the
     Advisor page, stored encrypted)
   - Set budgets, view Analytics, ask the Advisor questions

## Adding Google/Apple sign-in later

"Continue with Google" and "Continue with Apple" buttons exist on the Login and
Register pages but only render when that provider's credentials are present in
`.env` — leave a provider's block blank and its button simply doesn't appear,
so there's never a dead/non-functional button on the page.

- **Google**: create an OAuth client (Web application) at
  https://console.cloud.google.com/apis/credentials, add
  `{BACKEND_PUBLIC_URL}/api/auth/oauth/google/callback` as an authorized
  redirect URI, then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.
  Works fine with `BACKEND_PUBLIC_URL=http://localhost:3141` for local testing.
- **Apple**: create a Services ID and a Sign in with Apple key at
  https://developer.apple.com/account/resources, add
  `{BACKEND_PUBLIC_URL}/api/auth/oauth/apple/callback` as the redirect URI, then
  set `APPLE_CLIENT_ID` (the Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and
  `APPLE_PRIVATE_KEY` (the downloaded `.p8` file's contents, with real newlines
  replaced by literal `\n`) in `.env`. **Apple requires the redirect URI to be
  HTTPS** — there's no `http://localhost` allowance like Google has — so Apple
  sign-in specifically can't be tested until this app is behind real TLS (see
  the nginx-proxy-manager note above).

Either way: `docker compose up -d --build backend` to pick up the new env vars.

## Everyday commands

```bash
docker compose up -d --build   # rebuild + start everything
docker compose logs -f backend # tail backend logs
docker compose down            # stop everything (data persists in the db volume)
```

## Notes

- Credit card "next statement closing date" is an **estimate** (last statement
  issue date + ~1 month) — Plaid doesn't guarantee a forward-looking exact date.
- Balances sync automatically every 6 hours, or on-demand via "Sync now" on the Accounts page.
- Net worth history builds up from real sync data over time (a snapshot is recorded on every sync) — the trend chart on Dashboard needs at least two sync days to show a line.
