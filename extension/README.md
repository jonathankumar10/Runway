# Runway Browser Extension

Detects job listings on LinkedIn, shows a sidebar panel to review and save them, and adds LinkedIn recruiter profiles to Runway's Outreach tracker.

## One-time setup

### 1. Create a Chrome OAuth client

The extension uses `chrome.identity` for Google sign-in. You need a separate OAuth client for it:

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) (same project as your Firebase app: `runway-jonathanpasupulety`)
2. **Create Credentials → OAuth client ID**
3. Application type: **Chrome Extension**
4. Load the extension unpacked first (step 3 below), then copy the **Extension ID** from `chrome://extensions` and paste it here
5. Copy the generated **Client ID** (looks like `123456789.apps.googleusercontent.com`)
6. Paste it into `manifest.json` under `oauth2.client_id`

### 2. Build

```bash
cd extension
npm install
npm run build
```

### 3. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder (not `extension/dist/`)
5. Copy the **Extension ID** shown — you'll need it for step 1 above if you haven't done it yet

### 4. Sign in

Click the Runway icon in the toolbar → **Sign in with Google** using the same account you use on Runway.

---

## Usage

| Page | What appears |
|------|-------------|
| LinkedIn job search / feed pages | Floating Runway launcher → opens sidebar with detected jobs |
| LinkedIn direct job page (`/jobs/view/…`) | Sidebar with full job detail + "Add to Runway" button |
| `linkedin.com/in/*` (recruiters only) | **Track in Runway** button in the profile action bar |

The recruiter button only appears when the profile headline contains recruiter keywords (recruiter, talent, hiring, sourcer, people ops, etc.).

---

## Development

```bash
npm run watch   # rebuilds on file changes
```

Reload the extension in `chrome://extensions` after each build (click the refresh icon on the extension card).

---

## Architecture

### Build system (`build.js`)

- **esbuild** bundles all entry points: `background.js`, `content-jobs.js`, `content-profile.js`, `popup.js`
- Firebase config is injected at compile time from the root `.env` via esbuild `define` — no secrets in source
- Watch mode produces inline sourcemaps; production builds are minified
- `content.css` is copied directly to `dist/` (not bundled)

---

### Job scraping — LinkedIn (`content-jobs.js`)

Runs on all `linkedin.com` pages. Detects job context and populates the sidebar panel.

**Page detection**
- `/jobs/view/{id}` — direct job page
- `/jobs/…?currentJobId={id}` — split-pane search/feed view

**Data extracted per job**

| Field | Source |
|-------|--------|
| Role | `<a href="/jobs/view/{id}">` title link (immune to third-party injections) |
| Company | `/company/` anchor in detail pane |
| Location | Dot-separated subtitle line, parsed to strip company and noise |
| Job description | `#job-details`, `jobs-description__content`, or largest text block fallback (up to 5,000 chars) |
| Salary | LinkedIn salary element or regex match from description |
| Posted time | Relative time text (e.g. "3 days ago") |
| Applicant count | "over 200 applicants" text |
| Work arrangement | Tags parsed from pill elements (Remote / Hybrid / On-site) |
| Job type | Tags (Full-time / Part-time / Contract / Internship) |
| Connections | Alumni/connection count text near the top card |
| Logo | `media.licdn.com` image matched to company name |

**Robustness**
- Filters out text injected by third-party extensions (Jobright "High Match" overlays, etc.) via `INJECTED_TEXT_RE`
- Multi-strategy company name cleaning: strips follower counts, "promoted", connection counts that LinkedIn concatenates into the company name
- SPA navigation watcher via `MutationObserver` — re-runs detection on URL change since LinkedIn doesn't do full page reloads
- `expandDescription()` auto-clicks "See more" before scraping so the full description is captured

---

### Sidebar panel (`runway-panel.js`)

A persistent sidebar injected into the page DOM.

**Modes**

| Mode | When | What's shown |
|------|------|-------------|
| Browse | Search/feed pages with multiple jobs | Primary job card (company logo/avatar, role, salary, work type, job type, visa status, connections, description preview) + scrollable list of other detected jobs |
| Job review | Direct single-job page | Pre-filled editable form (title, URL, company, description) to review before saving |
| Apply | (Wired up, for ATS form pages) | Matched Runway application, resume attach, cover letter generation, autofill button |

