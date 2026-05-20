export function buildEmailSubject(role, company) {
  if (role) return `${role} – Amazon backend engineer with AWS distributed systems experience`
  return `Backend engineer interested in opportunities at ${company}`
}

export function buildEmailBody(recruiterName, company, role) {
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

export function buildFollowUpSubject(role, company) {
  if (role) return `Following up on ${role} at ${company}`
  return `Following up on opportunities at ${company}`
}

export function buildFollowUpBody(recruiterName, company, role) {
  const firstName = (recruiterName || '').split(' ')[0] || 'there'
  const context = role ? `the ${role} role at ${company}` : `opportunities at ${company}`

  return `Hi ${firstName},

Just wanted to follow up on my earlier note regarding ${context}.

I'm very interested in the team and believe my Amazon backend/AWS distributed systems experience could be relevant.

Would be grateful for any guidance or a pointer to the right person.

Best,
Jonathan`
}

export function buildLinkedInMessage(recruiterName, company, role) {
  const firstName = (recruiterName || '').split(' ')[0] || 'there'
  const context = role ? `the ${role} role` : `opportunities`

  return `Hi ${firstName}, I came across ${context} at ${company} and thought my Amazon backend/AWS distributed systems background could be relevant. I have 4 years of experience building Java/Spring Boot services, AWS systems, and platform tooling. Would love to connect.`
}
