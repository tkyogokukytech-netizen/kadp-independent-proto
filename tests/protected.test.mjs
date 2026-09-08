import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectTask, safePath, validateCandidate, acquireLock, privateText } from '../core/safety.mjs';
import { invoke } from '../core/sandbox.mjs';
import { validateApp } from '../core/validation.mjs';
import { Engine } from '../core/engine.mjs';
import { git } from '../core/git.mjs';
import { createServer } from '../core/server.mjs';
import { extractOAuthUrl, parseCliResponse } from '../core/antigravity.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture() {
  const root=path.join(ROOT,'.runtime','tests',crypto.randomUUID());fs.mkdirSync(root,{recursive:true});
  for(const dir of ['app','cases','ui'])fs.cpSync(path.join(ROOT,dir),path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'.gitignore'),'.runtime/\n.private/\n');
  git(root,['init','-b','main']);git(root,['add','.']);git(root,['commit','-m','test fixture baseline']);return root;
}
const proposal=content=>({candidate:{summary:'テストダブルによる表示変更',files:[{path:'app/result.js',content}]},evidence:{worker:'TEST_DOUBLE_NOT_REAL_AI',promptHash:'fixture',responseHash:'fixture'}});
const good="function formatResult(r){return r.ok ? '作業が完了しました。処理時間：'+r.durationMs+'ms' : '作業を保留しました。';}";
function fake(content=good) {return {ready:true,login:{state:'IDLE',message:'TEST ONLY'},async propose(){return proposal(content);},async connect(){}};}

