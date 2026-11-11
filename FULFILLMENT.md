# Veridata CSV fulfillment

The existing Hatchable processor has been brought into version control and corrected; it is not a second independent engine. `hatchable/lib/clean.js` is shared by the route and the local delivery command. Existing website pricing is unchanged.

## Run locally

Node 22+; no package install, paid APIs or network calls.

```sh
node --test tests/*.test.mjs
node scripts/fulfill.mjs samples/pilot.csv /tmp/veridata-pilot-unique
```

Accept UTF-8 CSV with a unique nonblank header, at most 10,000 rows and 5,000,000 characters. XLSX must be exported to CSV and the export reviewed first. Never claim native XLSX support. The public demo remains limited to 500 rows and 200,000 characters; oversize requests are rejected, never silently truncated.

Outputs: spreadsheet-safe `cleaned.csv`, full `report.json` with row lineage and changes, `receipt.json` with input checksum and reconciliation, and handover notes. A new output directory is mandatory. Input files and previous outputs are not overwritten. Keep real client files outside Git. JSON contains customer records and must stay private.

Normalization trims field edges and lowercases only email/email_address columns. Internal whitespace and phone text are preserved. Only exact whole-row matches after these rules are removed. Other records sharing email/phone remain. Reports label row numbers as logical CSV records including header; quoted multiline fields do not add record numbers. Missing and invalid values remain for review. No external validation, enrichment, or automated outreach.

CSV cells beginning with =, +, -, @, tab or newline are prefixed with an apostrophe for spreadsheet use; JSON retains cleaned values. Review and select the appropriate format before CRM import.

## Delivery acceptance

Confirm authorization, scope, retention, delivery recipient and price before processing. Review every exclusion and flagged field; reconcile input = retained + duplicate records; verify the input checksum remains unchanged. A technical pass does not confirm payment or customer acceptance.

## Hosted update

Source project: `proj_NMPrvwL9u0RO`, inspected version 12. Original api/clean.js hash: `8981a035d042c2de1c24be6b19161dd9cbaf89202047300677ce7a0267139eb5`.

Apply only `hatchable/api/clean.js` as `api/clean.js` and `hatchable/lib/clean.js` as `lib/clean.js` to the existing project. Recheck source hash for concurrent changes. Run platform validation and synthetic request tests before production release. These source files do not change project visibility, pricing, billing, auth, or AI behavior.

The connected Stripe account was sandbox-only on 11 November 2026. Do not mark any order paid based on this processor, a submitted form, or a sandbox payment.
