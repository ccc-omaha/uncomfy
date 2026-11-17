// Runs on every verified Netlify Forms submission (Netlify calls this by name).
// Sends the "Ask us something uncomfortable" question to podcast@cccomaha.org
// as a branded email that matches uncomfy.org, through CCC's Resend account.
//
// Netlify environment variables (Project configuration > Environment variables):
//   RESEND_API_KEY      required. CCC's Resend key.
//   UNCOMFY_NOTIFY_TO   optional. Defaults to podcast@cccomaha.org (comma-separate for more).
//   UNCOMFY_FROM_EMAIL  optional. Defaults to "unCOMFORTABLE Podcast <podcast@cccomaha.org>".
// Every submission also stays in Netlify under Forms > question, so nothing is lost
// if email is ever misconfigured.

// CCC brand colors only. Email clients can't load the site's web fonts, so the
// stacks name Proxima Nova first and fall back to Arial and Georgia.
const NAVY = '#00003D', CREAM = '#FBEFDA', AQUA = '#8DE2E0', MAGENTA = '#D81159', ORANGE = '#FF8017', PINK = '#F6CBE1';
const SANS = "'proxima-nova','Proxima Nova',Arial,Helvetica,sans-serif";
const SERIF = "'quincy-cf','Quincy CF',Georgia,'Times New Roman',serif";

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl2br = s => esc(s).replace(/\r?\n/g, '<br>');
const validEmail = s => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(s || '').trim());

function when(d) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function questionEmail({ question, name, email, anonymous, at }) {
  const who = name ? esc(name) : 'Someone';
  const row = (label, value) => `
          <tr>
            <td style="padding:10px 0;border-top:1px solid rgba(0,0,61,.12);width:38%;vertical-align:top;font:700 12px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${NAVY};opacity:.7">${label}</td>
            <td style="padding:10px 0;border-top:1px solid rgba(0,0,61,.12);vertical-align:top;font:700 16px/1.4 ${SANS};color:${NAVY}">${value}</td>
          </tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>New question for unCOMFORTABLE</title></head>
<body style="margin:0;padding:0;background:${NAVY}" bgcolor="${NAVY}">
<span style="display:none;max-height:0;overflow:hidden">${esc(String(question).slice(0, 120))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="background:${NAVY}"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
    <tr><td style="padding:0 6px 22px;font:900 26px/1 ${SANS};letter-spacing:-.03em;color:${CREAM}"><span style="color:${AQUA}">un</span>COMFORTABLE</td></tr>
    <tr><td bgcolor="${CREAM}" style="background:${CREAM};border-radius:20px;border:3px solid ${AQUA}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:28px 30px 0">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${MAGENTA}" style="background:${MAGENTA};border-radius:999px;padding:7px 14px;font:800 12px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${CREAM}">New question</td></tr></table>
          <div style="font:400 30px/1.12 ${SERIF};color:${NAVY};margin:18px 0 4px">${who} asked something uncomfortable.</div>
          <div style="font:400 14px/1.5 ${SANS};color:${NAVY};opacity:.65">${esc(when(at))}</div>
        </td></tr>
        <tr><td style="padding:22px 30px 6px">
          <div style="background:#ffffff;border:2px solid ${NAVY};border-radius:14px;padding:20px 22px;font:italic 400 21px/1.45 ${SERIF};color:${NAVY}">&ldquo;${nl2br(question)}&rdquo;</div>
        </td></tr>
        <tr><td style="padding:16px 30px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row('Name', name ? esc(name) : '<span style="opacity:.55">Not given</span>')}${row('Email', validEmail(email) ? `<a href="mailto:${esc(email)}" style="color:${NAVY}">${esc(email)}</a>` : '<span style="opacity:.55">Not given</span>')}${row('On the show', anonymous ? `<span style="background:${PINK};border-radius:6px;padding:3px 8px">Keep anonymous</span>` : 'Okay to use their first name')}
          </table>
        </td></tr>
        <tr><td style="padding:14px 30px 28px;font:400 14px/1.55 ${SANS};color:${NAVY}">${validEmail(email) ? `Reply to this email to answer ${who} directly.` : 'No email was given, so this one can only be answered on the show.'}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 6px 0;font:400 13px/1.6 ${SANS};color:${CREAM};opacity:.75">Sent from the question form on <a href="https://uncomfy.org/#ask" style="color:${AQUA}">uncomfy.org</a>. Every question is also saved in Netlify under Forms.<br><span style="color:${ORANGE}">&#10038;</span> Faith worth questioning. Conversations worth having.</td></tr>
  </table>
</td></tr></table></body></html>`;
}

export const handler = async (event) => {
  let payload;
  try { ({ payload } = JSON.parse(event.body || '{}')); } catch { return { statusCode: 400 }; }
  if (!payload || payload.form_name !== 'question') return { statusCode: 200 };

  const d = payload.data || {};
  const question = String(d.question || '').trim();
  if (!question) return { statusCode: 200 };
  const name = String(d.name || '').trim().slice(0, 80);
  const email = String(d.email || '').trim().slice(0, 200);
  const anonymous = d.anonymous === 'yes' || d.anonymous === true;
  const at = new Date(payload.created_at || Date.now());

  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('RESEND_API_KEY not set; question saved in Netlify Forms only'); return { statusCode: 200 }; }
  const to = (process.env.UNCOMFY_NOTIFY_TO || 'podcast@cccomaha.org').split(',').map(s => s.trim()).filter(Boolean);
  const from = process.env.UNCOMFY_FROM_EMAIL || 'unCOMFORTABLE Podcast <podcast@cccomaha.org>';
  const short = question.replace(/\s+/g, ' ').slice(0, 60) + (question.length > 60 ? '...' : '');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from, to,
      subject: `New question: ${short}`,
      reply_to: validEmail(email) ? email : undefined,
      html: questionEmail({ question, name, email, anonymous, at }),
      text: `New question for unCOMFORTABLE\n\n"${question}"\n\nName: ${name || 'Not given'}\nEmail: ${email || 'Not given'}\nOn the show: ${anonymous ? 'Keep anonymous' : 'Okay to use their first name'}\n\nSent from uncomfy.org`
    })
  }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
  if (!res.ok) console.error('Resend failed', res.status, await res.text());
  return { statusCode: 200 };
};
