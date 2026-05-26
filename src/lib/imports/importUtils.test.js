import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getBlockedPlatform,
  mapImportPayloadToResult,
  normalizeImportedFields,
  normalizeUrl,
  parseImportUrls,
} from './importUtils.js'

test('normalizeUrl accepts http and https URLs', () => {
  assert.equal(normalizeUrl(' https://example.com/jobs#details '), 'https://example.com/jobs')
  assert.equal(normalizeUrl('http://example.com/jobs'), 'http://example.com/jobs')
})

test('normalizeUrl rejects invalid and unsupported values', () => {
  assert.equal(normalizeUrl('not a url'), null)
  assert.equal(normalizeUrl('ftp://example.com/job'), null)
  assert.equal(normalizeUrl(''), null)
})

test('parseImportUrls splits commas and newlines, drops duplicates, and records invalid input', () => {
  const result = parseImportUrls('https://a.test/job,\ninvalid\nhttps://a.test/job\nhttps://b.test/job')
  assert.deepEqual(result.urls, ['https://a.test/job', 'https://b.test/job'])
  assert.deepEqual(result.invalid, ['invalid'])
})

test('getBlockedPlatform detects extension-only platforms', () => {
  const cases = [
    ['https://www.linkedin.com/jobs/view/1', 'LinkedIn'],
    ['https://acme.myworkdayjobs.com/job/1', 'Workday'],
    ['https://company.taleo.net/careersection/jobdetail.ftl', 'Taleo'],
    ['https://careers.icims.com/jobs/1', 'iCIMS'],
    ['https://company.bamboohr.com/careers/1', 'BambooHR'],
    ['https://jobs.smartrecruiters.com/acme/1', 'SmartRecruiters'],
  ]

  for (const [url, name] of cases) {
    assert.equal(getBlockedPlatform(url)?.name, name)
  }
  assert.equal(getBlockedPlatform('https://boards.greenhouse.io/acme/jobs/1'), null)
})

test('normalizeImportedFields normalizes empty and numeric fields', () => {
  assert.deepEqual(normalizeImportedFields({
    company: ' Acme ',
    role: ' Engineer ',
    salaryMin: '100000',
    salaryMax: '',
    keySkills: [' React ', '', 42, 'Node'],
  }), {
    company: 'Acme',
    role: 'Engineer',
    location: '',
    salaryMin: 100000,
    salaryMax: null,
    jobDescription: '',
    keySkills: ['React', 'Node'],
  })
})

test('mapImportPayloadToResult maps errors, missing role, and success', () => {
  assert.equal(mapImportPayloadToResult({ error: 'FETCH_FAILED' }, 'https://a.test').errorMessage, 'Could not fetch this page (blocked or requires login)')
  assert.equal(mapImportPayloadToResult({ error: 'PARSE_ERROR' }, 'https://a.test').errorCode, 'PARSE_ERROR')
  assert.equal(mapImportPayloadToResult({ error: 'INVALID_INPUT' }, 'https://a.test').errorCode, 'INVALID_INPUT')

  const missingRole = mapImportPayloadToResult({ company: 'Acme' }, 'https://a.test')
  assert.equal(missingRole.success, false)
  assert.equal(missingRole.errorCode, 'MISSING_ROLE')

  const success = mapImportPayloadToResult({ company: 'Acme', role: 'Engineer' }, 'https://a.test')
  assert.equal(success.success, true)
  assert.equal(success.fields.company, 'Acme')
})
