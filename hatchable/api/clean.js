import { cleanCsv } from '../lib/clean.js';
export const access = 'public';
export const methods = ['POST'];

export default async function(req, res) {
  try {
    return res.json(cleanCsv(req.body?.csv, { maxRows: 500, maxChars: 200000 }));
  } catch (err) {
    if (err instanceof RangeError || err instanceof TypeError) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
}
