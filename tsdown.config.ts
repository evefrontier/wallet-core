import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'crypto/index': 'src/crypto/index.ts',
    'eve-token/index': 'src/eve-token/index.ts',
    'sponsored-transaction/index': 'src/sponsored-transaction/index.ts',
    'tenant/index': 'src/tenant/index.ts',
    'utils/index': 'src/utils/index.ts',
    'wallet-features/index': 'src/wallet-features/index.ts',
  },
  format: ['esm'],
  clean: true,
})
