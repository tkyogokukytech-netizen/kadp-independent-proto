let csrf='';
const $=id=>document.getElementById(id);
async function send(url,body={}) {
  $('error').textContent='';
  try { const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-KADP-Token':csrf},body:JSON.stringify(body)}); const data=await r.json(); if(!r.ok) throw Error(data.error); await refresh(); return true; }
  catch(e){$('error').textContent=e.message; await refresh(); return false;}
}
function paragraph(text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;return p;}

function renderReview(review){
  const box=$('review');box.replaceChildren();box.hidden=!review;if(!review)return;
  const heading=document.createElement('h3');heading.textContent='この画面だけで確認できます';box.append(heading);
  const tests=review.tests;box.append(paragraph(`TEST：${tests.pass?'成功':'失敗'} · ${tests.passed}/${tests.total} PASS`,'review-test'));
  const audit=review.independentAudit;
  if(audit){
    box.append(paragraph(`チャッピー監督席：${audit.passed?'独立監査 PASS':'確認が必要'}`,audit.passed?'review-test':'test-fail'));
    const auditDetail=document.createElement('details');const auditSummary=document.createElement('summary');auditSummary.textContent='独立監査の確認項目';auditDetail.append(auditSummary);
    for(const check of audit.checks||[])auditDetail.append(paragraph(`${check.pass?'✓':'×'} ${check.detail}`,check.pass?'test-pass':'test-fail'));
    box.append(auditDetail);
  }
  const testDetail=document.createElement('details');const testSummary=document.createElement('summary');testSummary.textContent='TEST結果を見る';testDetail.append(testSummary);
  for(const result of tests.results)testDetail.append(paragraph(`${result.pass?'✓':'×'} ${result.name}`,result.pass?'test-pass':'test-fail'));
  box.append(testDetail);
  for(const file of review.files){
    const detail=document.createElement('details');detail.className='review-file';
    const summary=document.createElement('summary');summary.textContent=`${file.kind} · ${file.path}`;
    const pre=document.createElement('pre');pre.className='diff';pre.textContent=file.diff||'差分はありません。';
    detail.append(summary,pre);box.append(detail);
  }
}
async function refresh(){
  try {
    const r=await fetch('/api/state');if(!r.ok)throw Error();const s=await r.json();csrf=s.csrf;
    $('status').textContent=s.label;$('message').textContent=s.message;$('activity').textContent=s.active?'進行中':'';
    $('run').disabled=s.active;$('session').disabled=s.active;$('connect').disabled=s.active||s.login.state==='WORKER_RUNNING';
    $('connection').textContent=s.login.message;$('connect-card').hidden=s.workerReady;
    $('login-link').hidden=!s.login.url;if(s.login.url)$('login-link').href=s.login.url;
    $('auth-box').hidden=!s.login.url;
    $('approval').hidden=!['WAITING_HUMAN','HOLD','ERROR'].includes(s.state);
    const reviewTask=[...s.tasks].reverse().find(t=>t.status==='WAITING_HUMAN'&&t.review);renderReview(reviewTask?.review);
    $('history').replaceChildren();
    for(const t of s.tasks.slice(-12)){
      const card=document.createElement('article');card.className='card result';card.append(paragraph(t.text||'安全確認が必要な作業','request'));
      const labels={COMPLETED:'完了',HOLD:'保留',STOPPED:'安全停止',WAITING_HUMAN:'確認待ち',READY:'順番待ち',ACCEPTED:'作業受付',RUNNING:'作業中',WORKER_RUNNING:'Worker処理中',TESTING:'TEST中',ERROR:'エラー'};
      card.append(paragraph(labels[t.status]||t.status,'badge'));card.append(paragraph(t.result||t.message||'順番を待っています。'));
      if(t.summary)card.append(paragraph('変更内容：'+t.summary));
      if(t.independentAudit)card.append(paragraph('チャッピー監督席：'+(t.independentAudit.passed?'独立監査PASS':'確認が必要'),'muted'));
      card.append(paragraph('TEST：'+(t.tests?.pass?'成功':t.attempts?.some(a=>a.tests&&!a.tests.pass)?'失敗 · 安定版へ反映していません':'未完了'),'muted'));
      if(t.commit){const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='詳細を見る';detail.append(summary,paragraph('変更ファイル：'+t.changes.join('、')),paragraph('Git：'+t.commit),paragraph('Worker：'+t.attempts.at(-1).worker.worker));card.append(detail);}
      $('history').append(card);
    }
    const ledger=await (await fetch('/api/ledger')).json();
    const list=$('ledger-list');list.replaceChildren();
    if(!ledger.entries.length) list.append(paragraph('まだ記録はありません。','muted'));
    for(const entry of ledger.entries.slice(0,12)){
      const card=document.createElement('article');card.className='ledger-entry';
      card.append(paragraph(entry.outcome||entry.status,'badge'),paragraph(entry.summary||entry.request||'記録された作業','request'));
      card.append(paragraph(`TEST：${entry.tests?`${entry.tests.passed}/${entry.tests.total} PASS`:'未実施'} · 監査：${entry.independentAudit?.passed?'PASS':'確認対象'}`,'muted'));
      if(entry.commit)card.append(paragraph('Git：'+entry.commit,'muted'));
      list.append(card);
    }
  }catch{$('error').textContent='KADPへ接続できません。画面を閉じず、起動状態を確認してください。';}
}
$('task-form').addEventListener('submit',async e=>{e.preventDefault();const text=$('task').value;const kind=/(?:^|\s)(?:自己開発|SELF_DEVELOPMENT_CHANGE)(?:\s|:|：|$)/i.test(text)?'SELF_DEVELOPMENT_CHANGE':'CHANGE';if(await send('/api/task',{text,kind}))$('task').value='';});
$('stop').onclick=()=>send('/api/stop');$('ok').onclick=()=>send('/api/decision',{ok:true});$('ng').onclick=()=>send('/api/decision',{ok:false});
$('connect').onclick=()=>send('/api/connect');$('session').onclick=()=>send('/api/session',{text:$('backlog').value});
$('send-code').onclick=async()=>{if(await send('/api/auth-code',{code:$('auth-code').value}))$('auth-code').value='';};
refresh();setInterval(refresh,1500);
