/**
 * How long a session lives without being renewed: 400 days, the longest a
 * browser will keep a cookie (Chrome clamps any longer `Max-Age` to this),
 * so the token and the cookie that carries it expire together.
 *
 * This is an *idle* limit, not a hard one. `renewSessionIfStale`
 * (`src/lib/session-renewal.ts`) re-issues the token at most once a day
 * while the app is in use, so an active user is never signed out.
 */
export const SESSION_TTL_SECONDS = 400 * 24 * 60 * 60;
