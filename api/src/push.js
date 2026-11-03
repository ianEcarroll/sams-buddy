// Practice reminders: a web push notification to Sam's device at the time his team chose.
// Off unless VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set (make them with: npx web-push generate-vapid-keys).
import webpush from 'web-push';

export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@pinpointed.dev', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  configured = true;
}

// Returns 'sent', or 'gone' when the browser has dropped the subscription (delete it).
export async function sendPush(sub, payload, { send } = {}) {
  configure();
  try {
    await (send || webpush.sendNotification)({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
    return 'sent';
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) return 'gone';
    throw e;
  }
}

// Local date (YYYY-MM-DD) and time (HH:MM) in the learner's time zone.
export function localNow(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// A reminder is due once a day, from the chosen time until midnight, unless Sam has already practised
// today or one was already sent today.
export function reminderDue({ now, timeZone, reminderTime, lastReminderOn, lastPracticeAt }) {
  if (!/^\d{2}:\d{2}$/.test(reminderTime || '')) return false;
  const tz = timeZone || 'Europe/Paris';
  const { date, time } = localNow(now, tz);
  if (time < reminderTime) return false;
  if (lastReminderOn === date) return false;
  if (lastPracticeAt && localNow(new Date(lastPracticeAt), tz).date === date) return false;
  return true;
}

export function reminderMessage(name) {
  return { title: 'Buddy', body: `Hi ${name}, Buddy is ready when you are.`, url: '/' };
}
