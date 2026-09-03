import { execFile } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import { build } from 'esbuild'

const execFileAsync = promisify(execFile)
const rootRequire = createRequire(import.meta.url)
const pnpmBareImportResolver = {
  name: 'pnpm-bare-import-resolver',
  setup(buildContext) {
    buildContext.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('node:')) return undefined
      const resolver = createRequire(args.importer || import.meta.url)
      return { path: resolver.resolve(args.path) }
    })
  },
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

await build({
  entryPoints: {
    background: 'src/background/index.ts',
    content: 'src/content/index.ts',
    'main-world': 'src/main-world/index.ts',
    sidepanel: 'src/sidepanel/main.tsx',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome149',
  sourcemap: true,
  entryNames: '[name]',
  plugins: [pnpmBareImportResolver],
})

await cp('public/manifest.json', 'dist/manifest.json')
await cp('public/sidepanel.html', 'dist/sidepanel.html')
await cp('public/icons', 'dist/icons', { recursive: true })

const tailwindPackage = rootRequire.resolve('@tailwindcss/cli/package.json')
const tailwindCli = join(dirname(tailwindPackage), 'dist', 'index.mjs')
await execFileAsync(process.execPath, [
  tailwindCli,
  '-i',
  'src/ui/styles.css',
  '-o',
  'dist/styles.css',
  '--minify',
])
