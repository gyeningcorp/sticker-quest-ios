/**
 * Find which reviewSubmission currently owns a given appStoreVersion.
 * Walks ALL platforms (not just IOS), inspecting each submission's items.
 *
 * Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, VERSION_ID
 */

import crypto from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privKey = process.env.ASC_PRIVATE_KEY;
const VERSION_ID = process.env.VERSION_ID || '89cfe218-bbdd-47f2-892d-6c508483b39a';
const APP_ID = '6760586844';

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const hdr = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const pld = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const s = crypto.createSign('SHA256');
  s.update(hdr + '.' + pld);
  return hdr + '.' + pld + '.' + s.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}

async function api(path) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    headers: { Authorization: 'Bearer ' + makeToken() },
  });
  const txt = await r.text();
  if (!r.ok) {
    console.error('GET', path.split('?')[0], '->', r.status, txt.slice(0, 400));
    return null;
  }
  return JSON.parse(txt);
}

// Try every platform
const platforms = ['IOS', 'MAC_OS', 'TV_OS', 'VISION_OS'];
let foundOwner = null;
for (const plat of platforms) {
  const subs = await api(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=${plat}&limit=200&include=items`);
  if (!subs?.data?.length) continue;
  console.log(`\n[${plat}] ${subs.data.length} submissions`);
  for (const s of subs.data) {
    // Pull items directly with their appStoreVersion relationship to be sure.
    const itemRes = await api(`/v1/reviewSubmissions/${s.id}/items?limit=50&include=appStoreVersion`);
    const items = itemRes?.data || [];
    const versionsAttached = items
      .map(i => i.relationships?.appStoreVersion?.data?.id)
      .filter(Boolean);
    console.log(`  ${s.id}  state=${s.attributes?.state}  itemCount=${items.length}  versions=${versionsAttached.join(',') || 'none'}`);
    if (versionsAttached.includes(VERSION_ID)) {
      foundOwner = { submissionId: s.id, itemIds: items.map(i => i.id), state: s.attributes?.state, platform: plat };
    }
  }
}

console.log('\n=== Result ===');
if (foundOwner) {
  console.log(`Version ${VERSION_ID} is attached to submission ${foundOwner.submissionId}`);
  console.log(`  state=${foundOwner.state}  platform=${foundOwner.platform}`);
} else {
  console.log(`Version ${VERSION_ID} is not attached to any submission. (But the API thinks it is.)`);
}
