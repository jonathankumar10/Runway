import { useAI } from './useAI'
import {
  getBlockedPlatform,
  mapImportPayloadToResult,
  normalizeUrl,
} from '../lib/imports/importUtils'

/**
 * Validates a job URL, blocks login-only platforms, and normalizes import results.
 */
export function useJobImport() {
  const { importFromUrl } = useAI()

  /** Imports a single job posting URL into normalized application fields. */
  async function importJobFromUrl(rawUrl) {
    const sourceUrl = normalizeUrl(rawUrl)
    if (!sourceUrl) {
      return {
        success: false,
        fields: null,
        errorCode: 'INVALID_INPUT',
        errorMessage: 'Enter a valid http or https job URL',
        sourceUrl: rawUrl,
      }
    }

    const blocked = getBlockedPlatform(sourceUrl)
    if (blocked) {
      return {
        success: false,
        fields: null,
        errorCode: 'BLOCKED_PLATFORM',
        errorMessage: `${blocked.name} requires login. Use the browser extension instead.`,
        sourceUrl,
      }
    }

    try {
      const payload = await importFromUrl(sourceUrl)
      return mapImportPayloadToResult(payload, sourceUrl)
    } catch (err) {
      return {
        success: false,
        fields: null,
        errorCode: err?.code ?? 'UNKNOWN',
        errorMessage: err?.message || 'Could not import this page',
        sourceUrl,
      }
    }
  }

  return { importJobFromUrl }
}
