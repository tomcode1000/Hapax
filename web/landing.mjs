import { ic, MARK, FONTS, PREPAINT } from './build.mjs'

/**
 * The landing page.
 *
 * Built from Quorum's worker-site vocabulary (the w-* classes in quorum.css):
 * photographs in soft frames with live-looking cards floating over them, a
 * feature grid, a numbered flow and a handwritten aside. Hapax-only
 * components (the strip, the diagram, the phone) live in hapax.css on the
 * same tokens.
 *
 * Two rules from the Quorum brief carry over:
 *   - No invented figures. Every number below is either measured on this
 *     build or sourced, and the source is named next to it.
 *   - The landing surface never carries the app's rail.
 *
 * Photographs are from Unsplash under the Unsplash licence, chosen to show
 * adults with dignity; no children and no real charity's branding, which
 * would imply an endorsement that does not exist.
 */

const swoosh = `<svg class="hx-swoosh" viewBox="0 0 132 11" fill="none" aria-hidden="true"><path d="M2 7.6C28 3.2 74 1.8 130 4.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`
const script = (lines) => `<p class="w-script" aria-hidden="true">${lines.map((l) => `${l}<br/>`).join('')}${swoosh}</p>`

const float = (pos, icon, tone, title, note) => `<div class="w-float ${pos}">
  <span class="w-tile hx-tile-${tone}" style="width:42px;height:42px;border-radius:12px">${ic(icon)}</span>
  <div><b>${title}</b><span>${note}</span></div>
</div>`

const media = (frame, shape, img, alt, floats = '', pos = 'center 18%') => `<div class="w-frame ${frame}">
  <div class="w-media ${shape}" role="img" aria-label="${alt}" style="background-image:url(assets/img/${img});background-position:${pos}"></div>
  ${floats}
</div>`

const nav = () => `<header class="w-nav"><div class="shell w-nav-in">
  <a class="brand" href="index.html"><span class="mark">${MARK}</span>Hapax</a>
  <nav class="w-tabs" aria-label="Primary">
    <a href="#how">How it works</a>
    <a href="#privacy">Privacy</a>
    <a href="#tech">Technology</a>
  </nav>
  <div class="w-nav-end">
    <a class="w-btn hx-btn-sm" href="agency.html?a=a">Open the demo ${ic('arrow')}</a>
  </div>
</div></header>`

/* ------------------------------------------------------------------- hero -- */

const hero = () => `<section class="w-band"><div class="shell w-grid">
  <div class="w-copy">
    <p class="w-eyebrow">One registry. Every agency.</p>
    <h1 class="w-h hx-h-xl">Pay people once.<em class="hx-accent">Never learn who.</em></h1>
    <p class="w-lede">Aid agencies can’t share their lists, so the same person gets paid twice. Hapax checks every claim against one registry on Stellar with a zero-knowledge proof. No names. No ID numbers. One payment.</p>
    <div class="w-cta">
      <a class="w-btn" href="agency.html?a=a">Open the agency console ${ic('arrow')}</a>
      <a class="w-play" href="#how"><span>${ic('play')}</span>See how it works</a>
    </div>
  </div>
  <div class="hx-hero-art">
    <div class="hx-hero-glow" aria-hidden="true"></div>
    ${media(
      'w-frame-hero hx-hero-frame',
      'w-media-blend hx-hero-photo',
      'hero.jpg',
      'A young woman smiling as she reads a message on her phone',
      `${float('w-float-tr hx-float-hero-tr', 'checkCircle', 'good', '50 AID', 'Paid once · round 1')}
       ${float('w-float-bl hx-float-hero-bl', 'ban', 'bad', 'Blocked', 'Second claim at Agency B')}`,
      '50% 28%',
    )}
  </div>
</div></section>`

/* ------------------------------------------------------------------ strip -- */

