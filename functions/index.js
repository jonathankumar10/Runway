const { onCall } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const Anthropic = require('@anthropic-ai/sdk')
const nodemailer = require('nodemailer')

admin.initializeApp()
const db = admin.firestore()

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')
const GMAIL_USER = defineSecret('GMAIL_USER')
const GMAIL_PASS = defineSecret('GMAIL_PASS')
const HUNTER_API_KEY = defineSecret('HUNTER_API_KEY')

// ── parseJD ──────────────────────────────────────────────────────────────────
exports.parseJD = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { text } = request.data
  if (!text || typeof text !== 'string' || text.length > 20000) {
    return { error: 'INVALID_INPUT' }
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `Extract job application details from the job description provided.
Return ONLY valid JSON with exactly these keys:
- company (string or null)
- role (string or null)
- salaryMin (number in USD or null)
- salaryMax (number in USD or null)
- jobUrl (string or null, must be a full URL)
- location (string or null, e.g. "Remote" or "New York, NY")
- keySkills (array of strings, max 8, most important technical skills)

If a value cannot be determined, use null. Do not include any text outside the JSON.`,
      messages: [{ role: 'user', content: text.slice(0, 15000) }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return json
  } catch (err) {
    console.error('parseJD error:', err)
    return { error: 'PARSE_ERROR' }
  }
})

// ── getCoaching ───────────────────────────────────────────────────────────────
exports.getCoaching = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { stage, company, role } = request.data
  if (!stage || typeof stage !== 'string') return { error: 'INVALID_INPUT' }

  const stageGuide = {
    applied: 'crafting a strong follow-up, what to research about the company and team, timeline expectations',
    phoneScreen: 'common phone screen questions for this role, how to articulate experience concisely, questions to ask the recruiter',
    technicalInterview: 'expected technical depth, system design likelihood, DSA focus areas, how to structure problem solving explanations',
    finalRound: 'behavioral interview prep using STAR format, executive-level questions, thoughtful questions to ask the panel',
    offer: 'salary negotiation tactics, evaluating the total compensation package, counter-offer strategy, what to ask before accepting',
  }

  const guide = stageGuide[stage]
  if (!guide) return { tips: [] }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: `You are a job search coach giving concise, actionable advice.
Return ONLY a JSON array of 4 short tip strings (each under 15 words). No other text.
Example: ["Research the team on LinkedIn before the call", "Prepare 2-3 questions about the role scope"]`,
      messages: [{
        role: 'user',
        content: `Stage: ${stage}\nCompany: ${company || 'a company'}\nRole: ${role || 'Software Engineer'}\nFocus: ${guide}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const arr = raw.startsWith('[') ? JSON.parse(raw) : JSON.parse(raw.match(/\[[\s\S]*\]/)[0])
    return { tips: arr.filter(t => typeof t === 'string').slice(0, 5) }
  } catch (err) {
    console.error('getCoaching error:', err)
    return { tips: [] }
  }
})

// ── draftFollowUp ─────────────────────────────────────────────────────────────
exports.draftFollowUp = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { company, role, stage, recruiterName, daysSinceApplied } = request.data
  if (!company || !role) return { error: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: `You are writing a professional, concise follow-up email for a job applicant.
Rules:
- Subject line: short and clear
- Body: under 100 words, professional tone, no filler phrases
- Do NOT fabricate facts not provided
- Return ONLY valid JSON: {"subject": "...", "body": "..."}`,
      messages: [{
        role: 'user',
        content: `Company: ${company}\nRole: ${role}\nStage: ${stage}\nRecruiter: ${recruiterName || 'Hiring Team'}\nDays since applied: ${daysSinceApplied ?? 'unknown'}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return json
  } catch (err) {
    console.error('draftFollowUp error:', err)
    return { error: 'GENERATION_ERROR' }
  }
})

