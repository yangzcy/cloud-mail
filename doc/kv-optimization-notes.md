# Cloud Mail KV Optimization Notes

## Background

The current `cloud-mail` deployment uses:

- `D1` for structured application data
- `R2` for object storage
- `KV` mainly for session and lightweight state

Confirmed production state:

- `storageType = R2`
- `hasR2 = true`

This means the recent Cloudflare KV usage alerts are not primarily caused by attachments or background files falling back into KV object storage.

## KV Hotspots

The main KV pressure comes from authenticated API traffic.

### 1. Session validation on protected routes

File: [mail-worker/src/security/security.js](/root/cloud-mail/mail-worker/src/security/security.js)

For protected routes, the backend currently does:

1. Verify JWT
2. Read `auth-uid:<userId>` from KV
3. Check whether the token is still present in the session whitelist

This means nearly every authenticated API request consumes at least one KV read.

### 2. Additional KV usage in the current design

- `auth-uid:*`: login session state
- `setting:`: setting cache
- `send_day_count:*`: daily send counter
- `public_key:`: public API token

## Optimizations Already Completed

### A. Reduced default mailbox polling

Files:

- [mail-vue/src/views/email/index.vue](/root/cloud-mail/mail-vue/src/views/email/index.vue)
- [mail-vue/src/views/all-email/index.vue](/root/cloud-mail/mail-vue/src/views/all-email/index.vue)

Changes:

- Removed the old implicit `3s` polling fallback
- Polling now only runs when `autoRefresh >= 2`
- When auto refresh is effectively off, the loop sleeps and does not send polling requests

Purpose:

- Reduce repeated `/email/latest` and `/allEmail/latest` requests
- Reduce repeated KV session lookups caused by mailbox polling

### B. Removed redundant user info refresh requests

Files:

- [mail-vue/src/store/user.js](/root/cloud-mail/mail-vue/src/store/user.js)
- [mail-vue/src/layout/write/index.vue](/root/cloud-mail/mail-vue/src/layout/write/index.vue)
- [mail-vue/src/layout/account/index.vue](/root/cloud-mail/mail-vue/src/layout/account/index.vue)

Changes:

- `refreshUserList()` now emits a local refresh signal only
- Sending mail no longer forces an extra `/my/loginUserInfo` request
- Adding an account no longer forces an extra `/my/loginUserInfo` request
- Relevant user state is updated locally where safe

Purpose:

- Reduce avoidable authenticated API calls
- Reduce avoidable KV reads from repeated session validation

## Remaining Unoptimized Areas

### 1. Every authenticated route still depends on KV session reads

Status:

- Not optimized yet

Impact:

- Any active backend usage still creates KV pressure
- Multiple browser tabs or operators multiply that pressure

### 2. Manual user actions still trigger protected API requests

Examples:

- `/account/list`
- `/email/list`
- `/allEmail/list`
- `/setting/query`
- `/analysis/echarts`

These are expected requests, but they still pass through KV-backed session validation.

### 3. No short-lived in-memory auth cache yet

Status:

- Not implemented

Potential value:

- Could reduce repeated KV reads for hot users over short intervals

## Recommended Next Steps If KV Alerts Continue

### Low-risk operational actions

- Keep `autoRefresh` at `30s` or `60s` instead of very small values
- Avoid keeping many admin tabs open at the same time
- Avoid running the same dashboard across multiple devices unless necessary

### Medium-risk engineering option

Implement a short TTL in-memory cache for authenticated session lookups in:

- [mail-worker/src/security/security.js](/root/cloud-mail/mail-worker/src/security/security.js)

Suggested shape:

- Cache key: `userId + token`
- TTL: about `30s`
- Fallback to KV on cache miss

Expected benefit:

- Lower repeated KV reads for bursty traffic from the same active user

Tradeoff:

- Logout / token invalidation may have a short propagation window on hot worker instances

### High-risk options not recommended for now

- Replacing KV-backed session validation with pure JWT stateless auth
- Reworking permission checks into a new auth model
- Redesigning session revocation semantics

## Deployment Safety Notes

The current deployment flow intentionally preserves existing production configuration:

- production deploy uses `wrangler.production.toml`
- production deploy uses `--keep-vars`
- existing `D1`, `KV`, `R2`, and environment variables are preserved

This was chosen to minimize risk to the running system and avoid configuration loss.

## Summary

Completed:

- reduced default polling frequency
- removed several redundant user info refresh requests

Not yet done:

- short-lived auth/session cache in backend
- broader reduction of authenticated request volume

If future KV alerts still appear, the next recommended change is a conservative short-TTL auth cache in the worker.
