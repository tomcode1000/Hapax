import { getApp } from '../server/core.mjs'

/*
  Every /api/* route on Vercel. The logic lives in server/core.mjs, shared
  with the local server, so the two cannot drift apart.
*/
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  const app = await getApp()
  const path = new URL(req.url, 'http://x').pathname
  // Vercel sets x-real-ip to the caller's address; it is not client-controlled.
  const ip = req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Malformed request' })
    }
  }
  const [code, out] = await app.handle(req.method, path, body ?? {}, ip)
  res.setHeader('cache-control', 'no-store')
  res.status(code).json(out)
}
