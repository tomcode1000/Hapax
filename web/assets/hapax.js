/*
  Hapax client. One file for every page: it reads data-page from <body> and
  wires only what that page has. Figures come from /api/state or the chain;
  until they arrive the markup says "Loading".
*/
;(() => {
  const $ = (key) => document.querySelector(`[data-h="${key}"]`)
  const set = (key, text) => {
    const el = $(key)
    if (el) el.textContent = text
  }
  const show = (key, on = true) => {
    const el = $(key)
    if (el) el.hidden = !on
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const short = (s) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '—')
  const aid = (stroops) => (stroops == null ? '—' : `${(Number(stroops) / 1e7).toLocaleString('en', { maximumFractionDigits: 2 })} AID`)
  const explorer = (kind, id) => `https://stellar.expert/explorer/testnet/${kind}/${id}`
  const api = async (path, body) => {
    const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`)
    return out
  }

  /* --------------------------------------------------------------- theme -- */

  const applyTheme = (theme) => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    for (const b of document.querySelectorAll('[data-theme-toggle]')) {
      b.setAttribute('aria-pressed', String(theme === 'dark'))
      const l = b.querySelector('[data-theme-label]')
      if (l) l.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode'
    }
  }
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  for (const b of document.querySelectorAll('[data-theme-toggle]'))
    b.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try {
        localStorage.setItem('hapax-theme', next)
      } catch (e) {}
    })

  for (const b of document.querySelectorAll('[data-rail-toggle]'))
    b.addEventListener('click', () => {
      const root = document.documentElement
      const collapse = root.getAttribute('data-rail') !== 'collapsed'
      if (collapse) root.setAttribute('data-rail', 'collapsed')
      else root.removeAttribute('data-rail')
      b.setAttribute('aria-expanded', String(!collapse))
      try {
        localStorage.setItem('hapax-rail', collapse ? 'collapsed' : 'open')
      } catch (e) {}
    })

  const netPill = (ok) => {
    const p = $('net-pill')
    if (!p) return
    p.textContent = ok ? 'Live on testnet' : 'Service unreachable'
    p.className = `ap-pill ${ok ? 'ap-pill-good' : 'ap-pill-bad'}`
  }

  const page = document.body.dataset.page

  /* -------------------------------------------------------------- agency -- */

  const FEED = {
    enrolled: ['Enrolled', 'userCheck', 'good'],
    'duplicate-enrol': ['Duplicate enrolment blocked', 'ban', 'bad'],
    paid: ['Claim paid', 'coins', 'good'],
    'duplicate-claim': ['Second claim blocked', 'ban', 'bad'],
    rejected: ['Claim rejected', 'warn', 'bad'],
  }
  const ICONS = window.HAPAX_ICONS || {}
  const tile = (name, tone) =>
    `<span class="ap-tile ap-tile-sm${tone ? ` ap-tile-${tone}` : ''}"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg></span>`
  const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  function renderState(s, me) {
    set('enrolled', String(s.enrolled))
    set('mine', String(s.byAgency[me] ?? 0))
    set('paid', String(s.paid))
    set('blocked', String(s.blocked.enrol + s.blocked.claim))
    set('round', `Round ${s.round}`)
    set('round-n', String(s.round))
    if (s.roundBalance != null) {
      const left = Number(s.roundBalance)
      const paidOut = Number(s.paid) * Number(s.roundAmount)
      const pct = left + paidOut > 0 ? Math.max(2, Math.round((left / (left + paidOut)) * 100)) : 100
      const g = $('gauge')
      if (g) g.style.width = `${pct}%`
      const people = Number(s.roundAmount) > 0 ? Math.floor(left / Number(s.roundAmount)) : 0
      set('gauge-note', `Enough for ${people.toLocaleString('en')} more ${people === 1 ? 'person' : 'people'} this round`)
    }
    set('amount', aid(s.roundAmount))
    set('balance', aid(s.roundBalance))
    const reg = $('registry')
    if (reg) reg.innerHTML = `<a class="ap-more ap-mono-val" href="${explorer('contract', s.registry)}" target="_blank" rel="noopener">${short(s.registry)}</a>`
    const acct = $('account')
    if (acct && s.agencies[me]) acct.innerHTML = `<a class="ap-more ap-mono-val" href="${explorer('account', s.agencies[me].address)}" target="_blank" rel="noopener">${short(s.agencies[me].address)}</a>`
    const feed = $('feed')
    if (feed && s.feed.length) {
      feed.innerHTML = s.feed
        .map((e) => {
          const [title, icon, tone] = FEED[e.kind] ?? [e.kind, 'warn', '']
          const who = s.agencies[e.agency]?.name ?? ''
          return `<div class="ap-feed-row"><span class="ap-feed-at">${clock(e.at)}</span>${tile(icon, tone)}<div><b>${esc(title)}</b><span>${esc(e.detail)}${who ? ` · ${esc(who)}` : ''}</span></div>${
            e.hash ? `<a class="ap-more" href="${explorer('tx', e.hash)}" target="_blank" rel="noopener">Record</a>` : ''
          }</div>`
        })
        .join('')
    }
  }

  if (page === 'agency') {
    const me = new URLSearchParams(location.search).get('a') === 'b' ? 'b' : 'a'
    for (const a of document.querySelectorAll('.ap-nav a'))
      a.toggleAttribute('aria-current', a.getAttribute('href') === `agency.html?a=${me}` || a.getAttribute('href') === `agency?a=${me}`)

    const poll = async () => {
      try {
        const s = await api('/api/state')
        set('agency-name', s.agencies[me].name)
        document.title = `${s.agencies[me].name} · Hapax`
        renderState(s, me)
        netPill(true)
      } catch (e) {
        netPill(false)
      }
    }
    poll()
    setInterval(poll, 3000)

    const form = $('enrol-form')
    form?.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const btn = $('enrol-btn')
      const idNumber = $('idn').value.trim()
      const dob = $('dob').value
      const email = $('em').value.trim()
      for (const k of ['enrol-ok', 'enrol-dup', 'enrol-err', 'next-box']) show(k, false)
      btn.disabled = true
      const label = btn.innerHTML
      btn.textContent = 'Enrolling on Stellar…'
      try {
        const r = await api('/api/enrol', { agency: me, idNumber, dob, email })
        if (r.status === 'enrolled') {
          const sent = r.emailed
            ? ` Invite with their activation code sent to ${r.sentTo}.`
            : r.testCode
              ? ` Test address: activation code ${r.testCode}.`
              : ' The invite email could not be sent; check the email settings.'
          $('enrol-ok').querySelector('p').textContent = `Added to the shared list as person #${r.index + 1}.${sent}`
          $('em').value = ''
          show('enrol-ok')
          const url = new URL('claim', location.href).href
          const link = $('claim-url')
          if (link) link.textContent = url.replace(/^https?:\/\//, '')
          show('next-box')
          $('idn').value = ''
          $('dob').value = ''
        } else {
          show('enrol-dup')
        }
        poll()
      } catch (e) {
        $('enrol-err').querySelector('p').textContent = e.message
        show('enrol-err')
      } finally {
        btn.disabled = false
        btn.innerHTML = label
      }
    })
  }

  /* --------------------------------------------------------------- claim -- */

  async function recipientField(strkey) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(strkey)))
    d[0] = 0
    return BigInt(`0x${[...d].map((b) => b.toString(16).padStart(2, '0')).join('')}`).toString()
  }

  const prove = (input) =>
    new Promise((resolve, reject) => {
      const w = new Worker('assets/prove-worker.js')
      w.onmessage = (e) => {
        w.terminate()
        e.data.ok ? resolve(e.data) : reject(new Error(e.data.error))
      }
      w.onerror = (e) => {
        w.terminate()
        reject(new Error(e.message || 'Proof worker failed'))
      }
      w.postMessage(input)
    })

  if (page === 'claim') {
    let via = new URLSearchParams(location.search).get('via') === 'b' ? 'b' : 'a'
    let mode = 'signin'
    let asset = null
    let agencies = {}
    let verified = null // { secret, root, pathElements, pathIndices, roundId }
    let recipient = null
    let lastProof = null

    const errIn = (key, text) => {
      const box = $(key)
      box.querySelector('p').textContent = text
      box.hidden = false
    }

    api('/api/state')
      .then((s) => {
        asset = s.asset
        agencies = s.agencies
        set('c-amount', aid(s.roundAmount))
        set('c-round', String(s.round))
        netPill(true)
      })
      .catch(() => netPill(false))

    /* Step 1: verify. */
    const setMode = (m) => {
      mode = m
      for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-selected', String(b.dataset.mode === m))
      show('dob-row', m === 'activate')
      show('pin2-row', m === 'activate')
      set('pin-label', m === 'activate' ? 'Choose a PIN' : 'PIN')
      set('verify-note', m === 'activate' ? 'Enter your ID number, your date of birth and the code from your invite email, then choose a PIN only you know.' : 'Only you know your PIN. The agency never sees it.')
      show('verify-err', false)
    }
    for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode))
    $('s1').classList.add('hx-step-open')

    const complete = (n) => {
      show(`s${n}-body`, false)
      show(`s${n}-done`)
      show(`s${n}-summary`)
      $(`s${n}`).classList.add('hx-step-complete')
    }
    const open = (n) => {
      show(`s${n}-body`)
      $(`s${n}`).classList.add('hx-step-open')
    }

    $('verify-form').addEventListener('submit', async (ev) => {
      ev.preventDefault()
      show('verify-err', false)
      const idNumber = $('vid').value.trim()
      const pin = $('vpin').value.trim()
      const body = { idNumber }
      if (mode === 'activate') {
        if (pin !== $('vpin2').value.trim()) return errIn('verify-err', 'The two PINs do not match.')
        Object.assign(body, { dob: $('vdob').value, code: $('vcode').value.replace(/s/g, ''), newPin: pin })
      } else body.pin = pin
      const btn = $('verify-btn')
      btn.disabled = true
      try {
        const r = await api('/api/verify', body)
        if (r.status === 'ok') {
          verified = r
          complete(1)
          open(2)
        } else if (r.status === 'locked') errIn('verify-err', `Too many wrong attempts. Try again in ${r.minutes} minutes.`)
        else if (r.status === 'not-active') {
          setMode('activate')
          errIn('verify-err', 'You have not set a PIN yet. Enter your date of birth and choose one.')
        } else if (r.status === 'already-active') {
          setMode('signin')
          errIn('verify-err', 'You already set a PIN. Sign in with it.')
        } else errIn('verify-err', mode === 'signin' ? 'Those details do not match. First time here? Choose “First time” to set your PIN.' : 'Those details do not match what the agency registered.')
      } catch (e) {
        errIn('verify-err', e.message)
      } finally {
        btn.disabled = false
      }
    })

    /* Step 2: the recipient's own wallet. */
    const busy = (text) => {
      const n = $('wallet-busy')
      n.textContent = text || ''
      n.hidden = !text
      for (const k of ['w-freighter', 'w-test', 'w-paste']) $(k).disabled = Boolean(text)
    }
    const useWallet = (address) => {
      recipient = address
      set('w-addr', short(address))
      $('w-link').href = explorer('account', address)
      complete(2)
      open(3)
    }
    const walletAction = async (label, job) => {
      show('wallet-err', false)
      if (!asset) return errIn('wallet-err', 'Still loading the round. Try again in a second.')
      busy(label)
      try {
        await job()
      } catch (e) {
        errIn('wallet-err', e.message)
      } finally {
        busy('')
      }
    }
    $('w-freighter').addEventListener('click', () =>
      walletAction('Waiting for Freighter… approve the AID trustline if it asks.', async () => {
        const w = await HapaxWallet.connectFreighter(asset)
        useWallet(w.address)
      }),
    )
    $('w-test').addEventListener('click', () =>
      walletAction('Creating your wallet on testnet…', async () => {
        const w = await HapaxWallet.createTestWallet(asset)
        set('secret-key', w.secret)
        show('keybox')
        useWallet(w.address)
        show('s2-body')
        for (const k of ['w-freighter', 'w-test', 'w-paste']) $(k).hidden = true
      }),
    )
    $('copy-key')?.addEventListener('click', () => navigator.clipboard?.writeText($('secret-key').textContent))
    $('w-paste').addEventListener('click', () => {
      show('paste-form')
      $('paste-addr').focus()
    })
    $('paste-form').addEventListener('submit', (ev) => {
      ev.preventDefault()
      walletAction('Checking that address…', async () => {
        const w = await HapaxWallet.checkAddress($('paste-addr').value.trim(), asset)
        useWallet(w.address)
      })
    })

    /* Step 3: prove and claim. */
    const step = (name) => {
      const list = $('steps')
      list.hidden = false
      let reached = false
      for (const li of list.querySelectorAll('li')) {
        if (li.dataset.step === name) {
          li.dataset.state = 'active'
          reached = true
        } else li.dataset.state = reached ? '' : 'done'
      }
    }

    const finish = (r) => {
      if (r.status === 'paid') {
        for (const n of [1, 2, 3]) show(`s${n}`, false)
        show('paid')
        $('tx-link').href = explorer('tx', r.hash)
      } else if (r.status === 'already') {
        for (const n of [1, 2, 3]) show(`s${n}`, false)
        show('paid', false)
        show('already')
      } else if (r.reason === 'NoTrustline') {
        errIn('claim-err', 'That wallet cannot hold AID yet. Go back and connect a wallet with an AID trustline.')
      } else {
        errIn('claim-err', `The registry rejected the claim: ${r.reason}.`)
      }
    }

    $('claim-btn').addEventListener('click', async () => {
      const btn = $('claim-btn')
      btn.disabled = true
      show('claim-err', false)
      try {
        step('prove')
        const nullifier = HapaxPoseidon.poseidon2([BigInt(verified.secret), BigInt(verified.roundId)]).toString()
        const started = performance.now()
        lastProof = await prove({
          root: verified.root,
          nullifier,
          roundId: verified.roundId,
          recipient: await recipientField(recipient),
          secret: verified.secret,
          pathElements: verified.pathElements,
          pathIndices: verified.pathIndices,
        })
        console.info(`proof made in ${Math.round(performance.now() - started)} ms`)
        step('send')
        finish(await api('/api/claim', { via, recipient, proof: lastProof.proof, publicSignals: lastProof.publicSignals }))
      } catch (e) {
        errIn('claim-err', e.message)
      } finally {
        btn.disabled = false
      }
    })

    $('again').addEventListener('click', async () => {
      if (!lastProof) return
      via = via === 'a' ? 'b' : 'a'
      const btn = $('again')
      btn.disabled = true
      btn.textContent = `Claiming through ${agencies[via]?.name ?? 'the other agency'}…`
      try {
        finish(await api('/api/claim', { via, recipient, proof: lastProof.proof, publicSignals: lastProof.publicSignals }))
      } catch (e) {
        btn.textContent = e.message
      }
    })
  }
})()
