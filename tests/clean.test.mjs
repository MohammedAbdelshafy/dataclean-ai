import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../hatchable/api/clean.js';

async function run(csv) {
  const res = { code: 200, status(n) { this.code=n; return this; }, json(body) { this.body=body; return this; } };
  await handler({body:{csv}},res); return res;
}
test('quoted multiline and escaped fields are preserved', async()=>{
  const r=await run('name,notes\nAlice,"first\nsecond, ""quote"""');
  assert.equal(r.code,200); assert.equal(r.body.source_rows,1);
  assert.equal(r.body.rows[0].notes,'first\nsecond, "quote"');
});
test('shared contacts do not delete distinct records',async()=>{
  const r=await run('name,email,phone\nAlice,a@example.com,123\nBob,a@example.com,123');
  assert.equal(r.body.output_rows,2); assert.equal(r.body.removed_duplicates,0);
});
test('exact normalized duplicates have provenance',async()=>{
  const r=await run('name,email\n Alice ,A@example.com\nAlice,a@example.com');
  assert.equal(r.body.output_rows,1); assert.equal(r.body.issues[0].duplicate_of,2);
});
test('long or extension-bearing phones are never truncated',async()=>{
  const r=await run('name,phone\nAlice,+12345678901234567890 ext 5');
  assert.equal(r.body.rows[0].phone,'+12345678901234567890 ext 5');
});
for(const [name,csv] of Object.entries({unclosed:'a,b\n1,"x',ragged:'a,b\n1,2,3',collision:'First Name,First-Name\nx,y',empty_header:'a,\nx,y',bad_quote:'a,b\nx,ab"cd',after_quote:'a,b\nx,"y"z'})){
  test('rejects '+name,async()=>assert.equal((await run(csv)).code,400));
}
test('preview rejects rather than truncates over 500 records',async()=>{
  const r=await run('name\n'+Array.from({length:501},(_,i)=>'row'+i).join('\n'));
  assert.equal(r.code,400);
});
test('empty values and international headers survive',async()=>{
  const r=await run('اسم,email\nعلي,\nعلي,');
  assert.equal(r.code,200); assert.equal(r.body.rows[0]['اسم'],'علي');
});
test('deterministic output',async()=>{
  const csv='name,email\nAlice,a@example.com';
  assert.deepEqual((await run(csv)).body,(await run(csv)).body);
});
