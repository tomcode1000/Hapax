import { MARK, caret, ic, clientIcons, FONTS, PREPAINT } from './build.mjs'

/**
 * The chrome every Hapax app page shares, built from the same helpers and the
 * same ap-* classes as Quorum's app-shell.mjs.
 *
 * Two rules hold on every screen:
 *   - No screen ever shows a name or an ID number. An agency sees a person as
 *     a position in the shared list and a shortened code, which is all the
 *     product lets it know.
 *   - Every figure is live from the service or the chain, or it reads
 *     "Loading". Nothing is typed into the markup.
 */

const chip = (text) => `<p class="ap-chip">${text}</p>`

const pill = (label, tone = '', key = '') =>
  `<span class="ap-pill${tone ? ` ap-pill-${tone}` : ''}"${key ? ` data-h="${key}"` : ''}>${label}</span>`

const tile = (icon, tone = '', size = '') =>
  `<span class="ap-tile${size ? ` ap-tile-${size}` : ''}${tone ? ` ap-tile-${tone}` : ''}">${ic(icon)}</span>`

const card = (body, extra = '') => `<section class="ap-card"${extra}>${body}</section>`

const cardHead = (title, right = '') => `<div class="ap-card-head"><h2 class="ap-h2">${title}</h2>${right}</div>`

const stat = (icon, label, note, key, tone = '') =>
  `<div class="ap-stat">${tile(icon, tone)}<div><span>${label}</span><b data-h="${key}">Loading</b>${note ? `<em>${note}</em>` : ''}</div></div>`

const metric = (icon, label, note, key) =>
  `<div class="ap-metric">${tile(icon)}<div><span>${label}</span><b data-h="${key}">Loading</b>${note ? `<em>${note}</em>` : ''}</div></div>`

const row = ({ icon, title, note = '', value = '', key = '', tone = '' }) =>
  `<div class="ap-row">${icon ? tile(icon, tone, 'sm') : ''}<div><b>${title}</b>${note ? `<span>${note}</span>` : ''}</div>${
    value || key ? `<div class="ap-row-val"${key ? ` data-h="${key}"` : ''}>${value || 'Loading'}</div>` : ''
  }</div>`

const info = (icon, title, body, tone = '', extra = '') =>
  `<div class="ap-info${tone ? ` ap-info-${tone}` : ''}"${extra}>${ic(icon)}<div><b>${title}</b><p>${body}</p></div></div>`

const empty = (text) => `<p class="ap-empty">${text}</p>`

/* -------------------------------------------------------------------- nav -- */

const NAV = [
  ['building', 'Agency A', 'agency.html?a=a'],
  ['building', 'Agency B', 'agency.html?a=b'],
  ['book', 'How it works', 'index.html'],
]

const navList = (current) =>
  `<nav class="ap-nav" aria-label="Sections">${NAV.map(
    ([icon, label, href]) =>
      `<a href="${href}" title="${label}"${label.toLowerCase() === current ? ' aria-current="page"' : ''}>${ic(icon)}${label}</a>`,
  ).join('')}</nav>`

const railToggle = `<button class="ap-rail-toggle" type="button" data-rail-toggle aria-label="Collapse navigation" aria-expanded="true">${ic('panel')}</button>`

const themeToggle = `<button class="ap-theme" type="button" data-theme-toggle aria-pressed="false">${ic('sun')}<span data-theme-label>Dark mode</span>${caret}</button>`

const side = (current) => `<aside class="ap-side">
  <div class="ap-side-head"><a class="brand" href="index.html"><span class="mark">${MARK}</span>Hapax</a>${railToggle}</div>
  <p class="ap-side-label">Shared aid registry · testnet</p>
  ${navList(current)}
  <div class="ap-side-foot">
    <div class="ap-note">${ic('lock')}<div><b>No names, no ID numbers</b><p>Agencies share one list of commitments. None of them can read who is on it.</p></div></div>
    ${themeToggle}
  </div>
</aside>`

const top = (left, right = '') => `<div class="ap-top">${left}<div class="ap-top-end">${right}</div></div>`

const appPage = ({ title, current, main, body = '', scripts = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${title} · Hapax</title>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg"/>
${FONTS}
<link rel="stylesheet" href="assets/quorum.css"/>
<link rel="stylesheet" href="assets/app.css"/>
<link rel="stylesheet" href="assets/hapax.css"/>
${PREPAINT}
</head>
<body${body}>
<div class="ap">
${side(current)}
<main class="ap-main">
${main}
</main>
</div>
${clientIcons(["userCheck", "ban", "coins", "warn", "out", "mail"])}
<script src="assets/poseidon.js"></script>
${scripts}
<script src="assets/hapax.js"></script>
</body>
</html>`

/**
 * The recipient's page: a separate surface from the agency console.
 *
 * A person arrives here from their invite email. They should never see
 * "Agency A / Agency B" or any staff navigation, so this shell has only the
 * brand, a security note, the theme control and a help footer. It is built
 * from the same tokens and ap-* components, so it is still one product.
 */
const recipientPage = ({ title, main, body = '', scripts = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${title} · Hapax</title>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg"/>
${FONTS}
<link rel="stylesheet" href="assets/quorum.css"/>
<link rel="stylesheet" href="assets/app.css"/>
<link rel="stylesheet" href="assets/hapax.css"/>
${PREPAINT}
</head>
<body${body} class="hx-recipient">
<header class="hx-rhead"><div class="hx-rhead-in">
  <a class="brand" href="claim.html"><span class="mark">${MARK}</span>Hapax</a>
  <span class="hx-rsecure">${ic('lock')} Private claim</span>
  <div class="hx-rhead-end">
    <span class="ap-pill" data-h="net-pill">Checking…</span>
    <button class="hx-rtheme" type="button" data-theme-toggle aria-pressed="false" aria-label="Switch theme">${ic('sun')}<span data-theme-label hidden>Dark mode</span></button>
  </div>
</div></header>
<main class="hx-rmain">
${main}
</main>
<footer class="hx-rfoot"><div class="hx-rfoot-in">
  ${ic('heart')}
  <p><b>Need help?</b> Contact the agency that enrolled you. Nobody from Hapax or any agency will ever ask for your PIN or activation code.</p>
</div></footer>
${clientIcons(["userCheck", "ban", "coins", "warn", "out", "mail"])}
<script src="assets/poseidon.js"></script>
${scripts}
<script src="assets/hapax.js"></script>
</body>
</html>`

export { chip, pill, tile, card, cardHead, stat, metric, row, info, empty, top, appPage, recipientPage }
