import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanText,
  detectPlatformFromUrl,
  hasEnoughJobData,
  normalizeJobPayload,
} from './import-utils.js'

test('cleanText trims and collapses whitespace', () => {
  assert.equal(cleanText('  Senior\n\nEngineer  Remote  '), 'Senior Engineer Remote')
  assert.equal(cleanText('abcdef', 3), 'abc')
})

test('detectPlatformFromUrl detects supported ATS hosts', () => {
  assert.equal(detectPlatformFromUrl('https://boards.greenhouse.io/acme/jobs/123'), 'greenhouse')
  assert.equal(detectPlatformFromUrl('https://www.linkedin.com/jobs/view/123'), 'linkedin')
  assert.equal(detectPlatformFromUrl('https://jobs.lever.co/acme/id'), 'lever')
  assert.equal(detectPlatformFromUrl('https://jobs.ashbyhq.com/acme/id'), 'ashby')
  assert.equal(detectPlatformFromUrl('https://acme.myworkdayjobs.com/careers/job/id'), 'workday')
  assert.equal(detectPlatformFromUrl('https://acme.taleo.net/careersection/jobdetail.ftl'), 'taleo')
  assert.equal(detectPlatformFromUrl('https://careers-acme.icims.com/jobs/123/title/job'), 'icims')
  assert.equal(detectPlatformFromUrl('https://acme.bamboohr.com/careers/123'), 'bamboohr')
  assert.equal(detectPlatformFromUrl('https://jobs.smartrecruiters.com/Acme/123-title'), 'smartrecruiters')
})

test('normalizeJobPayload adds extension metadata and defaults', () => {
  const job = normalizeJobPayload({
    role: ' Engineer ',
    jobUrl: 'https://jobs.smartrecruiters.com/Acme/123-title',
    jobDescription: ' Build things ',
    salaryMin: '120000',
  })

  assert.equal(job.role, 'Engineer')
  assert.equal(job.source, 'extension')
  assert.equal(job.importMethod, 'extension')
  assert.equal(job.atsPlatform, 'smartrecruiters')
  assert.deepEqual(job.keySkills, [])
  assert.equal(job.salaryMin, 120000)
  assert.equal(job.salaryMax, null)
  assert.equal(hasEnoughJobData(job), true)
  assert.equal(hasEnoughJobData({ company: 'Acme' }), false)
})
