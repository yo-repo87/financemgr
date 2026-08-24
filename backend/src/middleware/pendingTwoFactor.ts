import { Request, Response, NextFunction } from "express";
import { verifyPendingTwoFactorToken } from "../lib/tokens";

export interface PendingTwoFactorRequest extends Request {
  pendingUserId?: string;
}

export function requirePendingTwoFactor(req: PendingTwoFactorRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.twofa_pending;
  if (!token) {
    return res.status(401).json({ error: "No pending two-factor session" });
  }
  const userId = verifyPendingTwoFactorToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Two-factor session expired, please log in again" });
  }
  req.pendingUserId = userId;
  next();
}
