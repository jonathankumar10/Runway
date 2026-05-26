export async function runBulkJobImport({ urls, importJobFromUrl, addJob, onItemUpdate }) {
  const results = []

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index]
    onItemUpdate(index, { status: 'loading' })

    const result = await importJobFromUrl(url)
    if (!result.success) {
      const item = { ...result, status: 'error' }
      results.push(item)
      onItemUpdate(index, { status: 'error', error: result.errorMessage })
      continue
    }

    const fields = result.fields
    try {
      await addJob({
        company: fields.company,
        role: fields.role,
        jobUrl: result.sourceUrl,
        location: fields.location,
        salaryMin: fields.salaryMin,
        salaryMax: fields.salaryMax,
        jobDescription: fields.jobDescription,
        keySkills: fields.keySkills,
        stage: 'saved',
      })

      const item = { ...result, status: 'success' }
      results.push(item)
      onItemUpdate(index, {
        status: 'success',
        result: { company: fields.company, role: fields.role },
      })
    } catch (err) {
      const item = {
        success: false,
        fields,
        errorCode: 'SAVE_FAILED',
        errorMessage: err?.message || 'Could not save imported job',
        sourceUrl: result.sourceUrl,
        status: 'error',
      }
      results.push(item)
      onItemUpdate(index, { status: 'error', error: item.errorMessage })
    }
  }

  return results
}
