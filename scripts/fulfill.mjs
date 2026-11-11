import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cleanCsv } from '../hatchable/lib/clean.js';

const [input, destination] = process.argv.slice(2);
if (!input || !destination) {
  console.error('Usage: node scripts/fulfill.mjs INPUT.csv NEW_OUTPUT_DIRECTORY'); process.exit(2);
}
try {
  const bytes = await readFile(input);
  const csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const report = cleanCsv(csv);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const out = resolve(destination);
  // Exclusive creation protects customer originals and previous deliveries.
  await mkdir(out);
  const encode = (v) => '"' + String(v).replaceAll('"', '""') + '"';
  const spreadsheetSafe = (v) => /^[=+@-]|^[\t\r\n]/.test(v) ? "'" + v : v;
  const lines = [report.headers, ...report.rows.map(r => report.headers.map(h => spreadsheetSafe(r[h])))];
  await writeFile(out + '/cleaned.csv', lines.map(r => r.map(encode).join(',')).join('\r\n') + '\r\n', { flag: 'wx' });
  await writeFile(out + '/report.json', JSON.stringify({ ...report, input_sha256: hash }, null, 2) + '\n', { flag: 'wx' });
  await writeFile(out + '/receipt.json', JSON.stringify({ input_sha256: hash, source_rows: report.source_rows,
    output_rows: report.output_rows, removed_duplicates: report.removed_duplicates,
    reconciled: report.source_rows === report.output_rows + report.removed_duplicates,
    generated_at: new Date().toISOString(), processing_version: 'veridata-csv-1',
    spreadsheet_escape: 'Risk-leading CSV cells prefixed with apostrophe; report.json preserves cleaned values.' }, null, 2) + '\n', { flag: 'wx' });
  await writeFile(out + '/README.txt',
    `Veridata review copy\nInput rows: ${report.source_rows}\nRetained rows: ${report.output_rows}\nExact normalized duplicates removed: ${report.removed_duplicates}\nIssues: ${report.issue_count}\n\nReview report.json before CRM import. CSV formula-risk cells have an apostrophe prefix; JSON preserves cleaned values. No phone/email reachability, fuzzy matching or enrichment was performed. Source remains unchanged. Partial directories after I/O failure are not complete deliveries.\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: out, source_rows: report.source_rows, output_rows: report.output_rows, input_sha256: hash }));
} catch (error) { console.error('Delivery failed: ' + error.message); process.exitCode = 2; }
