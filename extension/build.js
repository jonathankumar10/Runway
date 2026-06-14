import * as dotenv from 'dotenv'
import * as esbuild from 'esbuild'
import { copyFileSync } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const EXTENSION_ROOT = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = path.join(EXTENSION_ROOT, 'src')
const OUTPUT_DIR = path.join(EXTENSION_ROOT, 'dist')
const SOURCE_CONTENT_CSS = path.join(SOURCE_DIR, 'content.css')
const OUTPUT_CONTENT_CSS = path.join(OUTPUT_DIR, 'content.css')
const DEFAULT_RUNWAY_APP_URL = 'http://localhost:5173'
const SOURCE_ENTRY_FILES = [
  'background.js',
  'linkedin-jobs.js',
  'content-profile.js',
  'popup.js',
]

const shouldWatch = process.argv.includes('--watch')

// Load build-time environment variables from the repo root.
dotenv.config({ path: path.join(EXTENSION_ROOT, '../.env') })

const define = {
  __FIREBASE_API_KEY__: JSON.stringify(process.env.VITE_FIREBASE_API_KEY),
  __FIREBASE_PROJECT_ID__: JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID),
  __FIREBASE_AUTH_DOMAIN__: JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN),
  __GOOGLE_WEB_CLIENT_ID__: JSON.stringify(process.env.VITE_GOOGLE_WEB_CLIENT_ID ?? ''),
  __RUNWAY_APP_URL__: JSON.stringify(process.env.VITE_RUNWAY_APP_URL ?? DEFAULT_RUNWAY_APP_URL),
}

function resolveSourcePath(fileName) {
  return path.join(SOURCE_DIR, fileName)
}

function copyContentCss() {
  // Content CSS is not bundled by esbuild, so copy it into the output folder.
  copyFileSync(SOURCE_CONTENT_CSS, OUTPUT_CONTENT_CSS)
}

function createBuildOptions() {
  return {
    entryPoints: SOURCE_ENTRY_FILES.map(resolveSourcePath),
    outdir: OUTPUT_DIR,
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    define,
    minify: !shouldWatch,
    sourcemap: shouldWatch ? 'inline' : false,
  }
}

async function main() {
  // esbuild context lets us do either a one-off build or watch mode from the same setup.
  const ctx = await esbuild.context(createBuildOptions())

  if (shouldWatch) {
    copyContentCss()
    await ctx.watch()
    console.log('Watching for changes...')
    return
  }

  try {
    await ctx.rebuild()
    copyContentCss()
    console.log('Extension built -> extension/dist/')
  } finally {
    // Clean up build resources after a one-time build.
    await ctx.dispose()
  }
}

await main()
