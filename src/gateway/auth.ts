import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState() {
  return crypto.randomBytes(16).toString("base64url");
}

export function sendError(res: Response, status: number, errorCode: string, message: string, retryable: boolean = false) {
  const correlationId = res.locals.correlationId || crypto.randomUUID();
  res.status(status).json({
    code: errorCode,
    message,
    retryable,
    correlationId,
  });
}
