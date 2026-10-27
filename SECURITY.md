# FinanceMgr — Information Security Policy

**Effective date:** 2026-08-24
**Owner:** Matthew Gibson, Owner/Administrator/Developer
**Contact:** mgibson041387@gmail.com

## 1. Purpose and Scope

This policy describes how FinanceMgr identifies, mitigates, and monitors
information security risk. FinanceMgr is a self-hosted personal finance
application operated as a single-instance deployment for individual/household
use, not a multi-tenant commercial service. There is no dedicated security
team; the Owner is the sole individual responsible for security decisions,
incident response, and policy review.

This policy covers: application data handling, encryption, authentication
and access control, secrets management, third-party data integrations
(including Plaid), infrastructure, incident response, and data subject
rights.

## 2. Data Classification

The following data types are treated as sensitive and are handled under the
controls in Section 3–5:

- Financial account data synced via Plaid (balances, transactions, holdings,
  liabilities)
- Plaid access tokens
- User authentication credentials (password hashes, TOTP secrets, WebAuthn
  credentials, backup codes, security question answers)
- Third-party API keys supplied by the user (OpenAI)
- AI advisor conversation content, since it may reference the user's
  financial data
- Session tokens and refresh tokens

## 3. Encryption

- **At rest:** Plaid access tokens, OpenAI API keys, TOTP secrets, and AI
  advisor message content are individually encrypted with AES-256-GCM before
  being written to the database. The encryption key is held only in the
  application's runtime environment, separate from the database itself.
- **In transit:** The database connection uses TLS. The application is only
  served over HTTPS to end users; TLS is terminated at the reverse proxy
  edge, and the tunnel to the origin server is itself an authenticated,
  encrypted connection (Cloudflare Tunnel) rather than a port exposed
  directly to the internet.
- **Passwords:** Hashed with argon2id (not reversible, salted, memory-hard).

## 4. Authentication and Access Control

- Session authentication uses short-lived access tokens plus a rotating
  refresh token, delivered as `httpOnly`, `Secure`, `SameSite=Strict`
  cookies - never exposed to client-side JavaScript.
- Optional two-factor authentication is supported via WebAuthn (passkeys /
  hardware security keys) and TOTP, with one-time backup codes for account
  recovery.
- Account recovery via security questions uses decoy responses to prevent
  account enumeration.
- OAuth sign-in (Google) is supported as an alternative to a stored
  password.
- Users may disable notifications and manage their own 2FA/passkey
  enrollment at any time from account settings.

## 5. Secrets Management

- All credentials (database password, JWT signing secrets, encryption keys,
  Plaid API credentials, OAuth client secrets, git/deployment tokens) are
  stored in environment configuration outside of version control and are
  explicitly excluded via `.gitignore`.
- No credential is ever committed to the application's source repository.
  When credentials must be used in one-off administrative operations (e.g. a
  deployment push), they are used transiently and never persisted to shell
  history or configuration files that are retained.

## 6. Third-Party Data Handling (Plaid)

- FinanceMgr requests only the Plaid products it actively uses:
  Transactions, Liabilities, and Investments. No unused product scope is
  requested.
- Plaid access tokens are encrypted at rest (Section 3) and are never
  returned to, or accessible from, the client application.
- Data retrieved via Plaid is used exclusively to power features within the
  user's own account instance (balances, transaction categorization, bill
  and subscription matching, cash flow forecasting, debt payoff planning,
  investment tracking). It is not sold, shared with third parties, or
  aggregated across users for any purpose, including analytics or model
  training.
- On account deletion (Section 8), the application makes a best-effort call
  to revoke each linked Plaid Item before removing the user's data.

## 7. Infrastructure Security

- The application runs as isolated Docker containers (frontend, backend,
  database) on an internal container network. The database is not exposed
  to the public internet; the only externally reachable network path is the
  application's own HTTPS endpoint.
- Public access is provided through an authenticated tunnel (Cloudflare
  Tunnel) rather than direct port-forwarding, so no inbound firewall rule
  exposes the host directly.
- Security-relevant headers are enforced at the edge (HSTS, X-Frame-Options,
  X-Content-Type-Options, a restrictive Content-Security-Policy).
- Container images are rebuilt and redeployed whenever application code or
  dependencies change, so security-relevant patches are not left pending
  indefinitely.

## 8. Data Subject Rights

- Users may export a complete copy of their own data (accounts,
  transactions, budgets, bills, subscriptions, savings goals, and AI advisor
  conversation history, decrypted) at any time via a self-service export.
  Credential material (password hash, encrypted tokens, 2FA secrets) is
  never included in an export, as it is not user data in a portable sense.
- Users may permanently delete their account and all associated data at any
  time via a self-service flow requiring re-confirmation (password and
  typed email match). Deletion cascades across all related records; there is
  no data retention period following deletion.

## 9. Monitoring and Incident Response

Given the single-operator scale of this deployment, incident response is
handled directly by the Owner rather than a formal team escalation process:

1. Any suspected compromise of a credential (JWT secret, encryption key,
   Plaid client secret, OAuth secret, deployment token) is rotated
   immediately, and any data encrypted or signed under it is
   re-evaluated for exposure.
2. Application and container logs are reviewed for the affected time window
   to determine scope.
3. Affected linked accounts (Plaid Items) are disconnected if compromise of
   access tokens is suspected.
4. The application is patched and redeployed before access is restored.
5. Since this is a personal/household deployment, the Owner is also the
   affected party and is notified as part of the response itself; there is
   no separate user base to notify at this time.

## 10. Policy Review

This policy is reviewed by the Owner at least annually, and additionally
whenever a material change occurs - a new third-party integration, a change
in hosting/network architecture, or a security-relevant incident.
