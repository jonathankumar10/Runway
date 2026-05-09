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

// ── generateInterviewQuestions ────────────────────────────────────────────────
exports.generateInterviewQuestions = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { company, role, jobDescription, count, difficulty } = request.data
  if (!role) return { error: 'INVALID_INPUT' }

  const n = Math.min(Math.max(Number(count) || 5, 1), 15)
  const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium'

  const difficultyGuide = {
    easy: 'behavioral questions, basic technical concepts, motivation and background',
    medium: 'moderate technical depth, problem-solving scenarios, system design basics',
    hard: 'advanced system design, complex algorithms, leadership and ambiguity under pressure',
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: `You are an expert interviewer generating practice interview questions.
Return ONLY a JSON array of ${n} question strings. No numbering, no prefixes.
Difficulty: ${diff} — ${difficultyGuide[diff]}
Make questions specific to the role and company context. Avoid generic questions.`,
      messages: [{
        role: 'user',
        content: `Company: ${company || 'a tech company'}\nRole: ${role}${jobDescription ? `\n\nJob Description:\n${jobDescription.slice(0, 3000)}` : ''}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const arr = raw.startsWith('[') ? JSON.parse(raw) : JSON.parse(raw.match(/\[[\s\S]*\]/)[0])
    return { questions: arr.filter(q => typeof q === 'string').slice(0, n) }
  } catch (err) {
    console.error('generateInterviewQuestions error:', err)
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

// ── tailorResume ──────────────────────────────────────────────────────────────
exports.tailorResume = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { resumeText, company, role, jobDescription, keySkills, gaps, sectionOrder } = request.data
  if (!resumeText || !role) return { error: 'INVALID_INPUT' }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

  const sectionHint = sectionOrder?.length
    ? `\nThe original resume has these sections IN THIS EXACT ORDER — preserve this order: ${sectionOrder.join(' → ')}`
    : ''

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are an expert resume writer. Tailor the given resume for a specific job role.

Return ONLY valid JSON in this exact shape:
{
  "suggestions": ["what you changed and why", ...],  // 4-6 items
  "sections": [
    {
      "type": "header",
      "name": "Full Name",
      "contact": ["email", "phone", "city", "linkedin url", ...]
    },
    {
      "type": "experience",
      "title": "SECTION TITLE AS IN ORIGINAL",
      "entries": [
        {
          "role": "Job Title",
          "company": "Company Name",
          "location": "City, ST or Remote",
          "dates": "Month Year – Month Year",
          "bullets": ["accomplishment bullet", ...]
        }
      ]
    },
    {
      "type": "education",
      "title": "SECTION TITLE AS IN ORIGINAL",
      "entries": [
        {
          "degree": "BS Computer Science",
          "school": "University Name",
          "location": "City, ST",
          "dates": "2018 – 2022",
          "details": ["GPA: 3.8", "Relevant coursework: ..."]
        }
      ]
    },
    {
      "type": "skills",
      "title": "SECTION TITLE AS IN ORIGINAL",
      "groups": [
        { "label": "Languages", "items": ["Python", "JavaScript"] },
        { "label": "", "items": ["AWS", "Docker"] }
      ]
    },
    {
      "type": "generic",
      "title": "SECTION TITLE AS IN ORIGINAL",
      "entries": [
        {
          "heading": "Project or item title",
          "subheading": "optional subtitle or date",
          "bullets": ["detail", ...]
        }
      ]
    }
  ]
}

Rules:
- NEVER fabricate experience, credentials, or skills not in the original resume
- Preserve EVERY section from the original — do not drop any sections${sectionHint}
- Use the exact section titles from the original (e.g. "WORK EXPERIENCE" not "EXPERIENCE")
- Reword bullets to emphasise skills relevant to the job description
- Add missing keywords naturally if the experience genuinely supports them
- Keep all dates, companies, schools, and GPAs exactly as in the original`,
      messages: [{
        role: 'user',
        content: `COMPANY: ${company || 'Unknown'}\nROLE: ${role}\nKEY SKILLS: ${(keySkills || []).join(', ')}\nJOB DESCRIPTION:\n${(jobDescription || 'Not provided').slice(0, 3000)}\nGAPS TO ADDRESS: ${(gaps || []).join('; ') || 'None'}\n\nORIGINAL RESUME:\n${resumeText.slice(0, 6000)}`,
      }],
    })

    const raw = response.content[0].text.trim()
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    return {
      suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
      sections: Array.isArray(json.sections) ? json.sections : [],
    }
  } catch (err) {
    console.error('tailorResume error:', err)
    return { error: 'GENERATION_ERROR' }
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

      // Interview prep reminders: interview in next 24-48h
      const allSnap = await db.collection(`users/${uid}/applications`).get()
      for (const appDoc of allSnap.docs) {
        const app = appDoc.data()
        const interviewDates = app.interviewDates ?? []
        for (const ts of interviewDates) {
          const d = ts?.toDate ? ts.toDate() : new Date(ts)
          const hoursUntil = (d.getTime() - Date.now()) / 3600000
          if (hoursUntil > 0 && hoursUntil <= 48) {
            const h = Math.round(hoursUntil)
            const message = `Interview in ${h}h: ${app.company} – ${app.role}. Time to prep!`
            await writeNotification(uid, 'interview_prep', appDoc.id, message)
            if (prefs.emailReminders && prefs.email) {
              await sendEmail(prefs.email, `Interview reminder: ${app.company}`, message)
            }
          }
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
