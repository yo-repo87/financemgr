import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { webauthnRouter } from "./routes/webauthn";
import { twoFactorRouter } from "./routes/twoFactor";
import { securityQuestionsRouter } from "./routes/securityQuestions";
import { passwordResetRouter } from "./routes/passwordReset";
import { oauthRouter } from "./routes/oauth";
import { plaidRouter } from "./routes/plaid";
import { accountsRouter } from "./routes/accounts";
import { transactionsRouter } from "./routes/transactions";
import { budgetsRouter } from "./routes/budgets";
import { billsRouter } from "./routes/bills";
import { analyticsRouter } from "./routes/analytics";
import { aiRouter } from "./routes/ai";
import { startSyncJob } from "./jobs/sync";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
// Apple's OAuth callback arrives as a form POST (response_mode=form_post).
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/auth/webauthn", webauthnRouter);
app.use("/api/auth/2fa", twoFactorRouter);
app.use("/api/auth/security-questions", securityQuestionsRouter);
app.use("/api/auth/password-reset", passwordResetRouter);
app.use("/api/auth/oauth", oauthRouter);
app.use("/api/plaid", plaidRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/bills", billsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/ai", aiRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  logger.info(`FinanceMgr backend listening on :${env.port} (${env.nodeEnv})`);
  startSyncJob();
});
