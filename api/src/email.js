// Practice emails: a short note to team members who asked for one, after each practice.
// Sent with Resend (https://resend.com). Off unless RESEND_API_KEY and EMAIL_FROM are set.
import { PLAN_GOALS, SUPPORT_CODES } from './coach/goals.js';

export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail({ to, subject, text, html }, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Who gets the email: team members who switched it on, and only if Sam lets their role see his records.
export function recipientsFor(adults, consent) {
  if (!consent?.agreed_at) return [];
  return adults.filter((a) => a.email_after_practice && consent.can_view?.[a.role]);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n = 220) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

function resultWord(r) {
  if (r.success === true) return 'Met the target';
  if (r.success === false) return 'Not yet';
  return 'Practice only (not counted)';
}

// Builds the email for one finished practice. Pure, so it can be tested without sending anything.
export function practiceEmail({ learnerName, adultName, activityTitle, records, reason, appUrl }) {
  const counted = records.filter((r) => r.success !== null && r.success !== undefined);
  const met = counted.filter((r) => r.success).length;
  const tally = counted.length ? ` (${met} of ${counted.length} met the target)` : '';
  const subject = `${learnerName} practised: ${activityTitle}${tally}`;
  const stopped = reason === 'finished' ? `${learnerName} stopped before the end.` : null;

  const items = records.map((r) => {
    const goal = PLAN_GOALS[r.plan_goal];
    return {
      label: r.item_label,
      goal: goal ? `Goal ${goal.n}: ${goal.label}` : 'Other practice',
      result: resultWord(r),
      support: r.support_code ? `${r.support_code} (${SUPPORT_CODES[r.support_code]})` : null,
      said: clip(r.sam_response),
      note: clip(r.review_note, 300),
    };
  });
  const link = appUrl ? `${appUrl.replace(/\/$/, '')}/adult/` : null;

  const text = [
    `Hi ${adultName},`,
    '',
    `${learnerName} just finished "${activityTitle}" with Buddy.${tally ? ` ${met} of ${counted.length} met the target.` : ''}`,
    stopped,
    '',
    ...items.flatMap((i) => [
      `• ${i.label} — ${i.result}`,
      `  ${i.goal}${i.support ? ` · Support: ${i.support}` : ''}`,
      i.said ? `  ${learnerName} said: "${i.said}"` : null,
      i.note ? `  ${i.note}` : null,
      '',
    ]),
    link ? `See every detail in Review practice: ${link}` : null,
    '',
    `You get this email because you asked for one after each practice. Turn it off under Team & privacy in the support-team area.`,
  ].filter((l) => l !== null).join('\n');

  const html = `<div style="font-family:Lexend,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.5;color:#14305a;max-width:560px">
<p>Hi ${esc(adultName)},</p>
<p><strong>${esc(learnerName)}</strong> just finished <strong>${esc(activityTitle)}</strong> with Buddy.${tally ? ` ${met} of ${counted.length} met the target.` : ''}</p>
${stopped ? `<p>${esc(stopped)}</p>` : ''}
${items.map((i) => `<div style="border:1px solid #d3deea;border-radius:12px;padding:12px 16px;margin:12px 0">
<div><strong>${esc(i.label)}</strong> · ${esc(i.result)}</div>
<div style="color:#4d5f78;font-size:14px">${esc(i.goal)}${i.support ? ` · Support: ${esc(i.support)}` : ''}</div>
${i.said ? `<p style="margin:8px 0 0">${esc(learnerName)} said: “${esc(i.said)}”</p>` : ''}
${i.note ? `<p style="margin:6px 0 0;color:#4d5f78;font-size:14px">${esc(i.note)}</p>` : ''}
</div>`).join('\n')}
${link ? `<p><a href="${esc(link)}" style="color:#0f7a6a">See every detail in Review practice</a></p>` : ''}
<p style="color:#4d5f78;font-size:13px">You get this email because you asked for one after each practice. Turn it off under Team &amp; privacy in the support-team area.</p>
</div>`;

  return { subject, text, html };
}

// "Forgot password": the link is single-use and expires, and the email says what to do if it wasn't them.
export function resetEmail({ name, link, minutes }) {
  const subject = 'Reset your Buddy password';
  const text = `Hi ${name || 'there'},\n\nSomeone asked to reset the password for your Buddy support-team account. If it was you, open this link within ${minutes} minutes to choose a new password:\n\n${link}\n\nThe link works once. Choosing a new password signs you out on your other devices.\n\nIf you didn't ask for this, you can ignore this email: your password hasn't changed.\n`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#14305a;max-width:520px">
<p>Hi ${esc(name || 'there')},</p>
<p>Someone asked to reset the password for your Buddy support-team account. If it was you, choose a new password within ${minutes} minutes:</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0f7a6a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Choose a new password</a></p>
<p style="color:#4a5b75">The link works once. Choosing a new password signs you out on your other devices.</p>
<p style="color:#4a5b75">If you didn't ask for this, you can ignore this email: your password hasn't changed.</p></div>`;
  return { subject, text, html };
}
