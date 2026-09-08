import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Engine } from './engine.mjs';
import { GeminiWorker } from './worker.mjs';
import { Hold, safePath } from './safety.mjs';

export function createServer(root, worker = new GeminiWorker(root)) {
  const engine = new Engine(root, worker); const csrf = crypto.randomBytes(24).toString('hex');
  const server = http.createServer(async (req, res) => {
    const expected = '127.0.0.1:' + server.address().port;
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(body)); };
    if (req.headers.host !== expected) return reply(403, {error:'ローカル画面からアクセスしてください。'});
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (req.method === 'GET' && ['/', '/ui.js','/style.css'].includes(req.url)) {
      const file = req.url==='/'?'index.html':req.url.slice(1);
      res.writeHead(200, {'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store'});
      return res.end(fs.readFileSync(safePath(root,'ui/'+file)));
    }
    if (req.method==='GET' && req.url==='/api/state') return reply(200,{...engine.view(),csrf});
    if (req.method!=='POST' || req.headers.origin !== 'http://'+expected || req.headers['x-kadp-token']!==csrf || req.headers['content-type']!=='application/json') return reply(403,{error:'画面を再読み込みしてください。'});
    try {
      let raw=''; for await(const chunk of req) { raw+=chunk; if(Buffer.byteLength(raw)>20000) throw new Hold('入力が長すぎます。'); }
      const body=JSON.parse(raw || '{}');
      if(req.url==='/api/task') { const task=engine.accept(body.text); return reply(202,{id:task.id}); }
      if(req.url==='/api/session') { await engine.startSession(body.text); return reply(202,{accepted:true}); }
      if(req.url==='/api/stop') { engine.stop(); return reply(200,{stopped:true}); }
      if(req.url==='/api/decision') { if(typeof body.ok!=='boolean') throw new Hold('確認内容が不正です。'); engine.decide(body.ok); return reply(200,{acknowledged:true}); }
      if(req.url==='/api/connect') { if(engine.active) throw new Hold('作業完了後に接続してください。'); void worker.connect(); return reply(202,{connecting:true}); }
      return reply(404,{error:'この操作はありません。'});
    } catch(e) { return reply(e instanceof Hold?409:400,{error:e instanceof Hold?e.message:'入力を確認してください。'}); }
  });
  return {server,engine,worker};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const {server}=createServer(root);
  server.on('error',()=>{ process.stderr.write('起動できません。同じ画面が既に開いていないか確認してください。\n'); process.exitCode=1; });
  server.listen(4317,'127.0.0.1',()=>process.stdout.write('KADP http://127.0.0.1:4317\n'));
}
