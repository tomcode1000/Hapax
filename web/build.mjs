import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Hapax page builder.
 *
 * Same structure and the same design system as Quorum's site
 * (packages/site/build.mjs and app-shell.mjs): static HTML rendered from
 * shared helpers, one icon function, one stylesheet pair. quorum.css and
 * app.css are copied unchanged into assets/, so every token, card, pill and
 * rail here is Quorum's.
 */

/* ------------------------------------------------------------------ icons -- */

/*
  Icons are Lucide (ISC licence), read from lucide-static at build time and
  inlined, so a page loads no icon font and no sprite. The names on the left
  are the ones the pages use; the right is the Lucide file. Keeping our own
  names means a page never depends on Lucide's naming, and swapping a glyph
  is a one-line change here.
*/
const LUCIDE = {
  shield: 'shield-check',
  shieldAlert: 'shield-alert',
  users: 'users-round',
  user: 'user-round',
  userCheck: 'user-round-check',
  check: 'check',
  checkCircle: 'circle-check-big',
  x: 'x',
  xCircle: 'circle-x',
  arrow: 'arrow-right',
  arrowLeft: 'arrow-left',
  clock: 'clock-3',
  timer: 'timer',
  wallet: 'wallet-minimal',
  coins: 'hand-coins',
  id: 'id-card',
  phone: 'smartphone',
  lock: 'lock-keyhole',
  eye: 'eye',
  eyeOff: 'eye-off',
  warn: 'triangle-alert',
  sun: 'sun-medium',
  activity: 'activity',
  home: 'house',
  ban: 'ban',
  copy: 'copy',
  out: 'external-link',
  layers: 'layers',
  key: 'key-round',
  bolt: 'zap',
  link: 'link-2',
  panel: 'panel-left',
  db: 'database',
  book: 'book-open-text',
  play: 'circle-play',
  fingerprint: 'fingerprint-pattern',
  network: 'network',
  building: 'building-2',
  landmark: 'landmark',
  cpu: 'cpu',
  merge: 'git-merge',
  sparkles: 'sparkles',
  badge: 'badge-check',
  fileLock: 'file-lock-2',
  scan: 'scan-line',
  globe: 'globe',
  receipt: 'receipt-text',
  hash: 'hash',
  split: 'split',
  heart: 'hand-heart',
  list: 'list-checks',
  calendar: 'calendar-days',
  plug: 'plug-zap',
  plus: 'circle-plus',
  clipboard: 'clipboard-paste',
  mail: 'mail',
}

const LUCIDE_DIR = join(import.meta.dirname, 'node_modules/lucide-static/icons')
const inner = (file) => {
  const svg = readFileSync(join(LUCIDE_DIR, `${file}.svg`), 'utf8')
  return svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).replace(/\s+/g, ' ').trim()
}
const I = Object.fromEntries(Object.entries(LUCIDE).map(([name, file]) => [name, inner(file)]))

/**
 * One icon, stroked. The `i` class is what sizes it (see quorum.css): an
 * inline SVG with no size expands to fill its parent.
 */
const ic = (name) => {
  if (!I[name]) throw new Error(`unknown icon: ${name}`)
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`
}

/** The few icons the client draws at runtime, so the feed matches the page. */
const clientIcons = (names) => `<script>window.HAPAX_ICONS=${JSON.stringify(Object.fromEntries(names.map((n) => [n, I[n]])))}</script>`

/*
  The Hapax mark: a rounded square holding a single dot. A hapax is a word that
  occurs once; the mark is one thing, once.
*/
const MARK = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="11" stroke="currentColor" stroke-width="4.4"/><circle cx="20" cy="20" r="5.6" fill="currentColor"/></svg>`

const caret = `<svg class="caret" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@600;700&display=swap"/>`

/* Applied before first paint so no page flashes the other theme or rail width. */
const PREPAINT = `<script>
  try {
    if (localStorage.getItem('hapax-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    if (localStorage.getItem('hapax-rail') === 'collapsed') document.documentElement.setAttribute('data-rail', 'collapsed')
  } catch (e) {}
</script>`

export { I, ic, clientIcons, MARK, caret, FONTS, PREPAINT }
