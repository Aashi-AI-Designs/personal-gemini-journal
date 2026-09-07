import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";

export interface AuthedRequest extends Request {
  uid?: string;
}

/**
 * Constitution principle #1 — Identity.
 * The ONLY valid source of identity in this backend. Never reads uid
 * from req.body, req.query, or req.params — only from a verified
 * Firebase ID token.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }

  const idToken = authHeader.slice("Bearer ".length);

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error(JSON.stringify({
      event: "auth_verify_failed",
      reason: err instanceof Error ? err.name : "unknown",
    }));
    res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }
}

export function assertOwnership(requestUid: string, resourceUid: string): void {
  if (requestUid !== resourceUid) {
    throw new Error("FORBIDDEN: resource does not belong to the authenticated user.");
  }
}