/*
  Four figures, each true. The first two are from the Stellar Development
  Foundation's report on Stellar Aid Assist (UNHCR, Ukraine); the third is measured on this build; the fourth is
  the design property the whole product exists for.
*/
const STRIP = [
  ['$4.6M', 'aid paid on Stellar by UNHCR in Ukraine', 'Stellar Aid Assist'],
  ['2,500', 'households reached in that programme', 'Stellar Aid Assist'],
  ['1.75 s', 'to make a claim proof on a laptop', 'measured on this build'],
  ['0', 'names or ID numbers shared between agencies', 'by design'],
]

const STACK = [
  ['globe', 'Stellar', 'Payment rail'],
  ['cpu', 'Soroban', 'Registry contract'],
  ['bolt', 'Protocol 25', 'BN254 + Poseidon'],
  ['fingerprint', 'Groth16', 'zk-SNARK proofs'],
  ['network', 'Poseidon tree', '262k people'],
  ['phone', 'Circom + snarkjs', 'Proof in the browser'],
]

const stack = () => `<section class="hx-stack" aria-label="Built on"><div class="shell hx-stack-in">
  <span class="hx-stack-label">Built on</span>
  <ul>${STACK.map(([i, n, d]) => `<li>${ic(i)}<div><b>${n}</b><span>${d}</span></div></li>`).join('')}</ul>
</div></section>`

const strip = () => `<section class="hx-strip"><div class="shell hx-strip-in">
  ${STRIP.map(([v, l, s]) => `<div class="hx-strip-i"><b>${v}</b><span>${l}</span><em>${s}</em></div>`).join('')}
</div></section>`

/* ---------------------------------------------------------------- problem -- */

const PROBLEM = [
  ['split', 'Lists don’t talk', 'Every agency registers people on its own system. Nothing connects them, so nothing notices the same person twice.'],
  ['coins', 'Double paid, someone skipped', 'Duplicate registration is one of the most common patterns of aid fraud, and every duplicate is money a family in the queue does not get.'],
  ['shieldAlert', 'Too dangerous to merge', 'A merged list of displaced people is a target. Humanitarian data-protection practice is that a duplicate check should reveal as little as possible: ideally a yes or a no.'],
  ['landmark', 'The rail is already here', 'UNHCR and the IRC already pay aid on Stellar. What that rail does not have is a way for agencies to check each other privately.'],
]

const problem = () => `<section class="w-band w-band-alt hx-band"><div class="shell w-grid">
  <div style="position:relative">
    ${media(
      '',
      'w-media-leaf',
      'agency.jpg',
      'A health worker taking a woman’s blood pressure at a community clinic',
      float('w-float-br', 'userCheck', 'warn', 'Already enrolled', 'Agency B learns nothing else'),
      'center 30%',
    )}
    <div class="hx-script-tl">${script(['Same person.', 'Two lists.'])}</div>
  </div>
  <div class="w-copy">
    <p class="w-eyebrow">The problem</p>
    <h2 class="w-h">Two lists.<em>One person. Paid twice.</em></h2>
    <p class="w-lede">When a flood or a war displaces a town, several agencies arrive at once. Each one registers the people it reaches, and each one pays from its own list.</p>
    <ul class="w-feats">
      ${PROBLEM.map(([i, t, d]) => `<li class="w-feat"><span class="w-tile">${ic(i)}</span><b>${t}</b><p>${d}</p></li>`).join('')}
    </ul>
  </div>
</div></section>`

/* ------------------------------------------------------------ how it works -- */

/** The phone from the claim screen, drawn in HTML so it stays crisp and themed. */
const phone = () => `<div class="hx-phone" aria-hidden="true">
  <div class="hx-phone-notch"></div>
  <div class="hx-phone-screen">
    <span class="hx-phone-chip">${ic('phone')} Recipient</span>
    <b class="hx-phone-amount">50 AID</b>
    <span class="hx-phone-note">Round 1 · through Agency B</span>
    <ol class="hx-phone-steps">
      <li data-state="done">Place in the list</li>
      <li data-state="done">Proof made on this phone</li>
      <li data-state="done">Checked on Stellar</li>
    </ol>
    <span class="hx-phone-paid">${ic('checkCircle')} Paid</span>
  </div>
</div>`

