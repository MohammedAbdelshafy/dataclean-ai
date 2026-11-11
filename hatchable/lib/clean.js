// Pure processing shared by the existing Hatchable route and local fulfillment.
export function parseCsv(csv) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const field = () => { row.push(cell); cell = ''; closed = false; };
  const record = () => { field(); rows.push(row); row = []; };
  csv = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += c;
    } else if (c === ',') field();
    else if (c === '\n' || c === '\r') {
      record(); if (c === '\r' && csv[i + 1] === '\n') i++;
    } else if (c === '"') {
      if (cell || closed) throw new TypeError('csv_invalid_quote');
      quoted = true;
    } else {
      if (closed) throw new TypeError('csv_text_after_quote');
      cell += c;
    }
  }
  if (quoted) throw new TypeError('csv_unclosed_quote');
  if (cell || row.length || closed) record();
  return rows;
}

export function cleanCsv(csv, { maxRows = 10000, maxChars = 5000000 } = {}) {
  if (typeof csv !== 'string' || !csv || csv.length > maxChars)
    throw new TypeError('csv_required_or_too_large');
  const table = parseCsv(csv);
  if (table.length < 2) throw new TypeError('csv_needs_header_and_rows');
  const originals = table.shift();
  const headers = originals.map(h => h.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, ''));
  if (headers.some(h => !h || ['__proto__', 'constructor', 'prototype'].includes(h)) || new Set(headers).size !== headers.length)
    throw new TypeError('csv_empty_duplicate_or_reserved_header');
  if (table.length > maxRows) throw new RangeError('csv_row_limit_' + maxRows);
  if (table.some(r => r.length !== headers.length)) throw new TypeError('csv_row_width_mismatch');
  const seen = new Map(), rows = [], issues = [], changes = [], retained = [];
  table.forEach((values, index) => {
    const sourceRow = index + 2;
    const entries = headers.map((h, j) => {
      let v = values[j].trim();
      if (/^(email|email_address)$/.test(h)) v = v.toLowerCase();
      if (v !== values[j]) changes.push({ row: sourceRow, field: h, rule: /^(email|email_address)$/.test(h) ? 'trim_lowercase' : 'trim' });
      return [h, v];
    });
    const row = Object.fromEntries(entries);
    const key = JSON.stringify(entries.map(e => e[1]));
    // Only whole-row equality after documented normalization removes a row.
    if (seen.has(key)) { issues.push({ row: sourceRow, type: 'duplicate', duplicate_of: seen.get(key) }); return; }
    seen.set(key, sourceRow);
    for (const [h, v] of entries) {
      if (!v) issues.push({ row: sourceRow, field: h, type: 'missing_value' });
      if (/^(email|email_address)$/.test(h) && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        issues.push({ row: sourceRow, field: h, type: 'invalid_email' });
      if (/^(phone|mobile|phone_number)$/.test(h) && v && (!/^[+\d\s().-]+$/.test(v) || v.replace(/\D/g, '').length > 15))
        issues.push({ row: sourceRow, field: h, type: 'phone_review_preserved' });
      if (/^[=+@-]|^[\t\r\n]/.test(v)) issues.push({ row: sourceRow, field: h, type: 'spreadsheet_formula_risk' });
    }
    rows.push(row); retained.push(sourceRow);
  });
  return { ok: true, source_rows: table.length, output_rows: rows.length,
    removed_duplicates: table.length - rows.length, issue_count: issues.length,
    headers, header_mapping: originals.map((original, i) => ({ original, output: headers[i] })),
    rows, issues, changes, retained_source_rows: retained,
    note: 'Exact normalized whole-row duplicates only. Phone values preserved. Formatting and syntax checks do not verify contact reachability. All rows and issues returned.' };
}
