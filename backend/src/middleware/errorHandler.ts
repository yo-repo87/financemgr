import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.issues });
  }
  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
