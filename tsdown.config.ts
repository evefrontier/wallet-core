import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'address-alias/index': 'src/address-alias/index.ts',
    'crypto/index': 'src/crypto/index.ts',
    'epoch/index': 'src/epoch/index.ts',
    'eve-token/index': 'src/eve-token/index.ts',
    'sponsored-transaction/index': 'src/sponsored-transaction/index.ts',
    'tenant/index': 'src/tenant/index.ts',
    'utils/index': 'src/utils/index.ts',
    'wallet-features/index': 'src/wallet-features/index.ts',
  },
  format: ['esm'],
  clean: true,
})
