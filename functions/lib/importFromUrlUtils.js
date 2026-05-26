const MAX_FETCHED_TEXT_LENGTH = 500000
const MAX_PROMPT_TEXT_LENGTH = 15000

function normalizeImportUrl(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    parsed.hash = ''
    return parsed.href
  } catch {
    return null
  }
}

async function readCappedText(res, limit = MAX_FETCHED_TEXT_LENGTH) {
  const reader = res.body?.getReader?.()
  if (!reader) {
    return (await res.text()).slice(0, limit)
  }

  const decoder = new TextDecoder()
  let text = ''

  while (text.length < limit) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
  return text.slice(0, limit)
}

function htmlToJobText(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_TEXT_LENGTH)
}

module.exports = {
  MAX_FETCHED_TEXT_LENGTH,
  MAX_PROMPT_TEXT_LENGTH,
  htmlToJobText,
  normalizeImportUrl,
  readCappedText,
}
