# Runway

An AI-powered job search tracker. Track every application on a Kanban board, score your resume against job descriptions, generate tailored resumes, and prep for interviews — all in one place.

## Features

- **Kanban Board** — drag-and-drop pipeline across 9 stages: Saved, Applied, Phone Screen, Technical Interview, Final Round, Offer, Accepted, Rejected, Withdrawn
- **AI Resume Match** — scores your resume against a job (0–100), surfaces strengths, gaps, and copy-paste resume suggestions
- **AI Tailored Resume** — rewrites your resume for a specific role; edit inline and download as PDF
- **Auto-Import** — paste a job URL and Claude extracts company, role, salary, location, skills, and job description automatically
- **Bulk Import** — paste multiple URLs at once; each job is extracted and saved in sequence
- **Interview Prep** — generate role-specific practice questions at Easy / Medium / Hard difficulty
- **Follow-Up Drafting** — AI writes a professional follow-up email for any application
- **Dashboard** — pipeline funnel, weekly application chart, upcoming interview countdown, and next-move recommendations
- **Resume Library** — upload and manage multiple PDFs; auto-detects tech skills; one resume is the default for all AI features
- **Notifications** — hourly server-side check sends follow-up reminders (stale applications) and interview prep alerts via browser push and email

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Routing | React Router v7 |
| Drag-and-drop | @dnd-kit |
| PDF parsing | pdfjs-dist (client-side) |
| Auth | Firebase Auth (Google OAuth + email/password) |
| Database | Firestore (real-time) |
| Push notifications | Firebase Cloud Messaging |
| Backend | Firebase Cloud Functions v2 (Node.js) |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Email | Nodemailer + Gmail |
| Deployment | Netlify (frontend) + Firebase (functions + database) |

## Project Structure

```
src/
├── App.jsx                        # Root — wraps providers
├── router.jsx                     # Routes + auth guards
├── constants/stages.js            # 9 pipeline stage definitions
├── lib/firebase.js                # Firebase app, Firestore, Auth, FCM
├── context/
│   ├── AuthContext.jsx            # Auth state + sign-in/out methods
│   └── JobsContext.jsx            # Real-time Firestore job subscription
├── hooks/
│   ├── useJobMutations.js         # addJob, updateJob, updateStage, deleteJob
│   ├── useAI.js                   # Calls to all Cloud Functions
│   └── useNotifications.js        # Firestore notifications + FCM setup
├── pages/
│   ├── LandingPage.jsx            # Marketing / unauthenticated home
│   ├── LoginPage.jsx              # Google sign-in
│   ├── BoardPage.jsx              # Kanban board
│   ├── DashboardPage.jsx          # Stats + charts
│   ├── ResumePage.jsx             # Resume library
│   └── ApplicationDetailPage.jsx  # Full per-job workspace
├── components/
│   ├── layout/                    # Layout shell + Sidebar
│   ├── board/                     # Board, columns, cards, quick-view panel
│   ├── dashboard/                 # Funnel, weekly chart, countdown, next moves
│   ├── modals/                    # Add/edit job, bulk import, JD parser, resume editor
│   └── ui/                       # Notification bell, coaching panel, loading screen
functions/
└── index.js                       # 7 Cloud Functions + hourly notification scheduler
```

## Firestore Data Model

```
users/{uid}/
  applications/{jobId}    — job applications (stage, scores, notes, tailored resume, etc.)
  resumes/{resumeId}      — uploaded PDFs (base64 + extracted text)
  notifications/{id}      — system alerts (follow-up reminders, interview prep)
  fcmTokens/{token}       — registered browser push tokens
  settings/preferences    — followUpDays, emailReminders, email
```

Security rules allow a user to read and write only their own subtree (`request.auth.uid == userId`).

## Cloud Functions (AI)

| Function | Input | Output |
|---|---|---|
| `parseJD` | Job description text | company, role, salary, location, skills |
| `importFromUrl` | Job posting URL | Same as parseJD + full job description |
| `matchResume` | Resume text + job details | Score 0–100, highlights, gaps, resume suggestions |
| `getCoaching` | Stage + company + role | 4 actionable coaching tips |
| `draftFollowUp` | Company, role, stage, days since applied | Email subject + body |
| `generateInterviewQuestions` | Company, role, JD, count, difficulty | Array of practice questions |
| `tailorResume` | Resume text + full job context | Structured resume JSON + change summary |
| `notificationChecker` | *(scheduled, runs hourly)* | Writes notifications + sends FCM push + email |

Web URL imports use `importFromUrl` and save through the app's job mutations. The browser extension has a separate authenticated page-scraping path for sites that require login, such as LinkedIn and Workday.

See [Import Strategy](docs/import-strategy.md) for the current plan around web import, extension import, and job-site coverage.

See [Extension Apply Assistant Roadmap](docs/extension-apply-assistant-roadmap.md) for the planned end-to-end extension flow: save a job, score the base resume, generate a tailored resume, assist with ATS autofill, and help draft application answers.

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore, Authentication, Cloud Functions, and Cloud Messaging enabled
- An Anthropic API key
- Gmail credentials for email reminders (optional)

### Environment Variables

Create a `.env` file at the project root:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_VAPID_KEY=
```

For Cloud Functions, store secrets via Firebase Secret Manager:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_PASS
```

### Local Development

```bash
# Install frontend dependencies
npm install

# Start the dev server
npm run dev

# Install functions dependencies
cd functions && npm install
```

### Deploy

```bash
# Deploy frontend to Netlify (or run npm run build and upload dist/)
npm run build

# Deploy Cloud Functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

## Authentication

- **Google OAuth** — one click, no email verification required
- **Email/password** — requires email verification before access is granted; unverified users are redirected to a verify-pending state

## License

MIT