const diagram = () => `<div class="hx-diagram" role="img" aria-label="Two agencies and a recipient's phone connect to one shared registry on Stellar">
  <div class="hx-dg-col">
    <div class="hx-node">${ic('building')}<div><b>Agency A</b><span>Enrols people</span></div></div>
    <div class="hx-node">${ic('building')}<div><b>Agency B</b><span>Enrols people</span></div></div>
    <p class="hx-dg-label">${ic('lock')} Send commitments, never names</p>
  </div>
  <div class="hx-dg-wire" aria-hidden="true"><i></i></div>
  <div class="hx-dg-core">
    <span class="hx-dg-badge">${ic('cpu')} Soroban contract</span>
    <b>Shared registry</b>
    <ul>
      <li>${ic('list')} One list of commitments</li>
      <li>${ic('fingerprint')} Verifies each proof</li>
      <li>${ic('hash')} Remembers each code once</li>
      <li>${ic('coins')} Pays the round amount</li>
    </ul>
  </div>
  <div class="hx-dg-wire hx-dg-wire-r" aria-hidden="true"><i></i></div>
  <div class="hx-dg-col hx-dg-phone">${phone()}</div>
</div>`

const STEPS = [
  ['id', 'Enrol', 'An agency enters the ID number and date of birth it already holds. Only a commitment joins the shared list.'],
  ['ban', 'Catch the duplicate', 'If any agency already enrolled that person, the registry says "already enrolled". Nothing else.'],
  ['fingerprint', 'Prove on the phone', 'The person signs in with their ID and their own PIN, picks their own wallet, and their phone makes the proof in about two seconds.'],
  ['coins', 'Paid once', 'The contract verifies the proof, pays, and refuses the same code at every other agency.'],
]

const how = () => `<section class="hx-section" id="how"><div class="shell">
  <div class="hx-head">
    <p class="w-eyebrow">How it works</p>
    <h2 class="w-h">Enrol. Prove.<em>Paid once.</em></h2>
    <p class="w-lede">Agencies keep their own systems. They add one call to enrol, and the registry checks every claim.</p>
  </div>
  ${diagram()}
  <ol class="w-flow hx-flow">
    ${STEPS.map(([i, t, d], x) => `<li class="w-step"><span class="w-tile">${ic(i)}</span><span class="w-num">${x + 1}</span><b>${t}</b><p>${d}</p></li>`).join('')}
  </ol>
</div></section>`

/* ---------------------------------------------------------------- privacy -- */

const SEES = [
  ['check', 'Whether a person is already enrolled by any agency'],
  ['check', 'Whether a one-time code has claimed this round'],
  ['check', 'That a payment happened, on a public record'],
]
const NEVER = [
  ['eyeOff', 'A name or an ID number, on-chain or off'],
  ['eyeOff', 'Which agency enrolled someone'],
  ['eyeOff', 'Which person a payment went to'],
]

const privacy = () => `<section class="w-band hx-band" id="privacy"><div class="shell w-grid">
  <div class="w-copy">
    <p class="w-eyebrow">Privacy</p>
    <h2 class="w-h">A yes or a no.<em>Nothing more.</em></h2>
    <p class="w-lede">A zero-knowledge proof lets a phone convince the registry of two facts without revealing anything behind them. The same code at every agency is what stops a second claim; the code itself points to no one.</p>
    <div class="hx-compare">
      <div class="hx-compare-col">
        <span class="hx-compare-h hx-good">${ic('eye')} What an agency sees</span>
        <ul>${SEES.map(([i, t]) => `<li>${ic(i)}<span>${t}</span></li>`).join('')}</ul>
      </div>
      <div class="hx-compare-col">
        <span class="hx-compare-h hx-bad">${ic('lock')} What it never sees</span>
        <ul>${NEVER.map(([i, t]) => `<li>${ic(i)}<span>${t}</span></li>`).join('')}</ul>
      </div>
    </div>
  </div>
  <div style="position:relative">
    ${media(
      'w-frame-round',
      'w-media-round',
      'recipient.jpg',
      'A smiling young woman holding her phone',
      float('w-float-bl', 'shield', 'good', 'Verified', 'Identity never revealed'),
      '62% 30%',
    )}
    <div class="hx-script-tr">${script(['Your proof.', 'Not your name.'])}</div>
  </div>
</div></section>`

