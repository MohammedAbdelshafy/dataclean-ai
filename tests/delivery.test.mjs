import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanCsv } from '../hatchable/lib/clean.js';
const run=(input,out)=>spawnSync(process.execPath,['scripts/fulfill.mjs',input,out],{encoding:'utf8'});
test('full delivery preserves input, escapes CSV, reconciles and refuses overwrite',async()=>{
 const root=await mkdtemp(join(tmpdir(),'veridata-'));
 try {
  const input=join(root,'input.csv'),out=join(root,'delivery');
  const data='name,email\n=SUM(1),x@example.com\n=SUM(1),x@example.com';
  await writeFile(input,data);
  assert.equal(run(input,out).status,0);
  assert.equal(await readFile(input,'utf8'),data);
  const receipt=JSON.parse(await readFile(join(out,'receipt.json'),'utf8'));
  assert.equal(receipt.reconciled,true); assert.equal(receipt.removed_duplicates,1);
  assert.match(await readFile(join(out,'cleaned.csv'),'utf8'),/'=SUM/);
  assert.equal(run(input,out).status,2);
  assert.equal(await readFile(input,'utf8'),data);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('10,000-row delivery returns every row; 10,001 rejected',()=>{
 const csv='name,email\n'+Array.from({length:10000},(_,i)=>`Person ${i},p${i}@example.com`).join('\n');
 assert.equal(cleanCsv(csv).rows.length,10000);
 assert.throws(()=>cleanCsv(csv+'\nExtra,extra@example.com'),/row_limit/);
});
test('rejected CSV does not create a delivery directory',async()=>{
 const root=await mkdtemp(join(tmpdir(),'veridata-'));
 try {const input=join(root,'input.csv');await writeFile(input,'a,b\n1,2,3');
 assert.equal(run(input,join(root,'delivery')).status,2);
 await assert.rejects(readFile(join(root,'delivery','receipt.json')));
 }finally {await rm(root,{recursive:true,force:true});}
});
