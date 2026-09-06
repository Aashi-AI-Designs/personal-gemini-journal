# Personal Gemini Journal

A private journaling app where you write, brainstorm with Gemini, and build a searchable record of your own thinking over time — built security-first, from the architecture up.

**Live demo:** https://gen-ai-apps-with-gemini.web.app/

---

## Why this exists

Most AI-generated apps look great in a demo and fall apart in production — hardcoded keys, no auth boundaries, shared databases with zero isolation. This project started from the opposite direction: a security "constitution" ([`docs/ai-studio-constitution.md`](docs/ai-studio-constitution.md)) was written and configured *before* any feature code existed, covering identity verification, data isolation, secret management, and LLM-specific defenses. Every feature below was built to comply with that foundation, not bolted on around it.

## Features

**Core**
- 🔑 Firebase Authentication (Google + email/password), invite-only via an Auth blocking function
- 💬 Multi-turn journaling and brainstorming conversations with Gemini
- 🗂️ Per-user data isolation in Cloud Firestore — enforced in code, not just security rules
- 🔒 Gemini API key retrieved from Google Cloud Secret Manager at runtime — never hardcoded, never sent to the client

**Contextual Gemini** (the headline custom feature)
While you write, a cost-conscious, multi-stage funnel — a free local content filter, then one cheap classification call, then only-if-needed a real search — checks whether your current entry connects to something you wrote before. If it finds a match, it surfaces the connection. If not, it falls back to a short, clearly-labeled, ungrounded conversation-starter instead of staying silent. Either way, **nothing is ever shown or saved without you choosing to act on it.**

**Idea boards**
Manual or Gemini-assisted moodboards for anything you're working on — planning an event, drafting a book, brainstorming. Add ideas and images by hand, or brainstorm with Gemini directly on a board and click to add its suggestions in. Same rule as journaling: Gemini proposes, you confirm.

**Past entries**
Browse your journal by day, month, or year.

## Architecture

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   React +   │─────▶│   Cloud Run (via      │─────▶│  Gemini API      │
│   Vite      │      │   2nd-gen Functions)  │      │  (key from       │
│   frontend  │◀─────│                       │◀─────│  Secret Manager) │
└─────────────┘      └──────────┬────────────┘      └─────────────────┘
       │                        │
       │                        ▼
       │              ┌──────────────────┐
       └─────────────▶│  Cloud Firestore  │
     (Firebase Auth)  │  (named database, │
                       │  uid-scoped)      │
                       └──────────────────┘
```

Every request from the frontend carries a Firebase ID token. The backend verifies it server-side and derives the user's identity *only* from that token — never from anything the client claims in a request body. All Firestore access is scoped to `/users/{uid}/...`, and the app uses its own dedicated named Firestore database so it can safely share a GCP project (and its free-tier credits) with other, unrelated apps without any risk of data collision.

## Tech stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript, running on Cloud Run via Firebase Cloud Functions (2nd gen)
- **Auth:** Firebase Authentication
- **Database:** Cloud Firestore (named database, `uid`-scoped isolation)
- **Storage:** Firebase Cloud Storage (board images)
- **AI:** Gemini API (`gemini-3.6-flash` for conversation/summarization, `gemini-3.5-flash-lite` for cheap relevance classification)
- **Secrets:** Google Cloud Secret Manager

## Security highlights

- Identity is derived exclusively from a verified Firebase ID token — never trusted from client input
- Firestore Security Rules provide a second, independent isolation layer, since the Admin SDK bypasses rules entirely
- The Gemini system prompt explicitly treats user content as data, never as instructions — a direct defense against prompt-injection attempts embedded in journal text
- Rate limiting and input-size caps guard every AI-calling endpoint against quota exhaustion or cost abuse
- The Gemini API key runs on the free tier with no billing account attached — quota exhaustion fails gracefully, it never bills

## Setup and deployment

Full step-by-step instructions — including Google Cloud Shell setup, Secret Manager configuration, and cost-safety guardrails — are in [`docs/deployment-guide.md`](docs/deployment-guide.md).

Quick start:
```bash
git clone <this-repo>
cd personal-gemini-journal

# Backend
cd functions && npm install && npm run build

# Frontend
cd ../web && npm install
cp .env.example .env   # fill in your Firebase web app config

# Local emulator test
cd ..
firebase emulators:start --only functions,firestore,auth,storage
```

## Project structure

```
personal-gemini-journal/
├── docs/
│   ├── ai-studio-constitution.md   # the Phase 1 security constitution
│   └── deployment-guide.md         # full setup walkthrough
├── firestore.rules
├── storage.rules
├── functions/                      # Cloud Functions backend (TypeScript/Express)
│   └── src/
│       ├── index.ts
│       ├── auth-triggers.ts        # invite-only allowlist blocking function
│       ├── middleware/
│       ├── routes/
│       └── services/
└── web/                            # React + Vite frontend
    └── src/
        ├── pages/
        ├── components/
        └── lib/
```

## License

MIT (or update to whatever you'd prefer for the submission).
