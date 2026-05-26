# Extension Apply Assistant Roadmap

This document describes the intended end-to-end flow for the Runway browser extension: from discovering a job, to generating a tailored resume, to helping the user complete the application.

## Target Flow

1. User finds a job on LinkedIn or a supported ATS.
2. The Runway extension detects the job and prompts the user to add it to Runway.
3. Runway saves the application with the best available job data:
   - company
   - role
   - job URL
   - location
   - salary range when present
   - job description
   - source platform
4. Runway compares the user's default/base resume against the job.
5. Runway stores the match score, strengths, gaps, and keyword suggestions on the application.
6. Runway generates a tailored resume for that specific application.
7. The app and extension prompt the user to apply once the tailored resume is ready.
8. On the ATS application form, the extension opens an apply assistant panel.
9. The extension autofills known user profile fields where safe.
10. The extension provides the tailored resume for upload or download.
11. The extension helps draft answers for application questions when needed.
12. The user reviews all fields and manually submits the application.

## Product Principles

- The extension should assist, not silently submit applications.
- The user should review all autofilled fields before submission.
- Resume upload should stay user-controlled because browser extensions cannot reliably and safely upload local files without user interaction.
- Job and application data should be tied back to the Firestore application record.
- The generated resume should be stored per application, not just globally.

## Phase 1: Save, Score, Tailor

Status: initial implementation complete.

After a job is added from the extension:

- Save the job record to `users/{uid}/applications/{jobId}`.
- Ensure the job description is captured when available.
- Run resume match analysis against the user's default resume.
- Store:
  - `matchScore`
  - strengths
  - gaps
  - resume suggestions
  - extracted skills
- Generate a tailored resume for the application.
- Store the tailored resume fields on the same application record.
- Surface a "Tailored resume ready" state in the app and extension.

Current implementation:

- Extension saves the application to Firestore.
- Extension calls `prepareApplication` after save.
- `prepareApplication` reads the user's default resume.
- `prepareApplication` writes match score, highlights, gaps, and suggestions.
- `prepareApplication` generates tailored resume sections and text.
- Applications track `aiPrepStatus`: `matching`, `tailoring`, `ready`, `needs_resume`, or `error`.
- Board cards show lightweight prep status.

## Phase 2: Apply Assistant Panel

Status: MVP implementation in progress.

On supported ATS application pages, the extension should show a top-right Runway assistant panel with:

- application match status
- tailored resume availability
- autofill controls
- resume download/open actions
- question helper actions
- link back to the application in Runway

Expected controls:

- `Autofill application`
- `Use tailored resume`
- `Copy resume text`
- `Open in Runway`
- `Draft answer`

Current implementation:

- Supported ATS pages detect visible application forms.
- A top-right Runway apply assistant panel appears when form fields are present.
- The panel includes `Autofill basics` and `Use tailored resume` controls.
- The current `Use tailored resume` action is guidance-only; download/open integration remains future work.

## Phase 3: Autofill

Status: MVP implementation complete.

The extension should detect common fields and fill them from the user's Runway profile.

Initial field coverage:

- first name
- last name
- email
- phone
- location
- LinkedIn URL
- GitHub URL
- portfolio URL
- current company
- current title
- work authorization
- sponsorship requirement

Autofill should use conservative field matching:

- label text
- placeholder text
- `name`
- `id`
- `aria-label`
- nearby text

The extension should not submit forms automatically.

Current implementation:

- The extension can load a basic autofill profile from extension auth and `settings/preferences`.
- The app Profile page stores autofill fields in `settings/preferences`.
- The panel fills high-confidence empty text, email, phone, URL, select, radio, and checkbox fields.
- Matching uses labels, placeholders, ids, names, aria labels, and nearby text.
- Submit buttons, hidden fields, passwords, and file inputs are not filled.

Current profile coverage:

- first name
- last name
- full name
- email
- phone
- location
- LinkedIn URL
- GitHub URL
- portfolio URL
- salary expectation
- work authorization
- sponsorship requirement
- remote/hybrid/on-site preference

## Phase 4: Resume Handoff

Status: MVP implementation complete.

The extension should provide the tailored resume in a user-controlled way.

Supported actions:

- attach base resume PDF to compatible file inputs
- attempt to attach tailored resume as generated HTML/text
- generate a cover letter/CV for the selected application
- attach the generated cover letter/CV as text to compatible file inputs
- download tailored resume text/HTML
- open tailored resume in Runway
- copy plain resume text
- show upload guidance near file inputs

Fully silent file upload is not a reliable target. Standard file inputs can be populated by the extension with a user action, but some ATS custom upload widgets reject generated files or require a picker-backed local file. In those cases Runway falls back to downloading the file and guiding the user.

Current implementation:

- The apply assistant fetches base resume and ready tailored resume candidates.
- The user can choose `Attach base`, `Attach tailored`, `Generate CV`, `Attach CV`, `Download tailored resume`, or `Download base resume`.
- Base resume attachment uses the stored default resume PDF.
- Tailored resume attachment currently uses generated HTML/text because a tailored PDF artifact is not stored yet.
- Cover letter/CV generation stores `coverLetterText` on the selected application.
- Resume downloads include tailored text, tailored HTML, and base text from the extension panel.
- Tailored HTML can be opened by the user and printed/saved as PDF from the browser.
- When direct attachment fails, the user manually uploads the downloaded file to the ATS file input.
- File inputs get a small Runway note reminding the user to upload the downloaded resume manually.

Remaining work:

- Generate/download direct PDF or DOCX instead of browser-printable HTML.
- Store a tailored PDF artifact so `Attach tailored` can upload PDF instead of HTML/text.
- Store a cover letter PDF artifact so `Attach CV` can upload PDF instead of text.

Application matching update:

- The apply assistant now scores ready tailored resumes against the current page URL and visible page text.
- The panel shows a Runway application selector when candidates exist.
- Resume download and answer drafting use the selected application.
- If the automatic match is wrong, the user can choose the correct application manually.
- The panel can open the selected application in Runway.

## Phase 5: Application Question Helper

Status: MVP implementation complete.

The extension should detect free-text questions and draft answers from:

- user profile
- base resume
- tailored resume
- job description
- company
- role
- stored application notes

Examples:

- Why are you interested in this role?
- Tell us about your experience with React.
- Why do you want to work here?
- Describe a project relevant to this position.

The user should insert generated answers explicitly, one field at a time.

Current implementation:

- The apply assistant includes a `Draft answer` action.
- The user clicks into a textarea first.
- The extension reads the nearby question text.
- The backend drafts an answer from the default resume and latest application context.
- The extension inserts the answer into the textarea for user review.

Remaining work:

- Improve ATS-specific custom dropdown support for Workday, Greenhouse, Lever, and Ashby.
- Provide multiple answer variants before insertion.
- Add per-question citations or source hints from the resume/job description.

Application matching update:

- Question drafting uses the selected Runway application from the apply assistant panel.

## Open Engineering Questions

- Which profile fields should be required before autofill is enabled?
- Should tailored resume generation happen immediately after save or only after user confirmation?
- Should generated resume files be stored in Firebase Storage, Firestore, or generated on demand?
- How should the extension match an ATS form back to a saved application when the user opens an apply URL from LinkedIn?
- Which ATS platforms should get first-class form mappings first?

## Recommended MVP

Build the flow in this order:

1. Extension saves job and triggers enrichment.
2. Backend generates match score and tailored resume.
3. Extension shows "resume ready" for the saved application.
4. Extension autofills basic profile fields on application forms.
5. Extension provides tailored resume download/open actions.
6. Extension drafts answers for long-form questions.
