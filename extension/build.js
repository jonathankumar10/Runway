import * as esbuild from 'esbuild'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { copyFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read Firebase config from root .env
dotenv.config({ path: path.join(__dirname, '../.env') })

const define = {
  __FIREBASE_API_KEY__: JSON.stringify(process.env.VITE_FIREBASE_API_KEY),
  __FIREBASE_PROJECT_ID__: JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID),
  __FIREBASE_AUTH_DOMAIN__: JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN),
  __GOOGLE_WEB_CLIENT_ID__: JSON.stringify(process.env.VITE_GOOGLE_WEB_CLIENT_ID ?? ''),
}

const isWatch = process.argv.includes('--watch')

const entryPoints = [
  'src/background.js',
  'src/content-jobs.js',
  'src/content-ats.js',
  'src/content-profile.js',
  'src/popup.js',
]

function copyContentCss() {
  copyFileSync(path.join(__dirname, 'src/content.css'), path.join(__dirname, 'dist/content.css'))
}

const ctx = await esbuild.context({
  entryPoints: entryPoints.map(e => path.join(__dirname, e)),
  outdir: path.join(__dirname, 'dist'),
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  define,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
})

if (isWatch) {
  copyContentCss()
  await ctx.watch()
  console.log('Watching for changes…')
} else {
  await ctx.rebuild()
  copyContentCss()
  await ctx.dispose()
  console.log('Extension built → extension/dist/')
}
