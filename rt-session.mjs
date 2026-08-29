import crypto from "node:crypto";
import pg from "pg";
const pool = new pg.Pool({ connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres", ssl: false });
const u = await pool.query(`SELECT id FROM "User" WHERE email=$1`, [process.argv[2]]);
const token = crypto.randomBytes(32).toString("base64url");
await pool.query(`INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt") VALUES ($1,$2,$3,$4,NOW(),NOW())`,
 [`sess_${crypto.randomUUID()}`, crypto.createHash("sha256").update(token).digest("hex"), u.rows[0].id, new Date(Date.now()+7200e3)]);
console.log(token); await pool.end();