// ── matchResume ───────────────────────────────────────────────────────────────
exports.matchResume = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { resumeText, company, role, keySkills, notes } = request.data
  if (!resumeText || !role) return { error: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: `You are a resume-job match evaluator.
Given a resume and a job posting, return ONLY valid JSON with:
- score (integer 0-100, how well the resume matches the job)
- highlights (array of 3 strings: strongest matching qualifications)
- gaps (array of up to 3 strings: missing or weak areas)
- resumeSuggestions (array of 4-5 objects, each with:
    "section": the resume section to update (e.g. "Skills", "Summary", "Professional Experience")
    "suggestion": a single, specific, ready-to-use line of text the user can add or substitute — write the actual text, not advice about it)

resumeSuggestions must be concrete additions: exact bullet points, skill lists, or summary sentences the user can paste straight in. Not general advice. No text outside the JSON.`,
      messages: [{
        role: 'user',
        content: `JOB: ${company || ''} — ${role}\nKey skills required: ${(keySkills || []).join(', ')}\nAdditional context: ${notes || 'none'}\n\nRESUME:\n${resumeText.slice(0, 8000)}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return {
      score: Math.min(100, Math.max(0, Number(json.score))),
      highlights: json.highlights ?? [],
      gaps: json.gaps ?? [],
      resumeSuggestions: Array.isArray(json.resumeSuggestions) ? json.resumeSuggestions : [],
    }
  } catch (err) {
    console.error('matchResume error:', err)
    return { error: 'MATCH_ERROR' }
  }
})

// ── findRecruiter ─────────────────────────────────────────────────────────────
exports.findRecruiter = onCall({ secrets: [HUNTER_API_KEY], cors: true }, async (request) => {
  const { domain } = request.data
  const uid = request.auth?.uid
  if (!domain || typeof domain !== 'string') return { error: 'INVALID_INPUT' }

  const normalized = domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

  if (!normalized) return { error: 'INVALID_INPUT' }

  // Check Firestore cache (30-day TTL) before hitting Hunter API
  if (uid) {
    try {
      const cacheRef = db.collection('users').doc(uid).collection('recruiterCache').doc(normalized)
      const cacheSnap = await cacheRef.get()
      if (cacheSnap.exists) {
        const cached = cacheSnap.data()
        const ageMs = Date.now() - cached.cachedAt.toMillis()
        if (ageMs < 30 * 24 * 60 * 60 * 1000) {
          return { recruiters: cached.recruiters, domain: normalized, fromCache: true }
        }
      }
    } catch (_) { /* cache miss is fine */ }
  }

  // High-confidence recruiter terms (position must contain at least one)
  const RECRUITER_KEYWORDS = ['recruit', 'talent acquisition', 'talent partner', 'sourcer', 'hiring', 'staffing', 'hr generalist', 'hr manager', 'hr business', 'people ops', 'people operations', 'human resources']

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(normalized)}&limit=10&department=hr&api_key=${HUNTER_API_KEY.value()}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const json = await res.json()

    if (!res.ok) {
      const msg = json.errors?.[0]?.details || `Hunter API failed with status ${res.status}`
      return { error: msg }
    }

    const recruiters = (json.data?.emails || [])
      .filter(e => {
        const position = (e.position || '').toLowerCase()
        const department = (e.department || '').toLowerCase()
        return RECRUITER_KEYWORDS.some(kw => position.includes(kw) || department.includes(kw))
      })
      .map(e => ({
        name: [e.first_name, e.last_name].filter(Boolean).join(' '),
        email: e.value || '',
        title: e.position || '',
        confidence: e.confidence || 0,
        linkedin: e.linkedin || '',
      }))
      .filter(r => r.name && r.email)
      .sort((a, b) => b.confidence - a.confidence)

    // Store in cache so future searches for this domain skip the API call
    if (uid) {
      db.collection('users').doc(uid).collection('recruiterCache').doc(normalized).set({
        recruiters,
        domain: normalized,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {})
    }

    return { recruiters, domain: normalized, fromCache: false }
  } catch (err) {
    console.error('findRecruiter error:', err)
    return { error: 'FETCH_FAILED' }
  }
})

// ── draftRecruiterOutreach ────────────────────────────────────────────────────
exports.draftRecruiterOutreach = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { company, role, recruiterName, recruiterTitle, senderName } = request.data
  if (!company || !role || !recruiterName) return { error: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: `You are writing a personalized cold outreach message from a job seeker to a recruiter.
Rules:
- Email subject: under 8 words, attention-grabbing, relevant to the role. No clickbait.
- Email body: under 120 words. Professional but warm. End with a clear ask (quick call, 15-min chat). No "I hope this message finds you well." No generic filler.
- LinkedIn message: under 300 characters. Casual, direct. Works as a connection request note or DM.
- Do NOT fabricate facts or credentials.
- Return ONLY valid JSON: {"emailSubject": "...", "emailBody": "...", "linkedInMessage": "..."}`,
      messages: [{
        role: 'user',
        content: `Sender: ${senderName || 'a job seeker'}\nRecruiter: ${recruiterName}${recruiterTitle ? `, ${recruiterTitle}` : ''}\nCompany: ${company}\nRole: ${role}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return json
  } catch (err) {
    console.error('draftRecruiterOutreach error:', err)
    return { error: 'GENERATION_ERROR' }
  }
})