/* ------------------------------------------------------------- technology -- */

const TECH = [
  ['cpu', 'Verified on-chain', 'Each claim proof is checked inside a Soroban contract with the BN254 pairing functions Stellar added in Protocol 25. About a third of one transaction’s compute budget.'],
  ['network', 'One shared tree', 'One shared list of commitments, 18 levels deep: room for about 262,000 people per registry, with the same hashes in the circuit, the contract and the browser.'],
  ['hash', 'One code per round', 'The one-time code is a hash of the person’s secret and the round. Same at every agency, different every round, and bound to the payout address.'],
  ['heart', 'Open by default', 'Circuits and verifier adapted from ZK-VOTE (MIT); Poseidon from Stellar’s rs-soroban-poseidon. Credited in the repository.'],
]

const tech = () => `<section class="hx-section hx-section-alt" id="tech"><div class="shell">
  <div class="hx-head">
    <p class="w-eyebrow">Technology</p>
    <h2 class="w-h">Proven on a phone.<em>Verified on Stellar.</em></h2>
  </div>
  <div class="w-cards">
    ${TECH.map(([i, t, d]) => `<div class="w-card"><span class="w-tile">${ic(i)}</span><b>${t}</b><p>${d}</p></div>`).join('')}
  </div>
</div></section>`

/* -------------------------------------------------------------------- cta -- */

const cta = () => `<section class="hx-section"><div class="shell">
  <div class="hx-cta">
    <div>
      <h2>Catch a duplicate. Live.</h2>
      <p>Enrol someone at Agency A, try again at Agency B, then claim from the phone twice. Every step is a real transaction on Stellar testnet.</p>
    </div>
    <div class="hx-cta-btns">
      <a class="w-btn hx-btn-light" href="agency.html?a=a">${ic('building')} Agency A</a>
      <a class="w-btn hx-btn-ghost" href="agency.html?a=b">${ic('building')} Agency B</a>
      <a class="w-btn hx-btn-ghost" href="claim.html">${ic('phone')} Recipient</a>
    </div>
  </div>
</div></section>`

const footer = () => `<footer class="hx-foot"><div class="shell hx-foot-in">
  <div>
    <a class="brand" href="index.html"><span class="mark">${MARK}</span>Hapax</a>
    <p>One claim per person, across every agency. Built for Find Your Way on Stellar.</p>
  </div>
  <div class="hx-foot-note">
    <b>${ic('warn')} What this demo assumes</b>
    <p>Testnet only. The enrolment service holds one secret value (the pepper) that turns an ID number into a person’s secret, so it is trusted; deriving the secret from a passport chip would remove that. Proving keys come from a single-party setup, not a public ceremony.</p>
  </div>
  <p class="hx-foot-credit">Photographs from Unsplash. Icons from Lucide. UNHCR figures from the Stellar Development Foundation’s Stellar Aid Assist report.</p>
</div></footer>`

const landing = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Hapax · one claim per person, across every agency</title>
<meta name="description" content="A shared, private duplicate check for aid agencies on Stellar, using zero-knowledge proofs."/>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg"/>
${FONTS}
<link rel="stylesheet" href="assets/quorum.css"/>
<link rel="stylesheet" href="assets/hapax.css"/>
${PREPAINT}
</head>
<body class="hx-landing">
${nav()}
<main>
${hero()}
${stack()}
${strip()}
${problem()}
${how()}
${privacy()}
${tech()}
${cta()}
</main>
${footer()}
<script src="assets/hapax.js"></script>
</body>
</html>`

export { landing }
