# Deploying Personal Gemini Journal — Step by Step (from zero)

This assumes you've never used Google Cloud before. Every step happens in
the browser — no local installs needed, because we'll use **Cloud Shell
Editor**, which is a free VS Code-like environment with a terminal, already
inside your Google Cloud account.

Keep this guide open in one tab and Cloud Shell in another.

---

## Part A — Using your existing project (not creating a new one)

Since your Google Cloud credits are tied to one project, this app is
built to safely share that project with whatever else is already in it,
rather than needing its own. Four things are deliberately namespaced so
nothing here can collide with an existing app in the same project:

| Resource | Default name a fresh setup would use | What this project uses instead |
|---|---|---|
| Firestore database | `(default)` | a separate named database: `journal-db` |
| Cloud Function | `api` | `journalApi` |
| Secret Manager secret | `gemini-api-key` | `personal-journal-gemini-key` |
| Storage path prefix | `boards/...` | `journal-app/boards/...` |

The Firestore one matters most: because `journal-db` is a completely
separate database from whatever your existing app uses, this app's
top-level collections (`users`, `allowlist`, `_rateLimits`) can't collide
with your existing app's collections even if they happen to share a name
— they're not just different paths, they're different databases
entirely. Firestore rules and queries are also scoped per-database, so
deploying this app's rules will never touch your existing app's rules.

### A1. Open your existing project
1. Go to **console.cloud.google.com**, and from the project dropdown at
   the top, select your existing project (the one with your credits) —
   don't create a new one.
2. If it's not already linked to Firebase: go to
   **console.firebase.google.com → Add project → select your existing
   GCP project** (this adds Firebase capabilities to it without creating
   a second project).

### A2. Open Cloud Shell Editor
1. In the GCP Console, top-right, click the **`>_` (Activate Cloud
   Shell)** icon.
2. Click **Open Editor** to switch to the full file-tree + terminal view.

### A3. Create the dedicated Firestore database
This is the one genuinely new step compared to a fresh project — you're
adding a second database alongside whatever your existing app already
uses, not replacing anything:
```
firebase firestore:databases:create journal-db --location=nam5
```
(No `--type` flag needed here — that flag belongs to the separate `gcloud
firestore databases create` command, not this Firebase CLI one. Databases
created through the Firebase CLI are always Firestore Native mode, which
is what this app needs. Swap `nam5` for a region closer to you if you
prefer — run `firebase firestore:locations` to see valid options. It
doesn't need to match your existing app's region.)

---

## Part B — Cost safety (do this before anything that could bill you)

This is the step people skip and regret. Do it now, while nothing is
running yet.

1. In the GCP Console, go to **Billing → Budgets & alerts → Create budget**.
2. Set an amount ($5 is plenty for a personal prototype).
3. Under "Manage notifications," set alert thresholds at 50%, 90%, 100%.
4. Note: this **notifies you**, it does not automatically stop spending.
   For a hard stop, Google's documented pattern is a budget-triggered
   Pub/Sub notification wired to a small function that disables billing —
   search "Cloud Billing budget notifications automate" in the console
   help if you want this; it's optional for a personal prototype but
   good practice if you're leaving it running unattended for a while.
5. You will still need to attach a card to enable Blaze (next step) —
   this is a Google requirement, not something we can avoid, since
   Cloud Functions needs to make outbound calls. The budget alert above
   is your safety net for that.

### B1. Enable the Blaze plan
1. In the Firebase console (your project) → bottom-left gear icon →
   **Usage and billing** → **Details & settings** → **Modify plan**.
2. Choose **Blaze (Pay as you go)**, attach a payment method.
3. You will not be charged for anything within the free tier — this
   plan only changes what's *possible* (outbound network calls), not
   what's *free*.

---

## Part C — Enable the services you need

Still in the Firebase console, left sidebar:

1. **Build → Authentication** → Get started → enable **Google** and
   **Email/Password** sign-in providers.
2. **Build → Firestore Database** → Create database → **Production mode**
   → pick a region close to you → Enable.
3. **Build → Storage** → Get started → **Production mode** → same region
   as Firestore → Done.

---

## Part D — Get a free-tier Gemini API key (via AI Studio)

1. Go to **aistudio.google.com**.
2. If prompted, paste the security constitution (`ai-studio-constitution.md`
   from the project download) into any **System Instructions** field
   before generating code there — this is the Phase 1 deliverable from
   our design process, not required for the key itself, but do it now
   while you're in AI Studio.
3. Click **Get API key** (left sidebar) → **Create API key**.
4. **Important:** choose to create it **without** linking a billing
   project/account, if given the option. This is what keeps it
   genuinely free — no card attached means no path to a charge, even if
   you hit the daily quota.
5. Copy the key somewhere temporary — you'll paste it into Secret
   Manager in a moment, then never need it in plaintext again.

---

## Part E — Get the project files into Cloud Shell

1. Download `personal-gemini-journal.zip` (the project scaffold) to your
   computer if you haven't already.
2. In Cloud Shell Editor, click the **three-dot menu** in the file tree →
   **Upload** → select the zip file.
