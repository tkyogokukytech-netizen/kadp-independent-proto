let csrf='';
const $=id=>document.getElementById(id);
async function send(url,body={}) {
  $('error').textContent='';
  try { const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-KADP-Token':csrf},body:JSON.stringify(body)}); const data=await r.json(); if(!r.ok) throw Error(data.error); await refresh(); return true; }
  catch(e){$('error').textContent=e.message; return false;}
}
function paragraph(text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;return p;}
async function refresh(){
  try {
    const r=await fetch('/api/state');if(!r.ok)throw Error();const s=await r.json();csrf=s.csrf;
    $('status').textContent=s.label;$('message').textContent=s.message;$('activity').textContent=s.active?'進行中':'';
    $('run').disabled=s.active;$('session').disabled=s.active;$('connect').disabled=s.active||s.login.state==='WORKER_RUNNING';
    $('connection').textContent=s.login.message;$('connect-card').hidden=s.workerReady;
    $('login-link').hidden=!s.login.url;if(s.login.url)$('login-link').href=s.login.url;
    $('auth-box').hidden=!s.login.url;
    $('approval').hidden=!['WAITING_HUMAN','HOLD','ERROR'].includes(s.state);
    $('history').replaceChildren();
    for(const t of s.tasks.slice(-12)){
      const card=document.createElement('article');card.className='card result';card.append(paragraph(t.text||'安全確認が必要な作業','request'));
      const labels={COMPLETED:'完了',HOLD:'保留',STOPPED:'安全停止',WAITING_HUMAN:'確認待ち',READY:'順番待ち',ACCEPTED:'作業受付',RUNNING:'作業中',WORKER_RUNNING:'Worker処理中',TESTING:'TEST中',ERROR:'エラー'};
      card.append(paragraph(labels[t.status]||t.status,'badge'));card.append(paragraph(t.result||t.message||'順番を待っています。'));
      if(t.summary)card.append(paragraph('変更内容：'+t.summary));
      card.append(paragraph('TEST：'+(t.tests?.pass?'成功':t.attempts?.some(a=>a.tests&&!a.tests.pass)?'失敗 · 安定版へ反映していません':'未完了'),'muted'));
      if(t.commit){const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='詳細を見る';detail.append(summary,paragraph('変更ファイル：'+t.changes.join('、')),paragraph('Git：'+t.commit),paragraph('Worker：'+t.attempts.at(-1).worker.worker));card.append(detail);}
      $('history').append(card);
    }
  }catch{$('error').textContent='KADPへ接続できません。画面を閉じず、起動状態を確認してください。';}
}
$('task-form').addEventListener('submit',async e=>{e.preventDefault();if(await send('/api/task',{text:$('task').value}))$('task').value='';});
$('stop').onclick=()=>send('/api/stop');$('ok').onclick=()=>send('/api/decision',{ok:true});$('ng').onclick=()=>send('/api/decision',{ok:false});
$('connect').onclick=()=>send('/api/connect');$('session').onclick=()=>send('/api/session',{text:$('backlog').value});
$('send-code').onclick=async()=>{if(await send('/api/auth-code',{code:$('auth-code').value}))$('auth-code').value='';};
refresh();setInterval(refresh,1500);
