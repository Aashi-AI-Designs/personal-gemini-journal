import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getApp } from "firebase-admin/app";

/**
 * A dedicated named database, not "(default)" — so reusing an existing
 * GCP/Firebase project (to stay on one set of credits) never mixes this
 * app's collections with another app's data in the same project.
 */
const JOURNAL_DATABASE_ID = "journal-db";

export function db(): Firestore {
  return getFirestore(getApp(), JOURNAL_DATABASE_ID);
}
