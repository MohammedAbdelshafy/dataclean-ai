import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeadInput, chosenLeadId, sameSubmission } from '../appdeploy/backend/lead-core.ts';

const good = {
  name: '  Test  Buyer ',
  email: '  TEST@EXAMPLE.COM ',
  state: 'TX',
  company: 'Demo LLC',
  requestId: 'de305d54-75b4-431b-adb2-eb6b9e546014'
};

test('normalizes valid input and persists stable UUID', () => {
  const x = parseLeadInput(good);
  assert.equal(x.ok, true);
  if (!x.ok) return;
  assert.equal(x.data.email, 'test@example.com');
  assert.equal(x.data.name, 'Test  Buyer');
  assert.equal(chosenLeadId(x.data.requestId ?? ''), 'lead_de305d5475b4431badb2eb6b9e546014');
});
test('rejects malformed email, missing state, malformed receipt', () => {
  assert.equal(parseLeadInput({ ...good, email:'x' }).ok, false);
  assert.equal(parseLeadInput({ ...good, state:'' }).ok, false);
  assert.equal(parseLeadInput({ ...good, requestId:'../../bad' }).ok, false);
});
test('honeypot results in no record', () => {
  const x = parseLeadInput({ ...good, website:'bot.example' });
  assert.equal(x.ok, true);
  if (x.ok) assert.equal(x.honeypot, true);
});
test('distinct payload conflicts with existing receipt', () => {
  const x = parseLeadInput(good);
  assert.equal(x.ok, true);
  if (!x.ok) return;
  assert.equal(sameSubmission({...x.data}, x.data), true);
  assert.equal(sameSubmission({...x.data,email:'other@example.com'},x.data), false);
});
test('legacy requests without UUID remain valid', () => {
  const x = parseLeadInput({ ...good, requestId: undefined });
  assert.equal(x.ok, true);
  if (x.ok) assert.equal(x.data.requestId, null);
});
