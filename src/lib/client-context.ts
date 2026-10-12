/**
 * Which shell the page is running in, for the login diagnostic only.
 *
 * Sessions last 400 days and renew while in use, yet users still sign in
 * again within hours or days — and every one of those logins arrives with
 * no cookie at all, so the browser dropped it rather than the server
 * refusing it. The usual cause is a separate cookie jar: the Play app, an
 * iOS Home Screen app, Safari, and a link opened inside WhatsApp or
 * Instagram each keep their own. The user agent can't tell them apart;
 * this can.
 *
 * Sent as a header on POST /api/auth/otp/verify and logged there. Never
 * used to decide anything.
 */
export const CLIENT_CONTEXT_HEADER = 'x-client-context';

export function clientContext(): string {
  if (typeof window === 'undefined') return 'unknown';
  try {
    // The Play app (TWA) launches with an android-app:// referrer.
    if (document.referrer.startsWith('android-app://')) return 'twa';
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return 'ios-home-screen';
    if (window.matchMedia('(display-mode: standalone)').matches) return 'installed-pwa';
    return 'browser';
  } catch {
    return 'unknown';
  }
}