**UI details**
- Floating circular launcher (Runway logo mark) — click to slide the panel open
- Auto-detects page background luminance to switch between dark/light themes
- Sets extension icon badge count to number of detected jobs
- Visa sponsorship parsed from description: "will not sponsor" → `No sponsorship`, "we sponsor" → `Visa sponsored`, ambiguous → `Check posting`
- Company avatars: logo image with colored-initial fallback keyed by company name

---

### Recruiter tracking — LinkedIn profiles (`content-profile.js`)

Runs on `linkedin.com/in/*` pages.

- Checks the profile headline against `RECRUITER_KEYWORDS` regex (recruiter, talent, hiring, hr, staffing, sourcer, acquisition, etc.)
- If matched, injects a **Track in Runway** button into the profile action bar
- Extracts: name (`<h1>`), headline, company (from "at Company" in headline, or first experience entry)
- Sends `ADD_RECRUITER` to background → writes to `users/{uid}/outreach` in Firestore
- Re-runs on SPA navigation (LinkedIn profile-to-profile navigation without page reload)

---

### Background service worker (`background.js`)

Handles all auth and data operations. Content scripts communicate exclusively through `chrome.runtime.sendMessage`.

**Auth flow**
1. `SIGN_IN` — launches Google OAuth via `chrome.identity.launchWebAuthFlow`, exchanges access token for a Firebase ID token via Identity Toolkit API, stores ID token + refresh token + expiry in `chrome.storage.local`
2. Token auto-refresh — `getValidIdToken()` checks expiry (5-min buffer) and uses the stored refresh token to get a new ID token silently before making any Firestore or Functions call
3. `SIGN_OUT` — clears all stored tokens

**Message handlers**

| Message | Action |
|---------|--------|
| `SIGN_IN` | Google OAuth → Firebase ID token, stored locally |
| `SIGN_OUT` | Clears all stored auth tokens |
| `GET_STATUS` | Returns current sign-in state + email for popup |
| `ADD_JOB` | Validates payload, writes to Firestore `applications/`, then calls `prepareApplication` Cloud Function (async, non-blocking) |
| `ADD_RECRUITER` | Writes to Firestore `outreach/` |
| `GET_AUTOFILL_PROFILE` | Reads `settings/preferences` + default resume, derives autofill fields from parsed resume structure |
| `GET_APPLY_RESOURCES` | Returns tailored resumes ranked by page context match score, plus default resume |
| `GENERATE_COVER_LETTER` | Calls `generateCoverLetter` Cloud Function |
| `DRAFT_APPLICATION_ANSWER` | Calls `draftApplicationAnswer` Cloud Function |
| `SET_JOB_BADGE` | Sets extension icon badge count (from content script) |

**Firestore access** — uses the REST API directly (no Firebase JS SDK in the extension) with `Bearer` token auth. Three operations: `firestoreAdd`, `firestoreGet`, `firestoreList`.

---

### Extension popup (`popup.js` / `popup.html`)

Shown when clicking the Runway icon in the Chrome toolbar.

- Checks sign-in state on open (`GET_STATUS`)
- **Sign in with Google** button triggers `SIGN_IN` message to background
- Shows signed-in user email + initial avatar
- **Open Runway** button opens the web app in a new tab
- Sign-out clears session

---

### Import utilities (`import-utils.js`)

Shared logic used by both background and content scripts:

| Utility | What it does |
|---------|-------------|
| `normalizeJobPayload()` | Builds a canonical job object; defaults stage to `saved`, source to `extension` |
| `detectPlatformFromUrl()` | Maps hostname to ATS slug (`linkedin`, `greenhouse`, etc.) |
| `extractSalaryRange()` | Regex salary parser — handles `$120K`, `$120,000–$150,000/yr`, `150000 USD` formats |
| `inferCompanyDomain()` | Derives company domain for logo fetching (from ATS URL or company name) |
| `buildLogoUrl()` | Returns a Google Favicons URL for the company domain |
| `hasEnoughJobData()` | Gate before Firestore write — requires at least a role or description |
