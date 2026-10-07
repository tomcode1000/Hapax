import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'esbuild'
import { MARK } from './build.mjs'
import { landing, agency, claim } from './pages.mjs'

/** Renders every page into dist/ and copies what they load. */
const root = import.meta.dirname
const out = join(root, 'dist')
await mkdir(join(out, 'assets'), { recursive: true })
await mkdir(join(out, 'zk'), { recursive: true })
await mkdir(join(out, 'assets/img'), { recursive: true })
// Photographs (Unsplash licence), chosen in landing.mjs.
for (const f of await readdir(join(root, 'assets/img'))) await copyFile(join(root, 'assets/img', f), join(out, 'assets/img', f))

const PAGES = { 'index.html': landing, 'agency.html': agency, 'claim.html': claim }
for (const [file, render] of Object.entries(PAGES)) await writeFile(join(out, file), render())

// Quorum's design system, copied unchanged, plus the Hapax additions.
for (const f of ['quorum.css', 'app.css', 'hapax.css', 'hapax.js', 'prove-worker.js'])
  await copyFile(join(root, 'assets', f), join(out, 'assets', f))
await copyFile(join(root, 'node_modules/snarkjs/build/snarkjs.min.js'), join(out, 'assets/snarkjs.min.js'))
await writeFile(join(out, 'assets/favicon.svg'), MARK.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" color="#1f6feb" '))

await build({
  entryPoints: [join(root, 'src/poseidon-entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'HapaxPoseidon',
  target: 'es2020',
  outfile: join(out, 'assets/poseidon.js'),
  logLevel: 'warning',
})

// The recipient's own wallet: Freighter or a key made in their browser.
await build({
  entryPoints: [join(root, 'src/wallet-entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'HapaxWallet',
  platform: 'browser',
  target: 'es2020',
  define: { global: 'globalThis' },
  outfile: join(out, 'assets/wallet.js'),
  logLevel: 'warning',
})

// The circuit and proving key the phone downloads to make its proof.
/*
  The circuit lives in ../circuits/build in the repository. A Vercel CLI
  deploy uploads only web/, so scripts/predeploy copies the three files into
  web/zk-build first; whichever exists is used.
*/
const { existsSync } = await import('node:fs')
const zk = existsSync(join(root, '../circuits/build/hapax_claim.zkey')) ? join(root, '../circuits/build') : join(root, 'zk-build')
await copyFile(join(zk, 'hapax_claim_js/hapax_claim.wasm'), join(out, 'zk/hapax_claim.wasm'))
await copyFile(join(zk, 'hapax_claim.zkey'), join(out, 'zk/hapax_claim.zkey'))

console.log(`rendered ${Object.keys(PAGES).length} pages into dist/`)