test('official Antigravity OAuth URL survives PTY wrapping without reconstruction',()=>{
  const official = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=official-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A4317%2Foauth&scope=openid%20email&state=official-state&code_challenge=official-challenge&code_challenge_method=S256';
  const wrapped = 'Authentication required. Open:\r\n' + official.slice(0, 118) + '\r\n' + official.slice(118) + '\r\nWaiting for authentication';
  assert.equal(extractOAuthUrl(wrapped), official);
  assert.equal(extractOAuthUrl('https://accounts.google.com/o/oauth2/v2/auth?response_type=code\r\nWaiting for authentication'), 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code');
  assert.equal(extractOAuthUrl('Authentication required; no URL'), null);
});
test('CLI JSON response tolerates PTY terminal title suffix',()=>{
  const parsed = parseCliResponse('{"status":"SUCCESS","response":"READY\\n","to\r\ntal_tokens":1}\u001b]0;agy.exe\u0007');
  assert.equal(parsed.status, 'SUCCESS');
  assert.equal(parsed.response, 'READY\n');
});

test('normal safe Japanese task',()=>assert.equal(inspectTask('実行結果に処理時間を表示して'),'実行結果に処理時間を表示して'));
test('dangerous task and private data fail closed',()=>{
  for(const text of ['PRODを変更','Money Forwardを変更','メールを送信','購入して','予約して','契約して','権限を変更','Safety Kernelを変更'])assert.throws(()=>inspectTask(text));
  assert(privateText('someone@example.invalid'));assert.throws(()=>inspectTask('someone@example.invalid を表示して'));
});
test('path traversal, drive, ADS, UNC, reserved names refused',()=>{
  for(const p of ['../README.md','C:/out.js','/tmp/a','app/../x','app/a.js:stream','app\\a.js','//server/a','app/CON.js','app/a.js.','app/%2e%2e/x'])assert.throws(()=>safePath(ROOT,p));
});
test('protected kernel, tests and non-allowlisted files refused',()=>{
  for(const p of ['core/safety.mjs','tests/protected.test.mjs','CONSTITUTION.md','ui/ui.js','package.json','.git/config','other/a.js'])assert.throws(()=>validateCandidate(ROOT,{summary:'x',files:[{path:p,content:'x'}]}));
  assert.throws(()=>validateCandidate(ROOT,{summary:'x',files:[{path:'cases/baseline.json',content:'[]'}]},['cases/baseline.json']));
});
test('junction escape refused',()=>{
  const root=fixture();fs.symlinkSync(ROOT,path.join(root,'app','escape'),'junction');assert.throws(()=>safePath(root,'app/escape/README.md'));
});
test('hard link refused',()=>{const root=fixture();fs.linkSync(path.join(root,'app/result.js'),path.join(root,'app/link.js'));assert.throws(()=>safePath(root,'app/link.js'));});
test('candidate dangerous APIs, duplicate paths and malformed tests refused',()=>{
  assert.throws(()=>validateCandidate(ROOT,{summary:'x',files:[{path:'app/x.js',content:'fetch("x")'}]}));
  assert.throws(()=>validateCandidate(ROOT,{summary:'x',files:[{path:'app/x.js',content:''},{path:'app/x.js',content:''}]}));
  assert.throws(()=>validateCandidate(ROOT,{summary:'x',files:[{path:'cases/x.json',content:'[{"fn":"exec"}]'}]}));
});
test('exclusive lock and stale lock never auto removed',()=>{const root=fixture();const release=acquireLock(root);assert.throws(()=>acquireLock(root));release();const second=acquireLock(root);second();fs.writeFileSync(path.join(root,'.runtime/task.lock'),'{"pid":0}');assert.throws(()=>acquireLock(root));});
test('QuickJS has no host access and terminates infinite loops',async()=>{
  const root=fixture();fs.writeFileSync(path.join(root,'app/result.js'),"function formatResult(){return [typeof process,typeof require,typeof fetch,typeof std,typeof os].join(',');}");
  assert.equal(await invoke(root,'formatResult',{}),'undefined,undefined,undefined,undefined,undefined');
  fs.writeFileSync(path.join(root,'app/result.js'),'function formatResult(){while(true){}}');
  const started=Date.now();await assert.rejects(()=>invoke(root,'formatResult',{}));assert(Date.now()-started<2000);
});
test('acceptance test fails baseline duration task',async()=>assert.equal((await validateApp(ROOT,'処理時間を表示して')).pass,false));
test('successful isolated candidate test and Git path (TEST DOUBLE)',async()=>{
  const root=fixture();const engine=new Engine(root,fake());const t=engine.accept('実行結果に処理時間を表示して');await engine.running;
  assert.equal(t.status,'COMPLETED');assert.equal(t.tests.pass,true);assert.equal(git(root,['rev-parse','HEAD']),t.commit);
  assert(fs.existsSync(path.join(root,'evidence',t.id+'-1.json')));assert.equal(git(root,['status','--porcelain']),'');
});
test('failed TEST is never promoted; retry is bounded',async()=>{
  const root=fixture();const base=git(root,['rev-parse','HEAD']);let calls=0;const worker=fake("function formatResult(){return '間違い';}");const original=worker.propose;worker.propose=async()=>{calls++;return original();};
  const engine=new Engine(root,worker);const t=engine.accept('表示を改善して');await engine.running;
  assert.equal(t.status,'HOLD');assert.equal(calls,2);assert.equal(git(root,['rev-parse','HEAD']),base);assert.equal(t.commit,undefined);
});
test('STOP cancels worker and rejects concurrent execution',async()=>{
  const root=fixture();const worker=fake();worker.propose=async(_,signal)=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});});
  const engine=new Engine(root,worker);const t=engine.accept('表示を改善して');assert.throws(()=>engine.accept('別の改善をして'));engine.stop();await engine.running;assert.equal(t.status,'STOPPED');assert.equal(t.commit,undefined);
});
test('protected request OK acknowledgement never bypasses safety',async()=>{
  const root=fixture();let calls=0;const worker=fake();worker.propose=async()=>{calls++;return proposal(good);};const engine=new Engine(root,worker);
  const t=engine.accept('Safety Kernelを変更して');assert.equal(t.status,'WAITING_HUMAN');engine.decide(true);assert.equal(calls,0);assert.equal(t.status,'WAITING_HUMAN');
});
test('provider failure is surfaced without raw URLs or secrets',()=>{
  const raw='Error authenticating: IneligibleTierError: This client is no longer supported https://antigravity.google token=AIza'+'A'.repeat(30);
  const safe=raw.replace(/https?:\/\/[^\s]+/g,'[リンク]').replace(/token=\S+/g,'token=[伏字]');
  assert(safe.includes('IneligibleTierError'));assert(!safe.includes('https://'));assert(!safe.includes('AIza'+'A'.repeat(30)));
});
test('Git operations scope safe.directory to the target repository',()=>{
  const root=fixture();
  assert.equal(git(root,['rev-parse','--show-toplevel']).replaceAll('\\','/').toLowerCase(),root.replaceAll('\\','/').toLowerCase());
});
test('GUI HTTP accepts task and returns actual result; CSRF rejects foreign origin (TEST DOUBLE)',async()=>{
  const root=fixture();const {server,engine}=createServer(root,fake());await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const html=await(await fetch(base)).text();for(const label of ['実行する','STOP','OK','NG','KADPに頼む'])assert(html.includes(label));
    const state=await(await fetch(base+'/api/state')).json();const headers={'Content-Type':'application/json','X-KADP-Token':state.csrf,Origin:base};
    assert.equal((await fetch(base+'/api/task',{method:'POST',headers:{...headers,Origin:'http://evil.invalid'},body:'{"text":"表示を改善して"}'})).status,403);
    assert.equal((await fetch(base+'/api/task',{method:'POST',headers,body:JSON.stringify({text:'実行結果に処理時間を表示して'})})).status,202);
    await engine.running;const result=await(await fetch(base+'/api/state')).json();assert.equal(result.tasks[0].status,'COMPLETED');assert(result.tasks[0].result.includes('ms'));assert(result.tasks[0].commit);
  }finally{await new Promise(r=>server.close(r));}
});
