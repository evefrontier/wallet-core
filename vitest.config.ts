import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#src\//,
        replacement: `${path.resolve(__dirname, 'src')}/`,
      },
      {
        find: /^#tests\//,
        replacement: `${path.resolve(__dirname, 'tests')}/`,
      },
    ],
  },
  test: {
    projects: [
      {
        test: {
          include: ['tests/**/*.unit.{test,spec}.ts'],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          include: [
            'tests/**/*.browser.{test,spec}.ts',
            'tests/**/*.unit.{test,spec}.ts',
          ],
          name: 'browser',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
      reportOnFailure: true,
      exclude: ['**/node_modules/**', '**/docs/**'],
    },
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions']
      : ['default'],
  },
})
