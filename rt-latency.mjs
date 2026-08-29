// Measures Postgres commit -> SSE client receipt on the healthy Realtime path.
// LOCAL integration numbers only.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
const DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const T=readFileSync("/tmp/rt-alice.token","utf8").trim();
const C=readFileSync("/tmp/rt-conv.id","utf8").trim();
const pool=new pg.Pool({connectionString:DB,ssl:false});
const alice=(await pool.query(`SELECT id FROM "User" WHERE email='alice-test@perx.test'`)).rows[0].id;
const ac=new AbortController();
const res=await fetch(`http://127.0.0.1:3300/api/messages/events?conversationId=${C}`,
  {headers:{Cookie:`perx_session=${T}`,Accept:"text/event-stream"},signal:ac.signal});
if(res.status!==200){console.log("SSE status",res.status);process.exit(1);}
const pending=new Map(); const samples=[];
(async()=>{ const dec=new TextDecoder();
  try{ for await (const ch of res.body){ const txt=dec.decode(ch,{stream:true});
    for(const line of txt.split("\n")){ if(!line.startsWith("data:"))continue;
      for(const [probe,t] of pending){ if(line.includes(probe)){ samples.push(performance.now()-t); pending.delete(probe);} }
    }}}catch{}
})();
await new Promise(r=>setTimeout(r,4000)); // let subscription settle
for(let i=0;i<8;i++){
  const probe=`rt-probe-${crypto.randomUUID()}`;
  const id=`c${crypto.randomBytes(12).toString("hex")}`;
  const t=performance.now(); pending.set(probe,t);
  await pool.query(`INSERT INTO "Message" (id,"conversationId","senderId",body,"createdAt") VALUES ($1,$2,$3,$4,NOW())`,
    [id,C,alice,probe]);
  await new Promise(r=>setTimeout(r,2500));
  await pool.query(`DELETE FROM "Message" WHERE id=$1`,[id]);
}
ac.abort();
const s=samples.map(Math.round).sort((a,b)=>a-b);
const pct=(p)=>s.length?s[Math.min(s.length-1,Math.ceil(p/100*s.length)-1)]:null;
console.log(JSON.stringify({samples:s,n:s.length,min:s[0]??null,median:pct(50),p90:pct(90),max:s[s.length-1]??null},null,2));
await pool.end();
