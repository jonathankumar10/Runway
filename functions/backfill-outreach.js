// One-time backfill script — run from the functions/ directory:
//   node backfill-outreach.js
// Uses the access token from `firebase login` (no service account needed)
const fs   = require('fs')
const os   = require('os')
const path = require('path')

const PROJECT_ID = 'runway-jonathanpasupulety'
const API_KEY    = 'AIzaSyAZu4Aqj6K16VuMrmNAcQ-rzFvOBIihXh4'
const USER_EMAIL = 'jonathanpasupulety@gmail.com'

// Read cached tokens from firebase-tools
const configPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json')
const { tokens } = JSON.parse(fs.readFileSync(configPath, 'utf8'))

// ── Template functions ────────────────────────────────────────────────────────

function buildEmailSubject(role, company) {
  if (role) return `${role} – Amazon backend engineer with AWS distributed systems experience`
  return `Backend engineer interested in opportunities at ${company}`
}

function buildEmailBody(recruiterName, company, role) {
  const firstName = (recruiterName || '').split(' ')[0] || 'there'
  const intro = role
    ? `I came across the ${role} role at ${company}`
    : `I am interested in backend/platform engineering opportunities at ${company}`
  return `Hi ${firstName},

I know you likely have a busy schedule, but I wanted to reach out because ${intro} and thought it aligned well with my background.

Quick background: I am a Software Engineer with 4 years of experience at Amazon building backend services, distributed AWS systems, and platform automation.

A few highlights from my experience:

- Built Java/Spring Boot backend services and distributed systems across AWS and Amazon business domains
- Developed merchant-facing platforms supporting 10,000+ merchants and 1M+ shoppers
- Reduced infrastructure costs by 70% and manual validation effort by 80% through automation and system improvements
- Worked with AWS services, DynamoDB, REST APIs, microservices, observability, reliability, and production operations
- Recently used AI-assisted workflows for design reasoning, unit testing, developer productivity, and agentic automation

One important note: I am currently on an H-1B visa and would need a sponsoring employer for transfer. I would also be looking for a team that can support the green card/I-140 process in a reasonable timeline.

If my background looks relevant, I'd be grateful for a quick conversation or a pointer to the right person on your team.

Best,
Jonathan Pasupulety
jonathanpasupulety@gmail.com
linkedin.com/in/jonathanpasupulety`
}

function buildFollowUpSubject(role, company) {
  if (role) return `Following up on ${role} at ${company}`
  return `Following up on opportunities at ${company}`
}

function buildFollowUpBody(recruiterName, company, role) {
  const firstName = (recruiterName || '').split(' ')[0] || 'there'
  const context = role ? `the ${role} role at ${company}` : `opportunities at ${company}`
  return `Hi ${firstName},

Just wanted to follow up on my earlier note regarding ${context}.

I'm very interested in the team and believe my Amazon backend/AWS distributed systems experience could be relevant.

Would be grateful for any guidance or a pointer to the right person.

Best,
Jonathan`
}

function buildLinkedInMessage(recruiterName, company, role) {
  const firstName = (recruiterName || '').split(' ')[0] || 'there'
  const context = role ? `the ${role} role` : `opportunities`
  return `Hi ${firstName}, I came across ${context} at ${company} and thought my Amazon backend/AWS distributed systems background could be relevant. I have 4 years of experience building Java/Spring Boot services, AWS systems, and platform tooling. Would love to connect.`
}

// ── Recruiters ────────────────────────────────────────────────────────────────

