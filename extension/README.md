# Runway Browser Extension

Detects job listings on supported sites, shows a small **Runway jobs found** launcher when jobs are available, and adds LinkedIn recruiter profiles to Runway.

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

| Page | Button |
|------|--------|
| LinkedIn job search and job detail pages | **Runway jobs found** launcher — review detected jobs and add them to your Applications board |
| Greenhouse, Lever, Ashby, Workday, Taleo, iCIMS, BambooHR, SmartRecruiters pages | **Runway jobs found** launcher — review detected jobs and add them to your Applications board |
| `linkedin.com/in/*` (recruiters only) | **✈ Track in Runway** — adds the person to your Outreach tracker |

The recruiter button only appears when the profile headline contains recruiter keywords (recruiter, talent, hiring, staffing, etc.).

## Development

```bash
npm run watch   # rebuilds on file changes
```

Reload the extension in `chrome://extensions` after each build (click the refresh icon on the extension card).
