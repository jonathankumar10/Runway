# Runway

A job search management app — web dashboard + Chrome extension — that helps users track applications, manage resumes, run AI analysis, and discover new jobs.

## Tech Stack

### Web App (`/src`)
- **React 19** + **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no `tailwind.config.js`, configured through CSS)
- **React Router v7** (file-based routes via `AppRouter.jsx`)
- **Firebase v12**: Firestore (real-time listeners), Auth (Google OAuth), Cloud Messaging (push notifications)
- **@dnd-kit** for Kanban drag-and-drop
- **pdfjs-dist** for PDF resume parsing
- **lucide-react** for icons

### Backend (`/functions`)
- **Firebase Cloud Functions v2** (Node.js)
- **Anthropic SDK** (`claude-sonnet-4-6`) — resume match scoring, tailored resume generation, outreach email drafting, job parsing from URL
- **Hunter.io** API — email lookup for outreach
- **JSearch API** — job discovery
- **Nodemailer** — email delivery via Gmail SMTP

### Chrome Extension (`/extension`)
- Manifest v3
- Vanilla JS content scripts (no framework)
- Injects "Save to Runway" buttons on LinkedIn job pages and ATS pages (Greenhouse, Lever, Ashby, Workday, Taleo, iCIMS, BambooHR, SmartRecruiters, Rippling, Breezy, Jobvite, Recruitee)
- Separate content scripts: `content-jobs.js` (LinkedIn jobs), `content-profile.js` (LinkedIn profiles), `content-ats.js` (ATS pages)
- Built via `extension/build.js` (esbuild)

## Project Structure

```
src/
  app/           # App entry: App.jsx, AppProviders.jsx, AppRouter.jsx
  components/    # Shared UI — board/, dashboard/, layout/, modals/, common/, brand/
  context/       # React contexts — auth/, jobs/ (each has Provider, hook, context file)
  hooks/         # Custom hooks: useAI, useJobImport, useJobMutations, useNotifications, usePagination
  lib/           # firebase.js, imports/ (bulk import logic)
  pages/         # Route-level components
  constants/     # stages.js (STAGES array + STAGE_MAP), outreachTemplates.js, resumeTemplates.js
  utils/         # resumeUtils.js
functions/       # Cloud Functions
extension/       # Chrome extension source + build
```

## Key Patterns

### Auth
- `AuthProvider` wraps the app; `useAuth()` returns `{ user }` where `user` is `undefined` while loading, `null` when signed out, or a Firebase user object.
- `isAuthedAndVerified(user)` checks both auth state and email verification.
- Onboarding flag stored in `localStorage` as `runway_onboarded_<uid>`.

### Data
- All user data lives under `users/{uid}/` in Firestore — `applications/`, `resumes/`, `settings/`, `outreach/`, `targets/`.
- `JobsProvider` subscribes to `users/{uid}/applications` via `onSnapshot` and filters to valid stages only.
- Firestore rules: users can only read/write their own documents.

### Application Stages
Defined in `src/constants/stages.js`. Valid stage IDs (in pipeline order):
`saved` → `applied` → `phoneScreen` → `technicalInterview` → `finalRound` → `offer` → `accepted` | `rejected` | `withdrawn`

### AI Features (Cloud Functions)
All AI calls go through Cloud Functions, never directly from the client:
- **Resume match** — scores resume vs job description (0–100), highlights, gaps, suggestions
- **Tailored resume** — rewrites resume sections for a specific job
- **Outreach email** — drafts cold outreach given a contact and job context
- **Import from URL** — fetches a job posting URL, extracts structured job data using Claude

### Extension ↔ Web Communication
The extension writes directly to Firestore using the Firebase JS SDK (authenticated via Google OAuth). The web app listens via `onSnapshot` and picks up changes in real time.

## Dev Commands

```bash
# Web app
npm run dev        # start dev server
npm run build      # production build
npm run lint       # eslint

# Extension
cd extension && npm run build   # esbuild bundle → extension/dist/

# Functions (deploy)
firebase deploy --only functions
```

## Environment Variables

Web app needs a `.env` file with:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Cloud Functions use Firebase Secrets (`defineSecret`): `ANTHROPIC_API_KEY`, `GMAIL_USER`, `GMAIL_PASS`, `HUNTER_API_KEY`, `JSEARCH_API_KEY`.

## Deployment
- Web app hosted on **Firebase Hosting** (also has `netlify.toml` as an alternative)
- Functions deployed to **Firebase Cloud Functions v2**
- Extension loaded unpacked in Chrome (no store listing referenced in code)
