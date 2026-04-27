import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/crypto/index.ts', 'src/definitions/index.ts', 'src/wallet-standard/index.ts'],
	format: 'esm',
	dts: true,
	outDir: 'dist',
	unbundle: true,
});