// ── importFromUrl ─────────────────────────────────────────────────────────────
exports.importFromUrl = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { url } = request.data
  if (!url || typeof url !== 'string') return { error: 'INVALID_INPUT' }

  let html
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { error: 'FETCH_FAILED' }
    html = await res.text()
  } catch (err) {
    console.error('importFromUrl fetch error:', err)
    return { error: 'FETCH_FAILED' }
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000)

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `Extract job application details from this job posting page text.
Return ONLY valid JSON with exactly these keys:
- company (string or null)
- role (string or null)
- salaryMin (number in USD or null)
- salaryMax (number in USD or null)
- location (string or null, e.g. "Remote" or "New York, NY")
- jobDescription (string or null, the full job description text, max 3000 chars)
- keySkills (array of strings, max 8, most important technical skills)

If a value cannot be determined, use null. Do not include any text outside the JSON.`,
      messages: [{ role: 'user', content: text }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return json
  } catch (err) {
    console.error('importFromUrl parse error:', err)
    return { error: 'PARSE_ERROR' }
  }
})

// ── parseResumeStructure ──────────────────────────────────────────────────────
exports.parseResumeStructure = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true, timeoutSeconds: 60 }, async (request) => {
  const { resumeText } = request.data
  if (!resumeText || typeof resumeText !== 'string') return { error: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `Parse the resume text into a structured JSON schema. Return ONLY valid JSON (no markdown fences) with this structure:
{
  "header": { "name": "Full Name As Written", "contact": ["item1", "item2", ...] },
  "summary": { "title": "SECTION TITLE", "sentences": ["s1", "s2", "s3"] },
  "skills": [{ "label": "Category Label", "items": ["skill1", "skill2"] }],
  "experience": [{
    "role": "Job Title", "company": "Company", "dates": "Month Year – Month Year",
    "location": "City, ST", "bullets": ["exact bullet text"]
  }],
  "projects": [{
    "name": "Project Name", "url": "https://...", "dates": "Month Year",
    "bullets": ["exact bullet text"]
  }],
  "education": [{
    "degree": "Degree Name", "school": "University", "dates": "Year – Year",
    "location": "City, ST", "details": []
  }]
}
Rules:
- Copy ALL text CHARACTER-FOR-CHARACTER from the original. Never paraphrase or improve.
- Preserve exact capitalization, punctuation, and spacing.
- skills: preserve group labels and items exactly as written.
- contact: list every contact item in order (email, phone, location, LinkedIn URL, GitHub URL, personal site URL, etc.).
- projects.url: if the heading contains a URL after "|", extract it here; omit the URL from name.
- Omit keys not present in the resume (no "summary" key if there is no summary, no "projects" if no projects, etc.).
- Return ONLY the JSON object, no additional text.`,
      messages: [{ role: 'user', content: resumeText.slice(0, 12000) }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return { parsedStructure: json }
  } catch (err) {
    console.error('parseResumeStructure error:', err)
    return { error: 'PARSE_ERROR' }
  }
})

