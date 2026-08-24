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
};

export const plaidConfigured = Boolean(env.plaidClientId && env.plaidSecret);
