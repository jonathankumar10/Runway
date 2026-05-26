# Import Strategy

This note captures the current import architecture decision so we can revisit it when improving job-site coverage.

## Current Reality

The web app has two URL import flows:

- Single import fills the application modal for review.
- Bulk import imports each successful URL and saves it through `useJobMutations().addJob()`.

Both flows use the backend `importFromUrl` callable function. That function can only fetch pages that are public, reachable from the server, and parseable from returned HTML.

Because of that, web URL import is not reliable for every job website.

## Explicitly Blocked In Web Import

These sites are currently blocked before calling the backend and should be handled by the browser extension instead:

- LinkedIn: `linkedin.com`, `www.linkedin.com`
- Workday: `*.myworkdayjobs.com`
- Taleo: `*.taleo.net`
- iCIMS: `*.icims.com`
- BambooHR: `*.bamboohr.com`
- SmartRecruiters: `jobs.smartrecruiters.com`

The reason is that these sites commonly require login, dynamic browser state, JavaScript-rendered content, bot protection, or cookies that the backend cannot access.

## Likely Unreliable In Web Import

These may work sometimes, but should not be treated as guaranteed:

- Greenhouse, Lever, Ashby, and Workable pages that block server fetches for some companies.
- Custom company career pages rendered mostly on the client.
- Pages behind SSO, login, Cloudflare, bot checks, geographic blocks, or cookie consent gates.
- Search result pages or listing pages instead of specific job detail pages.

## Recommended Long-Term Model

Use a hybrid import model:

1. Browser extension as the primary universal import path.
   - The extension runs on the actual job page in the user's signed-in browser session.
   - This is the best path for LinkedIn, Workday, Greenhouse, Lever, Ashby, iCIMS, Taleo, BambooHR, SmartRecruiters, and custom company pages.
   - Current extension ATS coverage includes Greenhouse, Lever, Ashby, Workday, Taleo, iCIMS, BambooHR, and SmartRecruiters.

2. Web URL import as a convenience path.
   - Keep single and bulk URL import for public, server-rendered job detail pages.
   - Treat failures as expected for protected or heavily scripted sites.

3. Paste job description fallback.
   - Always let the user paste a job description and URL manually.
   - This keeps resume tailoring and application tracking usable even when extraction fails.

4. Per-site extension extractors.
   - Add and maintain targeted DOM extractors for high-value job sites.
   - Normalize all extracted data into the same internal job shape.

## Internal Job Shape

No matter where the import came from, normalize into:

- `company`
- `role`
- `jobUrl`
- `location`
- `salaryMin`
- `salaryMax`
- `jobDescription`
- `keySkills`
- `source`
- `importMethod`

## Open Product Decisions

These were intentionally not changed during the import cleanup:

- Whether single import should save immediately or require review.
- Whether bulk import should support review/edit before saving.
- Whether extension imports should be merged into the same UI flow as web imports.
- Whether unsupported web imports should automatically route users to extension instructions.
