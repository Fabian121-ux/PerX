import "server-only";

import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createSign,
  randomBytes,
} from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";

type PushPayload = { title: string; body: string; url?: string; tag?: string };
type SubscriptionRecord = { id: string; endpoint: string; p256dh: string; auth: string };

const allowedPushHosts = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function encodeBase64Url(value: Buffer | Uint8Array) {
  return Buffer.from(value).toString("base64url");
}
function hmac(key: Buffer, value: Buffer) {
  return createHmac("sha256", key).update(value).digest();
}
function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  let previous = Buffer.alloc(0);
  let output = Buffer.alloc(0);
  for (let counter = 1; output.length < length; counter += 1) {
    previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    output = Buffer.concat([output, previous]);
  }
  return output.subarray(0, length);
}

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const publicBytes = decodeBase64Url(publicKey);
  const privateBytes = decodeBase64Url(privateKey);
  if (publicBytes.length !== 65 || privateBytes.length !== 32) return null;
  return {
    publicKey,
    privateKey,
    publicBytes,
    subject: process.env.VAPID_SUBJECT ?? "mailto:support@ptahx.com",
  };
}

export function getPushPublicKey() {
  return getVapidConfig()?.publicKey ?? null;
}

function createVapidToken(endpoint: string) {
  const config = getVapidConfig();
  if (!config) throw new Error("Web Push is not configured.");
  const url = new URL(endpoint);
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = encodeBase64Url(Buffer.from(JSON.stringify({
    aud: url.origin,
    exp: now + 12 * 60 * 60,
    sub: config.subject,
  })));
  const unsigned = `${header}.${claims}`;
  const key = createPrivateKey({
    format: "jwk",
    key: {
      crv: "P-256",
      d: encodeBase64Url(decodeBase64Url(config.privateKey)),
      kty: "EC",
      x: encodeBase64Url(config.publicBytes.subarray(1, 33)),
      y: encodeBase64Url(config.publicBytes.subarray(33, 65)),
    },
  });
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${encodeBase64Url(signer.sign({ key, dsaEncoding: "ieee-p1363" }))}`;
}

function encryptPayload(subscription: SubscriptionRecord, payload: PushPayload) {
  const uaPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) {
    throw new Error("Invalid push subscription keys.");
  }

  const ephemeral = createECDH("prime256v1");
  ephemeral.generateKeys();
  const serverPublic = ephemeral.getPublicKey();
  const sharedSecret = ephemeral.computeSecret(uaPublic);

  const authPrk = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    uaPublic,
    serverPublic,
  ]);
  const inputKey = hkdfExpand(authPrk, keyInfo, 32);
  const salt = randomBytes(16);
  const contentPrk = hmac(salt, inputKey);
  const cek = hkdfExpand(contentPrk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdfExpand(contentPrk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const plaintext = Buffer.concat([
    Buffer.from(JSON.stringify(payload), "utf8"),
    Buffer.from([2]),
  ]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublic.length]),
    serverPublic,
    ciphertext,
  ]);
}

export async function sendPushToSubscription(subscription: SubscriptionRecord, payload: PushPayload) {
  const url = new URL(subscription.endpoint);
  if (url.protocol !== "https:" || !allowedPushHosts.has(url.hostname)) {
    await getPrisma().pushSubscription.deleteMany({ where: { id: subscription.id } });
    return;
  }
  const body = encryptPayload(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${createVapidToken(subscription.endpoint)}, k=${getVapidConfig()!.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404 || response.status === 410) {
    await getPrisma().pushSubscription.deleteMany({ where: { id: subscription.id } });
  } else if (!response.ok) {
    throw new Error(`Push service returned ${response.status}.`);
  }
}

