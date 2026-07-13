---
name: NDJSON streaming resilience pattern
description: How the assistant chat's streaming pipeline retries, falls back, and recovers from disconnects without duplicating messages or double-toasting errors.
---

## Compression buffers NDJSON on mobile
`compression()` middleware applied globally will buffer NDJSON streaming
responses until it has enough bytes to compress, which delays/batches chunks
instead of flushing immediately. On iOS Safari over mobile networks this
looks like a dead connection and the stream gets dropped before completion.

**Fix pattern:** give `compression()` a `filter` that returns `false` when
`Content-Type` includes `ndjson`, falling back to `compression.filter` otherwise.

## Retryable vs non-retryable provider errors
Classify AI provider errors before retrying: network/5xx/408/409/429 are
retryable (transient); 400 billing errors (e.g. "credit balance too low") and
401/403 auth errors are not — retrying just re-hits the same broken account.
Skipping the pointless retry for non-retryable errors and going straight to
the non-streaming fallback (then a clean structured terminal error) keeps
response time low instead of doubling the wasted latency.

## `{reset: true}` protocol line for mid-stream retries
If a server retries a stream (or falls back to non-streaming) on the SAME
open NDJSON connection after already having emitted some `delta` chunks, it
must emit a `{reset: true}` line first so the client clears its accumulated
buffer — otherwise the retried content gets appended after garbage from the
failed attempt, corrupting the visible message.

## Client-side recovery must not duplicate user messages
If the route inserts the user's message unconditionally at the top of the
handler (before generation), a client that sees a dropped connection must
NOT resubmit the same content — that duplicates the row. Instead, since
server-side generation continues independently of whether the response
stream write succeeds (writes to a dead socket are swallowed, generation
still finishes and saves), the correct single retry is: wait briefly, then
GET the session's messages and check whether a new assistant reply appeared
after the known message count. Only show a "please resend" error if that
poll finds nothing.

## Distinguish "server explained the failure" from "connection just dropped"
Track a boolean when a server-emitted structured `{error, code, arabicMessage}`
line was already shown to the user. Only fall into the generic
"stream ended unexpectedly"/reconnect-and-poll path when no explicit error
was received — otherwise the user sees two conflicting toasts for one failure.
