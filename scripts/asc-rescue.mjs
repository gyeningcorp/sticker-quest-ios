/**
 * Sticker Quest — rescue orphaned reviewSubmissionItems and resubmit.
 *
 * The Apple API treats an appStoreVersion as "already in another
 * submission" if any reviewSubmissionItem (even in COMPLETE or
 * UNRESOLVED_ISSUES submissions) still points to it. This script
 * walks every submission, deletes items pointing at the target
 * version, then runs the resubmit flow.
 *
 * Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY
 * Optional env: VERSION_ID (defaults to v1.1 UUID)
 *               DRY_RUN=true (inspect; no writes)
 */

import crypto from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privKey = process.env.ASC_PRIVATE_KEY;
const VERSION_ID = process.env.VERSION_ID || '89cfe218-bbdd-47f2-892d-6c508483b39a';
const DRY_RUN = process.env.DRY_RUN === 'true';
const APP_ID = '6760586844';

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const hdr = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const pld = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const s = crypto.createSign('SHA256');
  s.update(hdr + '.' + pld);
  return hdr + '.' + pld + '.' + s.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}

async function api(method, path, body) {
  if (DRY_RUN && method !== 'GET') {
    console.log(`[DRY_RUN] ${method} ${path.split('?')[0]}`);
    return { ok: true, data: { data: { id: 'dry-run-id' } } };
  }
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + makeToken(), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const txt = await r.text();
  console.log(method, path.split('?')[0], '->', r.status);
  if (!r.ok) {
    console.error('  Error:', txt.slice(0, 500));
    return { ok: false, status: r.status, body: txt };
  }
  return { ok: true, status: r.status, data: txt ? JSON.parse(txt) : {} };
}

console.log(`=== Rescue + resubmit  version=${VERSION_ID} ===\n`);

// Step 1: find all items pointing at the target version across every platform
const platforms = ['IOS', 'MAC_OS', 'TV_OS', 'VISION_OS'];
const orphanItems = [];
for (const plat of platforms) {
  const subs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=${plat}&limit=200`);
  if (!subs.ok) continue;
  for (const s of (subs.data?.data || [])) {
    const items = await api('GET', `/v1/reviewSubmissions/${s.id}/items?limit=50&include=appStoreVersion`);
    for (const item of items.data?.data || []) {
      if (item.relationships?.appStoreVersion?.data?.id === VERSION_ID) {
        orphanItems.push({ itemId: item.id, submissionId: s.id, state: s.attributes?.state, platform: plat });
      }
    }
  }
}

if (!orphanItems.length) {
  console.log('No orphan items found — version is clean to submit.\n');
} else {
  console.log(`\nFound ${orphanItems.length} orphan items:`);
  for (const o of orphanItems) {
    console.log(`  itemId=${o.itemId}  submissionId=${o.submissionId}  state=${o.state}  platform=${o.platform}`);
  }

  console.log('\nDeleting orphan items...');
  for (const o of orphanItems) {
    await api('DELETE', `/v1/reviewSubmissionItems/${o.itemId}`);
  }
}

// Step 2: pick an empty IOS submission to reuse, or create new
const iosSubs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=200`);
let targetSubmissionId = null;
for (const s of (iosSubs.data?.data || [])) {
  if (s.attributes?.state !== 'READY_FOR_REVIEW' || s.attributes?.submittedDate) continue;
  const items = await api('GET', `/v1/reviewSubmissions/${s.id}/items?limit=50`);
  if ((items.data?.data || []).length === 0) {
    targetSubmissionId = s.id;
    console.log(`\nReusing empty submission ${targetSubmissionId}.`);
    break;
  }
}

if (!targetSubmissionId) {
  console.log('\nCreating fresh submission.');
  const created = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  if (!created.ok) {
    console.error('Failed to create submission.');
    process.exit(1);
  }
  targetSubmissionId = created.data?.data?.id;
}

// Step 3: attach version
console.log(`\nAttaching version ${VERSION_ID} to ${targetSubmissionId}.`);
const itemRes = await api('POST', '/v1/reviewSubmissionItems', {
  data: {
    type: 'reviewSubmissionItems',
    relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: targetSubmissionId } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
    },
  },
});
if (!itemRes.ok) {
  console.error('Failed to attach.');
  process.exit(1);
}

// Step 4: submit
console.log(`\nSubmitting ${targetSubmissionId}.`);
const submit = await api('PATCH', `/v1/reviewSubmissions/${targetSubmissionId}`, {
  data: {
    type: 'reviewSubmissions',
    id: targetSubmissionId,
    attributes: { submitted: true },
  },
});

if (submit.ok) {
  console.log('\nSubmitted for review.');
} else {
  console.error('\nSubmit failed.');
  process.exit(1);
}
