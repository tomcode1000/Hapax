import { ic } from './build.mjs'
import { chip, pill, card, cardHead, row, info, top, appPage } from './app-shell.mjs'

/**
 * The recipient's claim page: three steps, in the Stellar Disbursement
 * Platform's own order.
 *
 *   1. Verify it is you. ID number + PIN; on the first visit, ID number +
 *      date of birth (what the agency has on record), then set a PIN.
 *   2. Choose where to be paid. The person's own wallet: Freighter, a pasted
 *      address, or a test wallet whose key is made in this browser.
 *   3. Claim. The phone makes the proof; the registry pays once.
 *
 * Hapax never creates or holds a recipient's wallet.
 */

const stepHead = (n, title, key) =>
  `<div class="hx-step-head"><span class="hx-step-n" data-h="${key}-n">${n}</span><h2 class="ap-h2">${title}</h2><span class="hx-step-done" data-h="${key}-done" hidden>${ic('checkCircle')} Done</span></div>`

export const claim = () =>
  appPage({
    title: 'Claim',
    current: 'recipient',
    body: ' data-page="claim"',
    scripts: '<script src="assets/wallet.js"></script>',
    main: `${top(`<div>${chip('Recipient')}<h1 class="ap-h1">Claim your aid</h1></div>`, pill('Checking…', '', 'net-pill'))}

<div class="ap-cols hx-claim">
  <div class="ap-stack">
    <section class="hx-claim-hero">
      <div>
        <span class="hx-banner-tag">${ic('shield')} Private claim · round <span data-h="c-round">Loading</span></span>
        <span class="hx-claim-label">This round pays</span>
        <b class="hx-claim-amount" data-h="c-amount">Loading</b>
        <span class="hx-claim-via">to each enrolled person, once, whichever agency enrolled them</span>
      </div>
      <span class="hx-claim-icon" aria-hidden="true">${ic('coins')}</span>
    </section>

    ${card(
      `${stepHead(1, 'Verify it’s you', 's1')}
      <div class="ap-pad hx-step-body" data-h="s1-body">
        <div class="hx-seg" role="tablist">
          <button type="button" role="tab" aria-selected="true" data-mode="signin">I have a PIN</button>
          <button type="button" role="tab" aria-selected="false" data-mode="activate">First time</button>
        </div>
        <form class="hx-form" data-h="verify-form" autocomplete="off">
          <label class="hx-label" for="vid">ID number</label>
          <div class="ap-field">${ic('id')}<input id="vid" type="text" inputmode="numeric" spellcheck="false" placeholder="Your national ID number" data-h="vid"/></div>
          <div data-h="dob-row" hidden>
            <label class="hx-label" for="vdob">Date of birth</label>
            <div class="ap-field">${ic('calendar')}<input id="vdob" type="date" data-h="vdob"/></div>
            <label class="hx-label" for="vcode">Activation code from your email</label>
            <div class="ap-field">${ic('mail')}<input id="vcode" type="text" inputmode="numeric" maxlength="7" placeholder="6 digits" data-h="vcode"/></div>
          </div>
          <label class="hx-label" for="vpin" data-h="pin-label">PIN</label>
          <div class="ap-field">${ic('lock')}<input id="vpin" type="password" inputmode="numeric" maxlength="6" placeholder="4 to 6 digits" data-h="vpin"/></div>
          <div data-h="pin2-row" hidden>
            <label class="hx-label" for="vpin2">Confirm your new PIN</label>
            <div class="ap-field">${ic('lock')}<input id="vpin2" type="password" inputmode="numeric" maxlength="6" placeholder="Type it again" data-h="vpin2"/></div>
          </div>
          <p class="hx-note" data-h="verify-note">Only you know your PIN. The agency never sees it.</p>
          <button class="ap-primary" type="submit" data-h="verify-btn">${ic('shield')} Verify</button>
        </form>
        ${info('warn', 'Not verified', '', 'bad', ' data-h="verify-err" hidden')}
      </div>
      <p class="hx-step-summary" data-h="s1-summary" hidden>${ic('userCheck')} Verified. Your proof will be made on this device.</p>`,
      ' data-h="s1"',
    )}

    ${card(
      `${stepHead(2, 'Where should we pay you?', 's2')}
      <div class="ap-pad hx-step-body" data-h="s2-body" hidden>
        <p class="ap-sub" style="margin-top:0">Your own Stellar wallet. Hapax never holds your keys.</p>
        <div class="hx-wallets">
          <button type="button" class="hx-wallet" data-h="w-freighter">${ic('plug')}<b>Connect Freighter</b><span>Your browser wallet, on Testnet</span></button>
          <button type="button" class="hx-wallet" data-h="w-test">${ic('plus')}<b>Create a test wallet</b><span>Made in this browser, yours alone</span></button>
          <button type="button" class="hx-wallet" data-h="w-paste">${ic('clipboard')}<b>Paste an address</b><span>Any wallet that holds AID</span></button>
        </div>
        <form class="hx-form" data-h="paste-form" hidden>
          <div class="ap-field">${ic('wallet')}<input type="text" spellcheck="false" placeholder="G… your Stellar address" data-h="paste-addr"/></div>
          <button class="ap-second" type="submit">${ic('check')} Use this address</button>
        </form>
        <p class="hx-note" data-h="wallet-busy" hidden></p>
        ${info('warn', 'Wallet not ready', '', 'bad', ' data-h="wallet-err" hidden')}
        <div class="hx-keybox" data-h="keybox" hidden>
          <b>${ic('key')} Your wallet’s secret key</b>
          <p>This key is the wallet. It was made in this browser and Hapax never saw it. Save it somewhere safe; without it, nobody can recover the funds.</p>
          <div class="hx-link-row"><code data-h="secret-key"></code><button class="ap-copy" type="button" data-h="copy-key" aria-label="Copy the key">${ic('copy')}</button></div>
        </div>
      </div>
      <p class="hx-step-summary" data-h="s2-summary" hidden>${ic('wallet')} Paying to <b data-h="w-addr"></b> <a class="ap-more" data-h="w-link" href="#" target="_blank" rel="noopener">View ${ic('out')}</a></p>`,
      ' data-h="s2"',
    )}

    ${card(
      `${stepHead(3, 'Claim', 's3')}
      <div class="ap-pad hx-step-body" data-h="s3-body" hidden>
        <p class="ap-sub" style="margin-top:0">Your phone proves you are on the shared list and gives a one-time code for this round. The proof says nothing about who you are.</p>
        <button class="ap-primary" type="button" data-h="claim-btn">${ic('fingerprint')} Claim now</button>
        <ol class="hx-steps" data-h="steps" hidden>
          <li data-step="prove">Making the proof on this phone</li>
          <li data-step="send">Checking it on Stellar</li>
        </ol>
        ${info('warn', 'Something went wrong', '', 'bad', ' data-h="claim-err" hidden')}
      </div>`,
      ' data-h="s3"',
    )}

    <div class="ap-centre" data-h="paid" hidden>
      <div class="ap-ok" aria-hidden="true"><i style="top:14px;left:20px"></i><i style="top:6px;right:30px"></i><i style="bottom:16px;left:10px"></i><i style="bottom:8px;right:18px"></i><span class="ap-ok-badge">${ic('check')}</span></div>
      <h2 class="ap-h1 ap-h1-lg">Paid</h2>
      <p class="ap-sub" style="margin-inline:auto">The aid is in your own wallet. Anyone can look the payment up, and nobody can tell it was you.</p>
      <a class="ap-more" data-h="tx-link" href="#" target="_blank" rel="noopener">Open the public record ${ic('out')}</a>
      <button class="ap-second" type="button" data-h="again" style="margin-top:18px">${ic('building')} Try to claim again through the other agency</button>
    </div>

    <div class="ap-centre" data-h="already" hidden>
      <div class="ap-ok ap-ok-bad" aria-hidden="true"><span class="ap-ok-badge">${ic('ban')}</span></div>
      <h2 class="ap-h1 ap-h1-lg">Already claimed this round</h2>
      <p class="ap-sub" style="margin-inline:auto">This round has already been paid to you through an agency. The other agency was told only that, and nothing about who you are.</p>
    </div>
  </div>

  <div class="ap-stack">
    ${card(`
      ${cardHead('What stays private')}
      <div class="ap-rows ap-rows-inset">
        ${row({ icon: 'lock', title: 'Your ID number', note: 'Never stored, never on-chain' })}
        ${row({ icon: 'key', title: 'Your PIN', note: 'Chosen by you, kept only as a hash' })}
        ${row({ icon: 'eyeOff', title: 'Your place in the list', note: 'Hidden inside the proof' })}
        ${row({ icon: 'hash', title: 'Your one-time code', note: 'Same at every agency, so you claim once' })}
      </div>
    `)}
    ${info('wallet', 'Your wallet, your money', 'The payout goes to a wallet you control and is bound into your proof, so it cannot be redirected. In a real programme this is USDC, which every Stellar wallet already holds.')}
  </div>
</div>`,
  })