const RECRUITERS = [
  // Temporal
  { name: 'Jennifer Newman',  company: 'Temporal',    role: 'Senior Software Engineer, Cloud Data Storage', email: 'jennifer.newman@temporal.io' },
  { name: 'Eric Stutzman',    company: 'Temporal',    role: 'Senior Software Engineer, Cloud Data Storage', email: 'eric@temporal.io' },
  { name: 'Jason Simpson',    company: 'Temporal',    role: 'Senior Software Engineer, Cloud Data Storage', email: 'jason.simpson@temporal.io' },
  { name: 'Katelyn Pascale',  company: 'Temporal',    role: 'Senior Software Engineer, Cloud Data Storage', email: 'katelyn.pascale@temporal.io' },
  { name: 'Ashley Putnam',    company: 'Temporal',    role: 'Senior Software Engineer, Cloud Data Storage', email: 'ashley.putnam@temporal.io' },
  { name: 'Tobias Hansbauer', company: 'Temporal',    role: 'Senior Software Engineer, Cloud Data Storage', email: 'tobias.hansbauer@temporal.io' },
  // Render
  { name: 'Erika Raskind',    company: 'Render',      role: 'Software Engineer, Infrastructure', email: 'erika@render.com' },
  { name: 'Miri Hertz',       company: 'Render',      role: 'Software Engineer, Infrastructure', email: 'miri@render.com' },
  { name: 'Gabe Stoutimore',  company: 'Render',      role: 'Software Engineer, Infrastructure', email: 'gabe@render.com' },
  { name: 'Malika Waller',    company: 'Render',      role: 'Software Engineer, Infrastructure', email: 'malikawaller@render.com' },
  { name: 'Justin Shotwell',  company: 'Render',      role: 'Software Engineer, Infrastructure', email: 'justin@render.com' },
  // Chainguard
  { name: 'Jane Laczek',      company: 'Chainguard',  role: 'Senior Software Engineer (Experience)', email: 'jane.laczek@chainguard.dev' },
  { name: 'Amy Zimmerman',    company: 'Chainguard',  role: 'Senior Software Engineer (Experience)', email: 'amy.zimmerman@chainguard.dev' },
  { name: 'Andee Secamiglio', company: 'Chainguard',  role: 'Senior Software Engineer (Experience)', email: 'andee.secamiglio@chainguard.dev' },
  { name: 'Jackson Stewart',  company: 'Chainguard',  role: 'Senior Software Engineer (Experience)', email: 'jackson.stewart@chainguard.dev' },
  { name: 'Nick Linton',      company: 'Chainguard',  role: 'Senior Software Engineer (Experience)', email: 'nick.linton@chainguard.dev' },
]

// ── Firestore REST helpers ────────────────────────────────────────────────────

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

async function firestoreGet(path) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function firestoreList(path) {
  const docs = []
  let pageToken = null
  do {
    const url = new URL(`${BASE}/${path}`)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!res.ok) throw new Error(`LIST ${path}: ${res.status} ${await res.text()}`)
    const body = await res.json()
    if (body.documents) docs.push(...body.documents)
    pageToken = body.nextPageToken ?? null
  } while (pageToken)
  return docs
}

async function firestoreCreate(collectionPath, fields) {
  const res = await fetch(`${BASE}/${collectionPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`CREATE ${collectionPath}: ${res.status} ${await res.text()}`)
  return res.json()
}

function strField(v) { return { stringValue: v } }
function boolField(v) { return { booleanValue: v } }
function tsField()    { return { timestampValue: new Date().toISOString() } }

// ── Get UID by looking up user email via Auth REST API ────────────────────────

async function getUID() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: [USER_EMAIL] }),
    }
  )
  if (!res.ok) throw new Error(`Auth lookup failed: ${res.status} ${await res.text()}`)
  const body = await res.json()
  const uid = body.users?.[0]?.localId
  if (!uid) throw new Error(`No user found for ${USER_EMAIL}`)
  return uid
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const uid = await getUID()
  console.log(`Found user UID: ${uid}`)

  // Load existing outreach to avoid duplicates
  const existingDocs = await firestoreList(`users/${uid}/outreach`)
  const existingEmails = new Set(
    existingDocs
      .map(d => d.fields?.recruiterEmail?.stringValue)
      .filter(Boolean)
  )
  console.log(`Already tracked: ${existingEmails.size} recruiters`)

  let added = 0
  let skipped = 0

  for (const r of RECRUITERS) {
    if (existingEmails.has(r.email)) {
      console.log(`  skip: ${r.name} <${r.email}>`)
      skipped++
      continue
    }
    await firestoreCreate(`users/${uid}/outreach`, {
      company:          strField(r.company),
      role:             strField(r.role),
      recruiterName:    strField(r.name),
      recruiterEmail:   strField(r.email),
      recruiterTitle:   strField(''),
      recruiterLinkedIn:strField(''),
      emailSubject:     strField(buildEmailSubject(r.role, r.company)),
      emailBody:        strField(buildEmailBody(r.name, r.company, r.role)),
      linkedInMessage:  strField(buildLinkedInMessage(r.name, r.company, r.role)),
      followUpSubject:  strField(buildFollowUpSubject(r.role, r.company)),
      followUpBody:     strField(buildFollowUpBody(r.name, r.company, r.role)),
      emailSent:        boolField(false),
      linkedInSent:     boolField(false),
      followUpSent:     boolField(false),
      createdAt:        tsField(),
    })
    console.log(`  + ${r.name} <${r.email}> @ ${r.company}`)
    added++
  }

  console.log(`\nDone — added ${added}, skipped ${skipped} duplicates.`)
}

run().catch(err => { console.error(err); process.exit(1) })