// ── tailorResume ──────────────────────────────────────────────────────────────
exports.tailorResume = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { resumeText, company, role, jobDescription, keySkills, gaps, sectionOrder, parsedStructure } = request.data
  if (!resumeText || !role) return { error: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  const sectionHint = sectionOrder?.length
    ? `The original resume sections IN THIS EXACT ORDER: ${sectionOrder.join(' > ')}`
    : ''

  let lockedSkillsHint = ''
  let bulletCountHint = ''
  if (parsedStructure) {
    if (parsedStructure.skills?.length) {
      lockedSkillsHint = `\n\nLOCKED SKILLS — the sections[].type="skills" output MUST exactly match this JSON (no additions, no removals, no reordering of groups or items):\n${JSON.stringify(parsedStructure.skills)}`
    }
    const bulletLines = []
    for (const e of parsedStructure.experience ?? []) {
      bulletLines.push(`"${e.role} at ${e.company}": exactly ${e.bullets.length} bullets`)
    }
    for (const p of parsedStructure.projects ?? []) {
      bulletLines.push(`project "${p.name}": exactly ${p.bullets.length} bullets`)
    }
    if (bulletLines.length) {
      bulletCountHint = `\n\nLOCKED BULLET COUNTS — each entry must have exactly this many bullets (from parsed resume structure):\n${bulletLines.join('\n')}`
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `You are a senior technical recruiter and Certified Professional Resume Writer (CPRW) with 15 years of experience screening software engineers at FAANG companies and Series B+ startups.

Analyze the job description against the candidate's resume and produce a full ATS-optimization package.

Return ONLY valid JSON with this exact structure:
{
  "suggestions": ["string", ...],
  "keywordAnalysis": {
    "extracted": ["string", ...],
    "mapped": [{ "keyword": "string", "experience": "string", "action": "added | strengthened" }],
    "unmappable": ["string", ...]
  },
  "rewrittenSummary": ["line1", "line2", "line3"],
  "rewrittenBullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5", "bullet6", "bullet7", "bullet8", "bullet9", "bullet10"],
  "sections": [
    { "type": "header", "name": "Exact Name From Resume", "contact": ["email", "phone", "city", "linkedin url"] },
    { "type": "summary", "title": "SECTION TITLE AS IN ORIGINAL", "bullets": ["line1", "line2", "line3"] },
    { "type": "experience", "title": "SECTION TITLE AS IN ORIGINAL", "entries": [{ "role": "Job Title", "company": "Company Name", "location": "City, ST", "dates": "Month Year - Month Year", "bullets": ["bullet", ...] }] },
    { "type": "education", "title": "SECTION TITLE AS IN ORIGINAL", "entries": [{ "degree": "BS Computer Science", "school": "University Name", "location": "City, ST", "dates": "2018 - 2022", "details": ["GPA: 3.8"] }] },
    { "type": "skills", "title": "SECTION TITLE AS IN ORIGINAL", "groups": [{ "label": "Languages", "items": ["Python"] }] },
    { "type": "generic", "title": "SECTION TITLE AS IN ORIGINAL", "entries": [{ "heading": "title", "subheading": "date", "bullets": ["detail"] }] }
  ]
}

Field definitions:
- suggestions: 4-6 plain-English summaries of key tailoring changes made
- keywordAnalysis.extracted: EVERY required hard skill, tool, and framework from the JD (explicit and implied)
- keywordAnalysis.mapped: keywords addressed in the resume, with which experience they map to and what action was taken
- keywordAnalysis.unmappable: keywords that CANNOT be added because the candidate has no matching experience
- rewrittenSummary: exactly 3 sentences (not bullets), each ≤ 150 characters, each directly mirroring one of the JD's top 3 requirements using the candidate's real credentials; start each sentence strong with a concrete claim
- rewrittenBullets: exactly 10 ATS-optimized bullets for the candidate's most relevant experience role; wrap every JD keyword in **bold** markdown
- sections[].type "summary": sentences must be EXACTLY the same 3 lines as rewrittenSummary — do not write a separate summary
${sectionHint}

PAGE-FIT RULES — the output must fit on one printed page; violations cause resume overflow:
- HARD LIMIT: every bullet in sections[] (experience AND projects) must be ≤ 130 characters including spaces. Count every character. If a bullet exceeds 130 characters, cut words until it fits.
- rewrittenBullets follow the same 130-character hard limit.
- Match the original bullet count exactly for each job/project — do not add bullets.
- Do not pad bullets with extra context phrases like "demonstrating...", "in a fast-moving environment", "aligned with..." — cut these fillers.

STRICT PRESERVATION RULES — violations will break the output:
- Name: copy the candidate's name EXACTLY as it appears in the original resume, preserving its capitalization (e.g., "Jonathan Pasupulety", never "JONATHAN PASUPULETY")
- Contact: include EVERY contact item from the original resume in the contact array — email, phone, location, LinkedIn, GitHub, personal site, etc. Do not drop any.
- Skills section: for each group, copy the label and items CHARACTER-FOR-CHARACTER from the original resume. If the original says "SQL (PostgreSQL, MySQL)" write exactly "SQL (PostgreSQL, MySQL)" — never "SQL (PostgreSQL, MySQL, SQL Server-equivalent)" or any extended variant. Adding a skill not in the original is a critical error.
- Do NOT fabricate experience, credentials, companies, schools, dates, locations, GPAs, or skills not in the original resume
- Map missing JD keywords to the closest genuine experience in bullets only; never insert JD keywords into the skills section
- Preserve ALL sections from the original; use exact section titles from the original
- sections[].type="experience" MUST include EVERY job entry from the original resume in the same order — never drop a job to save space
- sections[].type="experience" bullets: rewrite bullet TEXT only; do NOT change bullet count, do NOT add or remove entries
- rewrittenBullets are for the Analysis panel only — do NOT use them to replace or inflate bullets in sections[]
${lockedSkillsHint}${bulletCountHint}

ATS bullet rules (apply to rewrittenBullets AND all experience bullets in sections):
- Begin every bullet with a strong action verb: Spearheaded, Engineered, Architected, Optimized, Automated, Orchestrated, Deployed, Migrated, Designed, Built, Implemented, Streamlined, Reduced, Accelerated, Delivered, Launched, Scaled, Consolidated
- Never use: "Responsible for", "Worked on", "Helped", "Assisted", "Participated in"
- Quantify results with numbers, percentages, or dollar amounts ONLY when the original resume already provides those metrics; do NOT invent any numbers
- Bold every JD keyword using **keyword** markdown
- Frame every bullet as accomplishment and business impact, not daily duties
- Do not use em dashes anywhere in the output`,
      messages: [{
        role: 'user',
        content: `COMPANY: ${company || 'Unknown'}\nROLE: ${role}\nKEY SKILLS: ${(keySkills || []).join(', ')}\nJOB DESCRIPTION:\n${(jobDescription || 'Not provided').slice(0, 4000)}\nGAPS TO ADDRESS: ${(gaps || []).join('; ') || 'None'}\n\nORIGINAL RESUME:\n${resumeText.slice(0, 6000)}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return {
      suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
      keywordAnalysis: {
        extracted: Array.isArray(json.keywordAnalysis?.extracted) ? json.keywordAnalysis.extracted : [],
        mapped: Array.isArray(json.keywordAnalysis?.mapped) ? json.keywordAnalysis.mapped : [],
        unmappable: Array.isArray(json.keywordAnalysis?.unmappable) ? json.keywordAnalysis.unmappable : [],
      },
      rewrittenSummary: Array.isArray(json.rewrittenSummary) ? json.rewrittenSummary.slice(0, 3) : [],
      rewrittenBullets: Array.isArray(json.rewrittenBullets) ? json.rewrittenBullets.slice(0, 10) : [],
      sections: Array.isArray(json.sections) ? json.sections : [],
    }
  } catch (err) {
    console.error('tailorResume error:', err)
    return { error: 'GENERATION_ERROR' }
  }
})

// ── processCompanyPrompt ──────────────────────────────────────────────────────
exports.processCompanyPrompt = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { instruction, companyNames } = request.data
  if (!instruction || typeof instruction !== 'string') return { op: 'error', message: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You manage a job search target companies list for a software engineer.
Engineer background: 4 years at Amazon, Java/Spring Boot backend, AWS distributed systems, platform automation, H-1B visa needing sponsorship.

Given an instruction, return exactly ONE JSON operation (no other text):

Add one:  {"op":"add","company":{"name":"...","domain":"...","space":"...","stage":"...","notes":"...","targetRoles":"...","careersUrl":"...","searchQuery":"..."}}
Add many: {"op":"add","companies":[{"name":"...","domain":"...","space":"...","stage":"...","notes":"...","targetRoles":"...","careersUrl":"...","searchQuery":"..."}]}
Remove:   {"op":"remove","name":"..."}
Update:   {"op":"update","name":"...","updates":{"field":"value"}}
Error:    {"op":"error","message":"..."}

For "add": generate realistic values. domain = primary domain (no https). targetRoles = 2–4 relevant roles comma-separated. careersUrl = likely URL. searchQuery = LinkedIn/Hunter search string. notes = 1–2 sentences on fit with engineer background. stage = "Startup / growth" | "Mid-size / growth" | "Large startup / growth" | "Public / mid-large".
When the instruction asks for multiple companies (e.g. "add 10 similar companies"), use the "companies" array form and include ALL requested companies in a single response.
Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Current companies: ${(companyNames || []).join(', ')}\n\nInstruction: ${instruction}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return json
  } catch (err) {
    console.error('processCompanyPrompt error:', err)
    return { op: 'error', message: 'Failed to process instruction' }
  }
})

// ── notificationChecker ───────────────────────────────────────────────────────
exports.notificationChecker = onSchedule(
  { schedule: 'every 1 hours', secrets: [GMAIL_USER, GMAIL_PASS] },
  async () => {
    const now = admin.firestore.Timestamp.now()
    const usersSnap = await db.collection('users').get()

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id
      const prefsDoc = await db.doc(`users/${uid}/settings/preferences`).get()
      const prefs = prefsDoc.exists ? prefsDoc.data() : {}
      const followUpDays = prefs.followUpDays ?? 7

      const cutoff = new Date(Date.now() - followUpDays * 86400000)
      const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff)

      // Follow-up reminders: applied + stale
      const staleSnap = await db
        .collection(`users/${uid}/applications`)
        .where('stage', '==', 'applied')
        .where('lastStatusChange', '<', cutoffTs)
        .get()

      for (const appDoc of staleSnap.docs) {
        const app = appDoc.data()
        const message = `Follow up on your ${app.company} – ${app.role} application. No update in ${followUpDays}+ days.`
        await writeNotification(uid, 'follow_up', appDoc.id, message)
        if (prefs.emailReminders && prefs.email) {
          await sendEmail(prefs.email, `Follow up: ${app.company} – ${app.role}`, message)
        }
      }

      // Send FCM push for unread notifications
      const unreadSnap = await db
        .collection(`users/${uid}/notifications`)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()

      if (!unreadSnap.empty) {
        const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get()
        for (const tokenDoc of tokensSnap.docs) {
          const { token } = tokenDoc.data()
          try {
            await admin.messaging().send({
              token,
              notification: { title: 'Runway', body: unreadSnap.docs[0].data().message },
              webpush: { notification: { icon: '/favicon.svg' } },
            })
          } catch {
            // Token may be expired — remove it
            await tokenDoc.ref.delete()
          }
        }
      }
    }
  }
)

async function writeNotification(uid, type, applicationId, message) {
  // Deduplicate: don't write same message twice in 24h
  const recent = await db
    .collection(`users/${uid}/notifications`)
    .where('applicationId', '==', applicationId)
    .where('type', '==', type)
    .where('createdAt', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)))
    .limit(1)
    .get()

  if (!recent.empty) return

  await db.collection(`users/${uid}/notifications`).add({
    type,
    applicationId,
    message,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER.value(), pass: GMAIL_PASS.value() },
    })
    await transporter.sendMail({ from: GMAIL_USER.value(), to, subject, text })
  } catch (err) {
    console.error('Email error:', err)
  }
}
