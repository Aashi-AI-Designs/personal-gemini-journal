import { Response, NextFunction } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../services/db";
import { AuthedRequest } from "./auth";

// Constitution principle #6 — Abuse prevention.
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONVERSATION_TURNS = 60;

export async function rateLimit(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const uid = req.uid;
  if (!uid) {
    res.status(401).json({ error: "Unauthenticated." });
    return;
  }

  const windowRef = db().doc(`_rateLimits/${uid}`);
  const now = Date.now();
  const windowMs = 60_000;

  try {
    const snap = await windowRef.get();
    const data = snap.exists ? (snap.data() as { windowStart: number; count: number }) : null;

    if (!data || now - data.windowStart > windowMs) {
      await windowRef.set({ windowStart: now, count: 1 });
    } else if (data.count >= MAX_REQUESTS_PER_MINUTE) {
      res.status(429).json({
        error: "You're sending messages a bit fast — give it a moment and try again.",
      });
      return;
    } else {
      await windowRef.update({ count: FieldValue.increment(1) });
    }

    next();
  } catch (err) {
    console.error(JSON.stringify({ event: "rate_limit_error", uid }));
    res.status(503).json({ error: "Temporarily unavailable. Please try again shortly." });
  }
}

export function validateMessageInput(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const { message, conversationHistory } = req.body ?? {};

  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required." });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
    });
    return;
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length > MAX_CONVERSATION_TURNS) {
    res.status(400).json({ error: "This conversation has reached its maximum length." });
    return;
  }

  next();
}
