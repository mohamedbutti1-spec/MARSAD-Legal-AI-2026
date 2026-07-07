---
name: iOS SameSite Auth
description: SameSite=Strict breaks iOS Safari/PWA standalone mode; use Lax + refreshSession() not window.location.href after login
---

## Rule
Never use `SameSite: "strict"` for a JWT session cookie in a same-domain SPA.
Use `SameSite: "lax"` instead.

**Why:** iOS Safari in PWA standalone mode treats a post-form-submit `window.location.href = '/'`
hard navigation as a cross-context event. Cookies with `SameSite=Strict` are suppressed on the
subsequent navigation; the first `GET /api/auth/me` sees no cookie → 401/403 → redirect to login.
This appears to the user as "login works briefly then redirects back".

**Symptom in production logs:**
POST /api/auth/login → 200  then  GET /api/auth/me → 403, within ~1 second of each other.
The 403 comes from the no-origin gate because iOS strips the Origin header on standalone PWA
navigation requests (no-origin gate fires before CORS, before auth middleware).

**How to apply:**
- Cookie options: `{ sameSite: "lax", httpOnly: true, secure: IS_PRODUCTION, path: "/" }`
- BOTH the login Set-Cookie AND logout clearCookie must use the same SameSite attribute.
- Post-login: call `refreshSession()` from UserContext then wouter `navigate('/')` instead of
  `window.location.href`. This keeps the session in the same fetch context — cookie was just set,
  /api/auth/me is called in the same browsing context → cookie IS sent → no suppression.

**No-origin gate:** also exempt requests where `req.headers.referer` is present —
iOS sends Referer on some navigation subtypes even when Origin is absent.
