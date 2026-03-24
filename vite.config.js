import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  base: mode === 'production' ? '/contours/' : '/',
  resolve: {
    alias: {
      // rdf-canonize ships browser substitutes via its "browser" package.json field,
      // but Vite does not apply sub-path browser field mappings for CJS packages.
      // Force the WebCrypto-based implementations explicitly.
      [path.resolve('node_modules/rdf-canonize/lib/MessageDigest.js')]:
        path.resolve('node_modules/rdf-canonize/lib/MessageDigest-webcrypto.js'),
      [path.resolve('node_modules/rdf-canonize/lib/platform.js')]:
        path.resolve('node_modules/rdf-canonize/lib/platform-browser.js'),
    },
  },
}))
