// Exercises /app/trader across every account/application state.
import crypto from "node:crypto";
import pg from "pg";
const DB = process.env.TEST_DATABASE_URL;
const BASE = "http://127.0.0.1:3200";
const pool = new pg.Pool({ connectionString: DB, ssl: false });
const carol = (await pool.query(`SELECT id FROM "User" WHERE email='carol-test@perx.test'`)).rows[0].id;
const alice = (await pool.query(`SELECT id FROM "User" WHERE email='alice-test@perx.test'`)).rows[0].id;
async function session(userId){
  const t=crypto.randomBytes(32).toString("base64url");
  await pool.query(`INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt") VALUES ($1,$2,$3,$4,NOW(),NOW())`,
   [`sess_${crypto.randomUUID()}`,crypto.createHash("sha256").update(t).digest("hex"),userId,new Date(Date.now()+3600e3)]);
  return t;
}
const carolTok = await session(carol), aliceTok = await session(alice);
async function hit(tok,label){
  const r=await fetch(`${BASE}/app/trader`,{headers:{Cookie:`perx_session=${tok}`},redirect:"manual"});
  const body=await r.text();
  const bad = r.status>=500 || /Workspace Unavailable|temporary connection issue/.test(body);
  console.log(`${String(r.status).padEnd(4)} ${bad?"BAD ":"ok  "} ${label}`);
  return r.status;
}
const setState = async (status, extra={}) => {
  await pool.query(`DELETE FROM "TraderApplication" WHERE "userId"=$1`,[carol]);
  if(!status) return;
  await pool.query(
   `INSERT INTO "TraderApplication" (id,"userId",headline,"tradeCategory",experience,"applicantKind",status,"submittedAt","reviewerNote","createdAt","updatedAt")
    VALUES ($1,$2,$3,$4,$5,'INDIVIDUAL'::"TraderApplicantKind",$6::"TraderApplicationStatus",$7,$8,NOW(),NOW())`,
   [`ta_${crypto.randomUUID()}`,carol,extra.headline??"Selling handmade goods",extra.cat??"services",
    extra.experience??"Five years selling handmade goods locally.",status,
    extra.submittedAt===null?null:new Date(), extra.note??null]);
};
console.log("=== /app/trader across account states ===");
await hit(aliceTok, "TRADER (has opportunity:create)");
await setState(null);              await hit(carolTok, "non-trader, NO application");
await setState("DRAFT",{submittedAt:null}); await hit(carolTok, "DRAFT");
await setState("PENDING_REVIEW");  await hit(carolTok, "PENDING_REVIEW");
await setState("NEEDS_CHANGES",{note:"More detail please"}); await hit(carolTok, "NEEDS_CHANGES");
await setState("APPROVED");        await hit(carolTok, "APPROVED (role not yet granted)");
await setState("REJECTED",{note:"Not eligible"}); await hit(carolTok, "REJECTED");
await setState("SUSPENDED");       await hit(carolTok, "SUSPENDED");
await setState("PENDING_REVIEW",{submittedAt:null}); await hit(carolTok, "PENDING_REVIEW w/ NULL submittedAt (legacy)");
await setState("REJECTED",{note:null}); await hit(carolTok, "REJECTED w/ NULL reviewerNote");
await setState("NEEDS_CHANGES",{note:null}); await hit(carolTok, "NEEDS_CHANGES w/ NULL reviewerNote");
await setState(null);
await pool.query(`DELETE FROM "Session" WHERE "userId" IN ($1,$2)`,[carol,alice]);
await pool.end();
