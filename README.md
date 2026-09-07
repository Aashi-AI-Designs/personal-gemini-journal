# Personal Gemini Journal

A prototype built against the security constitution in `docs/ai-studio-constitution.md`.
Read that file first — paste it into Google AI Studio's Custom Instructions
before generating or modifying any code, per Phase 1 of the challenge.

## What's here

- `docs/ai-studio-constitution.md` — Phase 1 deliverable, the security constitution
- `firestore.rules`, `storage.rules` — isolation enforcement (defense in depth)
- `functions/` — Cloud Functions backend (Express + Firebase Admin SDK)
- `web/` — React + Vite frontend

## One-time setup

1. **Create a Firebase project** at console.firebase.google.com. Enable:
   - Authentication → Google provider, and Email/Password provider
   - Firestore (production mode — the rules file handles access control)
   - Storage
2. **Upgrade to the Blaze plan.** This is required for Cloud Functions to
   make outbound calls (to Gemini and Secret Manager) — the free Spark
   plan can't do this. See "Cost safety" below before doing this step;
   set up the budget hard-stop first, not after.
3. **Get a free-tier Gemini API key** from Google AI Studio
   (aistudio.google.com/apikey) — do NOT link it to a billing account,
   that's what keeps it structurally free (see prior discussion: no card
   attached to the key means no path to a charge).
4. **Store the key in Secret Manager:**
   ```
   gcloud secrets create personal-journal-gemini-key --replication-policy="automatic"
   echo -n "YOUR_KEY_HERE" | gcloud secrets versions add personal-journal-gemini-key --data-file=-
   gcloud secrets add-iam-policy-binding personal-journal-gemini-key \
     --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```
5. **Invite-only allowlist** (optional, recommended while testing):
   ```
   firebase firestore:set allowlist/tester@example.com '{"invited": true}'
   ```
6. **Frontend env vars** — copy `web/.env.example` to `web/.env` and fill
   in your Firebase project's client config (from Project Settings →
   General → Your apps).

## Cost safety — do this BEFORE enabling Blaze

1. GCP Console → Billing → Budgets & alerts → create a budget at a low
   threshold (e.g. $1, $5).
2. Set the budget's action to trigger a Pub/Sub notification, and attach
   a small Cloud Function (not included in this scaffold — a few lines)
   that disables billing on the project when the threshold fires. A
   budget alert alone only notifies you; it does not stop spending.
3. In `functions/src/index.ts`, `maxInstances: 10` on the `journalApi`
   function is already set as a hard technical ceiling on Cloud
   Functions scale-out — a bug can't cause unbounded parallel invocations.
4. The Gemini key stays on the free tier with no billing account attached
   — this is the one piece that's zero-risk by construction, not by
   monitoring. If usage exceeds the daily quota, calls simply fail with
   a 429 until the next day's reset; nothing bills.

## Local development

```
cd functions && npm install && npm run build
firebase emulators:start --only functions,firestore,auth,storage

cd web && npm install && npm run dev
```

## Deploy

```
firebase deploy --only firestore:rules,storage:rules,functions,hosting
```

## Known scaffold gaps to close before a real demo

- `check-connection`'s past-entry matching in `entries.ts` is a
  placeholder string match — swap for a real embeddings comparison
  (`text-embedding-004` via Vertex AI or the Gemini API, storing a vector
  per entry and comparing cosine similarity) before relying on it.
- The board-images-in-Gemini flow (having Gemini actually look at an
  uploaded image, not just store it) isn't wired up yet — `sendChatMessage`
  in `services/gemini.ts` would need to accept an image part alongside text.
- No automated tests yet — given the isolation guarantees are the most
  safety-critical part of this app, a security-rules test suite
  (`@firebase/rules-unit-testing`) verifying cross-user access is denied
  would be the highest-value first test to add.
