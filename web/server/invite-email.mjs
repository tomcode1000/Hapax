/**
 * The enrolment invite, in the product's own design.
 *
 * Mirrors Quorum's work-email.ts: the pale blue ground, a white card with the
 * app's 16px radius and hairline border, the brand mark drawn in table cells
 * (mail clients strip SVG and stylesheets), the uppercase chip over the
 * heading, the full-width primary button and the tinted info panel. Tables
 * and inline styles only. Light tokens only; mail clients do not honour the
 * app's dark mode, so it does not pretend to.
 *
 * What it carries: where to claim, the one-time activation code, and how much
 * the round pays. What it never carries: the person's ID number or date of
 * birth, so a forwarded or leaked email is not enough to claim.
 */

const INK = '#0f1b35'
const INK_2 = '#33415c'
const INK_3 = '#5b6b85'
const INK_4 = '#8a97b0'
const ACCENT = '#1f6feb'
const WASH = '#eaf2fe'
const GROUND = '#f6f8fc'
const BORDER = '#e6ecf5'
const WARN_WASH = '#fdf3e7'
const WARN = '#b45309'
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const dateWord = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/** One numbered step, as a table row: the number in a wash circle, then the words. */
const step = (n, title, body) => `<tr>
  <td width="34" valign="top" style="width:34px;padding:0 0 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="24" height="24" align="center" valign="middle" style="width:24px;height:24px;border-radius:12px;background:${WASH};font-family:${FONT};font-size:12px;font-weight:700;color:${ACCENT};">${n}</td></tr></table>
  </td>
  <td valign="top" style="padding:2px 0 14px;font-family:${FONT};">
    <div style="font-size:14px;font-weight:600;color:${INK};">${title}</div>
    <div style="padding-top:3px;font-size:13px;line-height:1.55;color:${INK_3};">${body}</div>
  </td>
</tr>`

export function inviteEmail({ agencyName, code, expiresAt, amount, claimUrl }) {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  const until = dateWord(expiresAt)
  const agency = escape(agencyName)
  const subject = `You can claim ${amount} with Hapax`

  const text = [
    `${agencyName} has enrolled you for aid through Hapax.`,
    '',
    `This round pays ${amount}, once, to your own wallet.`,
    '',
    `Your activation code: ${spaced}`,
    `Use it once, the first time you claim. It expires on ${until}.`,
    '',
    `Claim here: ${claimUrl}`,
    '',
    '1. Open the claim page and choose "First time".',
    '2. Enter your ID number, your date of birth and this code, then choose a PIN only you know.',
    '3. Pick your own wallet and claim. Next time, it is just your ID number and PIN.',
    '',
    'Nobody from Hapax or any agency will ever ask you for this code or your PIN.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${agency} enrolled you. This round pays ${escape(amount)}, once, to your own wallet.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

        <!-- Brand: the Hapax mark, a rounded square holding one dot, drawn in cells -->
        <tr>
          <td style="padding:0 4px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="22" height="22" align="center" valign="middle" style="width:22px;height:22px;border:3px solid ${ACCENT};border-radius:8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="8" height="8" style="width:8px;height:8px;background:${ACCENT};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
                </td>
                <td style="padding-left:10px;font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:-0.035em;color:${INK};">Hapax</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:32px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:18px;">
                  <span style="display:inline-block;padding:6px 10px;border-radius:7px;background:${WASH};font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">You're enrolled</span>
                </td>
              </tr>
              <tr>
                <td style="font-family:${FONT};font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.035em;color:${INK};">Your aid is ready.<br>Claim it once.</td>
              </tr>
              <tr>
                <td style="padding-top:14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK_3};">
                  ${agency} has added you to a shared aid registry. Claim from your own phone, to your own wallet, with your ID number and a PIN only you choose.
                </td>
              </tr>

              <!-- Activation code -->
              <tr>
                <td style="padding-top:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:12px;background:#fafbfe;">
                    <tr>
                      <td align="center" style="padding:20px 18px 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${INK_4};">Your activation code</td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:4px 18px 4px;font-family:${MONO};font-size:34px;font-weight:600;letter-spacing:0.18em;color:${INK};">${spaced}</td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:6px 18px 20px;font-family:${FONT};font-size:12.5px;line-height:1.5;color:${INK_4};">Use it once, the first time you claim. Expires ${until}.</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Amount -->
              <tr>
                <td style="padding-top:14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px;font-family:${FONT};font-size:13px;color:${INK_3};">This round pays</td>
                      <td align="right" style="padding:16px 18px;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-0.03em;color:${INK};">${escape(amount)}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding:0 18px 16px;font-family:${FONT};font-size:12.5px;line-height:1.5;color:${INK_4};">Once per round, to a wallet you control. Paid on Stellar, with a public record.</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Button -->
              <tr>
                <td style="padding-top:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="background:${ACCENT};border-radius:12px;">
                        <a href="${escape(claimUrl)}" style="display:block;padding:17px 20px;font-family:${FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Claim your aid &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Steps -->
              <tr>
                <td style="padding-top:26px;">
                  <div style="padding-bottom:12px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${INK_4};">How to claim</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${step(1, 'Open the claim page', 'Choose <b style="color:' + INK_2 + ';">First time</b>.')}
                    ${step(2, 'Prove it’s you, once', 'Your ID number, your date of birth and the code above. Then choose a PIN only you know.')}
                    ${step(3, 'Pick your wallet and claim', 'Your own Stellar wallet. Next round, it is just your ID number and PIN.')}
                  </table>
                </td>
              </tr>

              <!-- Info -->
              <tr>
                <td style="padding-top:6px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${WARN_WASH};border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px;font-family:${FONT};">
                        <div style="font-size:14px;font-weight:600;color:${WARN};">Keep this code to yourself</div>
                        <div style="padding-top:5px;font-size:13px;line-height:1.55;color:${INK_2};">Nobody from Hapax or any agency will ever ask for this code or your PIN, by phone, message or email.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${INK_4};">
            You received this because ${agency} enrolled you. Hapax uses this address only to send this code and does not keep it. Agencies on the registry never see your name, your ID number or your PIN.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  return { subject, text, html }
}
