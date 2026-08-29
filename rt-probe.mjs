import { readFileSync } from "node:fs";
const T = readFileSync("/tmp/rt-alice.token","utf8").trim();
const C = readFileSync("/tmp/rt-conv.id","utf8").trim();
const ac = new AbortController();
const t0 = performance.now();
setTimeout(()=>ac.abort(), 25000);
try {
  const res = await fetch(`http://127.0.0.1:3300/api/messages/events?conversationId=${C}`, {
    headers:{Cookie:`perx_session=${T}`,Accept:"text/event-stream"}, signal: ac.signal });
  console.log("status", res.status, "headers_ms", Math.round(performance.now()-t0));
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    const txt = dec.decode(chunk, {stream:true});
    for (const line of txt.split("\n")) {
      if (line.startsWith("event:") || line.startsWith("data:"))
        console.log(`[+${Math.round(performance.now()-t0)}ms] ${line.slice(0,100)}`);
    }
  }
} catch (e) { if (e.name!=="AbortError") console.log("ERR", e.message); }
console.log("closed at", Math.round(performance.now()-t0), "ms");
