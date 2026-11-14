# Veridata — AppDeploy intake hardening (review branch)

This folder stores the canonical product's proposed AppDeploy backend change. It is staged for review, not deployed. Existing CSV fulfillment remains in its preceding draft PR. No client data or credentials.

## Fixes
- Adds a stable client-provided UUID receipt for idempotent request retries. Same UUID + matching fields returns the original receipt; conflicting reuse returns HTTP 409.
- Preserves compatibility with the currently deployed client (no UUID).
- Saves the lead before attempting best-effort owner push. Push payload does not include personal information, and failed push does not invalidate stored receipts.
- Records pending/delivered alert status; owner-only GET /api/operator/leads returns at most 25 items. Owner-only POST /api/operator/subscribe-alerts adds topic membership.
- Privileged APIs require authenticated AppDeploy owner user ID matching encrypted app secret VERIDATA_OWNER_USER_ID; missing secret denies access.

## Verification
- AppDeploy stored-source snapshot: 1793980176493. Connected AppDeploy SDK 2.12 documentation consulted: database, notifications, api, secrets.
- Exact backend files in this branch matched locally tested Git blob SHA. 13/13 hermetic mock-SDK tests passed with Node 22.16; TypeScript --noEmit passed using local declaration shims. No live SDK, AppDeploy or GitHub CI execution has been claimed.
- Five portable unit regressions: node --experimental-strip-types --test tests/test_appdeploy_lead_core.mjs
- Frontend UUID change documented in appdeploy/FRONTEND_UUID_PATCH.txt but NOT applied to the production AppDeploy app.

## Nonproduction release preflight
1. Check actual generated AppDeploy SDK supports db.tx.add/update, consistent db.get and isAppDatabaseError; docs alone do not establish the deployed bundle revision.
2. Apply the frontend UUID patch, build an authenticated owner-only inbox UI, and request browser push permission only after an explicit owner click (notifications.subscribe()).
3. Set VERIDATA_OWNER_USER_ID through secure AppDeploy secret entry; never expose credentials or owner identity in frontend or Git.
4. Test synthetic owner/non-owner access, duplicate requests, write-unknown-outcome handling, notifications and operator follow-up in a staging app.
5. Verify retention, privacy/deletion procedure, inbound abuse/rate-limiting, quotas and a separate eligible live payment request route.

No merge, release, owner notification, real customer-data access, public content publishing, billing, or outbound outreach is included in this review branch.

GitHub skip-workflow docs: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs