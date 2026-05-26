import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['functions/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['extension/src/**/*.js'],
    languageOptions: {
      globals: {
        chrome: 'readonly',
        __FIREBASE_API_KEY__: 'readonly',
        __FIREBASE_PROJECT_ID__: 'readonly',
        __GOOGLE_WEB_CLIENT_ID__: 'readonly',
      },
    },
  },
  {
    files: ['extension/build.js', 'extension/scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
