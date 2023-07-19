// Copyright © Aptos
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    commonjsOptions: {
      include: [
        /packages\/api/,
        /packages\/crypto/,
        /packages\/dapp-sdk/,
        /node_modules/,
      ],
    },
  },
  optimizeDeps: {
    include: [
      '@identity-connect/api',
      '@identity-connect/crypto',
      '@identity-connect/dapp-sdk',
    ],
  },
  plugins: [react()],
});
