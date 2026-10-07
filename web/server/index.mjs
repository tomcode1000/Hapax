import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { getApp } from './core.mjs'

/**
 * The local server: serves dist/ and the API from server/core.mjs.
 * On Vercel the same core runs behind api/*.mjs and dist/ is served
 * statically, so this file is for running on a laptop only.
 */

const DIST = join(import.meta.dirname, '..', 'dist')
const PORT = Number(process.env.PORT ?? 8790)
const MAX_BODY = 64 * 1024
const app = await getApp()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.zkey': 'application/octet-stream',
  '.json': 'application/json',
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(type === 'application/json' ? JSON.stringify(body) : body)
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  try {
    if (url.pathname.startsWith('/api/')) {
      let body = {}
      if (req.method === 'POST') {
        let raw = ''
        for await (const c of req) {
          raw += c
          if (raw.length > MAX_BODY) return send(res, 413, { error: 'Request too large' })
        }
        try {
          body = raw ? JSON.parse(raw) : {}
        } catch {
          return send(res, 400, { error: 'Malformed request' })
        }
      }
      const ip = req.socket.remoteAddress
      const [code, out] = await app.handle(req.method, url.pathname, body, ip)
      return send(res, code, out)
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
    if (p === '') p = 'index.html'
    if (!extname(p)) p += '.html'
    const file = join(DIST, p)
    if (!file.startsWith(DIST)) return send(res, 403, 'no', 'text/plain')
    await stat(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, 'Not found', 'text/plain')
    console.error(e)
    send(res, 500, { error: 'Something went wrong on our side.' })
  }
}).listen(PORT, () => console.log(`hapax on http://localhost:${PORT}`))
