import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLogoUrl,
  cleanText,
  detectPlatformFromUrl,
  extractSalaryRange,
  hasEnoughJobData,
  inferCompanyDomain,
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
  assert.equal(job.logoUrl, 'https://www.google.com/s2/favicons?sz=64&domain=acme.com')
  assert.deepEqual(job.keySkills, [])
  assert.equal(job.salaryMin, 120000)
  assert.equal(job.salaryMax, null)
  assert.equal(hasEnoughJobData(job), true)
  assert.equal(hasEnoughJobData({ company: 'Acme' }), false)
})

test('inferCompanyDomain derives simple domains from ATS urls and company names', () => {
  assert.equal(inferCompanyDomain({
    company: 'Crossing Hurdles',
    jobUrl: 'https://www.linkedin.com/jobs/view/123/',
    atsPlatform: 'linkedin',
  }), 'crossinghurdles.com')
  assert.equal(inferCompanyDomain({
    company: '',
    jobUrl: 'https://jobs.lever.co/acme/123',
    atsPlatform: 'lever',
  }), 'acme.com')
  assert.equal(buildLogoUrl('www.acme.com/careers'), 'https://www.google.com/s2/favicons?sz=64&domain=acme.com')
})

test('extractSalaryRange parses common annual ranges', () => {
  assert.deepEqual(extractSalaryRange('Compensation: $120k - $180k base'), {
    salaryMin: 120000,
    salaryMax: 180000,
  })
  assert.deepEqual(extractSalaryRange('Salary range is USD 95,000 to 130,000'), {
    salaryMin: 95000,
    salaryMax: 130000,
  })
  assert.deepEqual(extractSalaryRange('No salary listed'), {
    salaryMin: null,
    salaryMax: null,
  })
})

test('normalizeJobPayload infers salary', () => {
  const job = normalizeJobPayload({
    role: 'Engineer',
    company: 'Acme',
    jobDescription: 'The salary range is $140k to $170k.',
  })

  assert.equal(job.salaryMin, 140000)
  assert.equal(job.salaryMax, 170000)
  assert.equal(job.logoUrl, 'https://www.google.com/s2/favicons?sz=64&domain=acme.com')
})
