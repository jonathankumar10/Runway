const assert = require('node:assert/strict')
const test = require('node:test')
const { htmlToJobText, normalizeImportUrl } = require('./importFromUrlUtils')

test('normalizeImportUrl accepts http and https URLs', () => {
  assert.equal(normalizeImportUrl(' https://example.com/job#top '), 'https://example.com/job')
  assert.equal(normalizeImportUrl('http://example.com/job'), 'http://example.com/job')
})

test('normalizeImportUrl rejects invalid input and unsupported protocols', () => {
  assert.equal(normalizeImportUrl('not a url'), null)
  assert.equal(normalizeImportUrl('ftp://example.com/job'), null)
  assert.equal(normalizeImportUrl(null), null)
})

test('htmlToJobText removes scripts, styles, tags, and caps output', () => {
  const text = htmlToJobText('<style>.x{}</style><script>alert(1)</script><h1>Engineer</h1><p>Remote</p>')
  assert.equal(text, 'Engineer Remote')
})
