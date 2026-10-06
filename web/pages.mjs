import { ic } from './build.mjs'
import { landing } from './landing.mjs'
import { claim } from './claim-page.mjs'
import { chip, pill, card, cardHead, stat, row, info, top, appPage } from './app-shell.mjs'

/* ----------------------------------------------------------------- agency -- */

/** How a duplicate is caught, as three linked steps. Same on every agency console. */
const caughtCard = () =>
  card(`
    ${cardHead('How a duplicate is caught')}
    <ol class="hx-mini">
      <li><span class="ap-tile ap-tile-sm">${ic('id')}</span><div><b>ID number in</b><span>Turned into a commitment. The number itself is dropped.</span></div></li>
      <li><span class="ap-tile ap-tile-sm">${ic('network')}</span><div><b>Checked against the shared list</b><span>Every agency writes to the same registry on Stellar.</span></div></li>
      <li><span class="ap-tile ap-tile-sm hx-tile-bad">${ic('ban')}</span><div><b>Yes or no comes back</b><span>"Already enrolled" is all you learn. No name, no agency.</span></div></li>
    </ol>
  `)

const agency = () =>
  appPage({
    title: 'Agency console',
    current: '',
    body: ' data-page="agency"',
    main: `${top(`<div>${chip('Agency console')}<h1 class="ap-h1" data-h="agency-name">Loading</h1></div>`, pill('Checking…', '', 'net-pill'))}

<section class="hx-banner">
  <div class="hx-banner-copy">
    <span class="hx-banner-tag">${ic('shield')} Shared registry · round <span data-h="round-n">Loading</span></span>
    <h2>Enrol once. Pay once.</h2>
    <p>Same registry as every other agency. You never see who anyone is. Neither do they.</p>
  </div>
  <div class="hx-banner-art" aria-hidden="true">
    <span class="hx-orb">${ic('building')}</span><i></i>
    <span class="hx-orb hx-orb-core">${ic('network')}</span><i></i>
    <span class="hx-orb">${ic('phone')}</span>
  </div>
</section>

<div class="ap-stats">
  ${stat('users', 'In the shared list', 'enrolled by every agency', 'enrolled')}
  ${stat('userCheck', 'Enrolled by you', 'from this console', 'mine')}
  ${stat('coins', 'Claims paid', 'this round, all agencies', 'paid', 'good')}
  ${stat('ban', 'Duplicates blocked', 'enrolments and claims', 'blocked', 'bad')}
</div>

<div class="ap-cols">
  <div class="ap-stack">
    ${card(`
      ${cardHead('Enrol a person', `<span class="hx-head-note">${ic('lock')} ID never stored</span>`)}
      <form class="ap-pad hx-form" data-h="enrol-form" style="padding-top:0" novalidate>
        <label class="hx-label" for="idn">National ID number</label>
        <div class="ap-field">${ic('id')}<input id="idn" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="e.g. 20934815" data-h="idn" aria-describedby="idn-note"/></div>
        <p class="hx-note" id="idn-note">Turned into the person's secret by the enrolment service. Only a commitment goes on-chain.</p>
        <label class="hx-label" for="dob">Date of birth</label>
        <div class="ap-field">${ic('calendar')}<input id="dob" type="date" data-h="dob" required/></div>
        <p class="hx-note">From your records. The person uses it once, to set their own PIN.</p>
        <label class="hx-label" for="em">Email for the invite</label>
        <div class="ap-field">${ic('mail')}<input id="em" type="email" autocomplete="off" placeholder="name@example.com" data-h="em"/></div>
        <p class="hx-note">Hapax emails a one-time activation code, then forgets the address.</p>
        <button class="ap-primary" type="submit" data-h="enrol-btn">Enrol person ${ic('arrow')}</button>
      </form>
      <div class="ap-pad" style="padding-top:0">
        ${info('checkCircle', 'Enrolled', '', 'good', ' data-h="enrol-ok" hidden')}
        ${info('ban', 'Already enrolled', 'This person is already on the shared list, enrolled by an agency. That is all Hapax tells you.', 'warn', ' data-h="enrol-dup" hidden')}
        <div class="hx-resend" data-h="resend-row" hidden>
          <span>Their invite never arrived, or the code expired?</span>
          <button class="ap-second" type="button" data-h="resend-btn">${ic('mail')} Resend the invite</button>
        </div>
        ${info('warn', 'Could not enrol', '', 'bad', ' data-h="enrol-err" hidden')}
        <div class="hx-next" data-h="next-box" hidden>
          <span>${ic('phone')} What the person does next</span>
          <ol>
            <li>Opens <b data-h="claim-url">the claim page</b> on their own phone, wherever they are.</li>
            <li>First time: enters their ID number, date of birth and the <b>emailed code</b>, then <b>sets their own PIN</b>. You never see it.</li>
            <li>Connects their own wallet and claims. Every later round: ID number + PIN.</li>
          </ol>
        </div>
      </div>
    `)}

    ${card(`
      ${cardHead('Live activity', `<span class="hx-live"><i></i>Every agency</span>`)}
      <div class="ap-feed" data-h="feed"><div class="hx-empty">${ic('activity')}<b>Nothing yet</b><span>Enrolments, payments and blocked duplicates from every agency appear here as they happen.</span></div></div>
    `)}
  </div>

  <div class="ap-stack">
    ${card(`
      ${cardHead('This round')}
      <div class="hx-gauge"><div class="hx-gauge-top"><span>Left to pay out</span><b data-h="balance">Loading</b></div><div class="hx-gauge-track"><i data-h="gauge" style="width:100%"></i></div><span class="hx-note" data-h="gauge-note">Loading</span></div>
      <div class="ap-rows ap-rows-inset">
        ${row({ icon: 'layers', title: 'Round', note: 'Shared by every agency', key: 'round' })}
        ${row({ icon: 'coins', title: 'Per person', note: 'Paid once, whichever agency', key: 'amount' })}
      </div>
    `)}
    ${caughtCard()}
    ${card(`
      ${cardHead('On-chain')}
      <div class="ap-rows ap-rows-inset">
        ${row({ icon: 'cpu', title: 'Registry contract', note: 'Verifies every claim proof', key: 'registry' })}
        ${row({ icon: 'key', title: 'Your agency account', note: 'Signs enrolments', key: 'account' })}
      </div>
    `)}
  </div>
</div>`,
  })

export { landing, agency, claim }
