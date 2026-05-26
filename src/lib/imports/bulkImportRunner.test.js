import assert from 'node:assert/strict'
import test from 'node:test'
import { runBulkJobImport } from './bulkImportRunner.js'

test('runBulkJobImport processes URLs sequentially and records item-level status', async () => {
  const calls = []
  const updates = []
  const saved = []

  const results = await runBulkJobImport({
    urls: ['https://a.test/job', 'https://b.test/job'],
    importJobFromUrl: async url => {
      calls.push(url)
      if (url.includes('b.test')) {
        return {
          success: false,
          fields: null,
          errorCode: 'FETCH_FAILED',
          errorMessage: 'Could not fetch this page',
          sourceUrl: url,
        }
      }

      return {
        success: true,
        fields: {
          company: 'Acme',
          role: 'Engineer',
          location: 'Remote',
          salaryMin: null,
          salaryMax: null,
          jobDescription: 'Build things',
          keySkills: ['React'],
        },
        errorCode: null,
        errorMessage: null,
        sourceUrl: url,
      }
    },
    addJob: async data => {
      saved.push(data)
    },
    onItemUpdate: (index, patch) => {
      updates.push([index, patch.status])
    },
  })

  assert.deepEqual(calls, ['https://a.test/job', 'https://b.test/job'])
  assert.equal(saved.length, 1)
  assert.equal(saved[0].role, 'Engineer')
  assert.deepEqual(updates, [
    [0, 'loading'],
    [0, 'success'],
    [1, 'loading'],
    [1, 'error'],
  ])
  assert.deepEqual(results.map(result => result.status), ['success', 'error'])
})
