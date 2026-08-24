const required = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "COOKIE_SECRET", "ENCRYPTION_KEY"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  cookieSecret: process.env.COOKIE_SECRET!,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3140",
  port: parseInt(process.env.BACKEND_PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  plaidClientId: process.env.PLAID_CLIENT_ID || "",
  plaidSecret: process.env.PLAID_SECRET || "",
  plaidEnv: process.env.PLAID_ENV || "sandbox",
  webauthnRpId: process.env.WEBAUTHN_RP_ID || "localhost",
  webauthnRpName: process.env.WEBAUTHN_RP_NAME || "FinanceMgr",
  webauthnOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3140",
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL || "http://localhost:3141",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  appleClientId: process.env.APPLE_CLIENT_ID || "",
  appleTeamId: process.env.APPLE_TEAM_ID || "",
  appleKeyId: process.env.APPLE_KEY_ID || "",
  // .env files can't hold real newlines inside an unquoted value, so the PEM is
  // stored with literal "\n" escapes and unescaped here - standard convention
  // for shipping a private key through an env var.
  applePrivateKey: (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "",
};

export const plaidConfigured = Boolean(env.plaidClientId && env.plaidSecret);
export const googleOAuthConfigured = Boolean(env.googleClientId && env.googleClientSecret);
export const appleOAuthConfigured = Boolean(
  env.appleClientId && env.appleTeamId && env.appleKeyId && env.applePrivateKey
);
export const pushConfigured = Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject);
