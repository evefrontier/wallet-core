import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'crypto/index': 'src/crypto/index.ts',
    'definitions/index': 'src/definitions/index.ts',
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
    'wallet-standard-extensions/index':
      'src/wallet-standard-extensions/index.ts',
  },
  format: ['esm'],
  clean: true,
})