3. In the Cloud Shell terminal, unzip it:
   ```
   unzip personal-gemini-journal.zip
   cd personal-gemini-journal
   ```

---

## Part F — Install the Firebase CLI and log in

In the Cloud Shell terminal:
```
npm install -g firebase-tools
firebase login --no-localhost
```
This prints a URL — open it in a new tab, sign in with the same Google
account, approve access, then copy the confirmation code back into the
terminal.

Connect the CLI to your project:
```
firebase use --add
```
Select your project from the list, and give it the alias `default` when asked.

---

## Part G — Store the Gemini key in Secret Manager

Still in the terminal:
```
gcloud services enable secretmanager.googleapis.com

echo -n "PASTE_YOUR_GEMINI_KEY_HERE" | gcloud secrets create personal-journal-gemini-key \
  --replication-policy="automatic" \
  --data-file=-
```
Grant your Cloud Functions service account permission to read it —
replace `YOUR_PROJECT_ID` with your actual project ID (visible in the
GCP console header):
```
gcloud secrets add-iam-policy-binding personal-journal-gemini-key \
  --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Part H — Set up the invite-only allowlist (optional but recommended)

For each tester's email you want to allow:
```
firebase firestore:set allowlist/tester@example.com '{"invited": true}'
```
Run this once per person you're inviting. Skip this step entirely if you
want open sign-up instead (not recommended while testing, given the
shared free-tier quota).

---

## Part I — Configure the frontend

1. In Cloud Shell Editor's file tree, open **Firebase console → Project
   settings (gear icon) → General → Your apps → Add app → Web**.
2. Register an app (any nickname), skip hosting setup when prompted.
3. Copy the `firebaseConfig` values shown.
4. Back in Cloud Shell, create the env file:
   ```
   cd web
   cp .env.example .env
   ```
5. Open `.env` in the editor and paste in the matching values from step 3
   (apiKey → `VITE_FIREBASE_API_KEY`, authDomain →
   `VITE_FIREBASE_AUTH_DOMAIN`, and so on).

---

## Part J — Install dependencies

```
cd ~/personal-gemini-journal/functions
npm install
npm run build

cd ~/personal-gemini-journal/web
npm install
```

---

## Part K — Test locally with the emulator first

This runs everything in a sandboxed local environment — nothing here
touches your real Firestore or costs anything, and it's the fastest way
to catch a mistake before it's live.

```
cd ~/personal-gemini-journal
firebase emulators:start --only functions,firestore,auth,storage
```
Cloud Shell will show a preview link for the emulator UI — open it to
watch requests/data live.

In a **second terminal tab** (click the `+` in the terminal panel):
```
cd ~/personal-gemini-journal/web
npm run dev
```
Open the preview link this gives you. Sign in, write an entry, try the
Gemini panel, create a board. If something breaks, the emulator UI's
logs tab will show you exactly which function failed and why.

---

## Part L — Deploy for real

Once the emulator test works end to end:
```
cd ~/personal-gemini-journal
npm --prefix web run build
firebase deploy --only firestore:rules,storage:rules,functions,hosting
```
This takes a few minutes the first time. At the end, it prints your live
**Hosting URL** — that's the link you send to testers.

**If your existing project already has something deployed to Firebase
Hosting**, running `firebase deploy --only hosting` as written above would
overwrite it, since a project's default Hosting site serves one thing.
Check first with `firebase hosting:sites:list`. If it shows an existing
site, create a second one instead of using the default:
```
firebase hosting:sites:create personal-gemini-journal
firebase target:apply hosting journal personal-gemini-journal
```
Then in `firebase.json`, change `"hosting": {` to
`"hosting": { "target": "journal",` and deploy with
`firebase deploy --only hosting:journal,firestore:rules,storage:rules,functions`
instead of the command above.

---

## Part M — After deploying, verify the real thing

1. Open the Hosting URL in an incognito window (fresh session).
2. Sign in with an email on your allowlist (or a Google account, if you
   didn't restrict Google sign-in — note the allowlist as written only
   gates email/password sign-up; restricting Google sign-in too would need
   a small addition to the same blocking function).
3. Write an entry, save it, confirm it appears under **Menu → Past entries**.
4. Try the Gemini panel, create a board, brainstorm on it, click
   **+ Add to board**.
5. Check **GCP Console → Billing → Reports** after a day of testing — it
   should read effectively $0, since only Firestore/Functions/Storage
   free-tier usage and the no-billing Gemini key are in play.

---

## If something goes wrong

- **Functions fail to deploy:** re-run `npm run build` inside `functions/`
  first — the deploy uses the compiled `lib/` output, not the raw
  TypeScript.
- **401 errors from the API:** almost always means the frontend's Firebase
  config in `.env` doesn't match the project you deployed Functions to —
  double check the values from Part I.
- **Gemini calls fail silently:** check `gcloud secrets versions list
  personal-journal-gemini-key` to confirm the secret exists, and re-check the IAM
  binding command in Part G used your correct project ID.
- **429 errors from Gemini:** you've hit the free-tier daily quota — this
  is expected behavior, not a bug, and resets in 24 hours (see the app's
  own graceful-failure message for this exact case).
