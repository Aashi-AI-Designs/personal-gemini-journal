import { beforeUserCreated, HttpsError } from "firebase-functions/v2/identity";
import { db } from "./services/db";

/**
 * Invite-only gate for the demo/testing phase. Runs BEFORE the Firebase
 * Auth account is created, so an unapproved email never even gets an
 * account.
 *
 * Manage the allowlist via the Firebase console or CLI, e.g.:
 *   firebase firestore:set allowlist/someone@example.com '{"invited": true}'
 */
export const enforceAllowlist = beforeUserCreated(async (event) => {
  const email = event.data?.email;
  if (!email) {
    throw new HttpsError("invalid-argument", "An email is required to sign up.");
  }

  const doc = await db().doc(`allowlist/${email}`).get();

  if (!doc.exists) {
    throw new HttpsError(
      "permission-denied",
      "This journal is currently invite-only."
    );
  }
});
