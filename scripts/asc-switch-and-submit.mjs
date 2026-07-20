/**
 * Switch version 1.3 to build 30, then submit for review.
 * Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY
 */
import crypto from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privKey = process.env.ASC_PRIVATE_KEY;
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a'; // v1.3
const BUILD_30_ID = '3b82d0cc-189e-4b68-b144-923bfa9ce57e'; // build 30

if (!keyId || !issuerId || !privKey) { console.error('Missing ASC creds'); process.exit(1); }

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const hdr = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const pld = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const s = crypto.createSign('SHA256');
  s.update(hdr + '.' + pld);
  return hdr + '.' + pld + '.' + s.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}

async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + makeToken(), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const txt = await r.text();
  console.log(method, path.split('?')[0], '->', r.status);
  if (!r.ok) { console.error('  Error:', txt.slice(0, 600)); return { ok: false, status: r.status, body: txt }; }
  return { ok: true, status: r.status, data: txt ? JSON.parse(txt) : {} };
}

console.log('=== Switch build 30 + submit ===\n');

// Step 1: Attach build 30 to version 1.3
console.log('Attaching build 30 to version 1.3...');
const patch = await api('PATCH', `/v1/appStoreVersions/${VERSION_ID}/relationships/build`, {
  data: { type: 'builds', id: BUILD_30_ID },
});
if (!patch.ok && patch.status !== 204) {
  console.error('Failed to switch build. Aborting.');
  process.exit(1);
}
console.log('Build switched.\n');

// Step 2: Find open submissions and reuse/create one
const subs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=50`);
const openSubs = (subs.data?.data || []).filter(s =>
  s.attributes?.state === 'READY_FOR_REVIEW' && !s.attributes?.submittedDate
);
console.log(`Found ${openSubs.length} open unsubmitted submissions.\n`);

let submissionId = null;
for (const s of openSubs) {
  const items = await api('GET', `/v1/reviewSubmissions/${s.id}/items?limit=50`);
  const itemList = items.data?.data || [];
  const match = itemList.find(it => it.relationships?.appStoreVersion?.data?.id === VERSION_ID);
  if (match) {
    console.log(`Reusing submission ${s.id} (version already attached).`);
    submissionId = s.id;
    break;
  } else if (itemList.length === 0 && !submissionId) {
    console.log(`Attaching version to empty submission ${s.id}.`);
    const itemRes = await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: s.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
        },
      },
    });
    if (itemRes.ok) { submissionId = s.id; break; }
  }
}

if (!submissionId) {
  console.log('Creating new submission...');
  const created = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  if (!created.ok) { console.error('Failed to create submission.'); process.exit(1); }
  submissionId = created.data?.data?.id;
  await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } },
      },
    },
  });
}

// Step 3: Submit
console.log(`\nSubmitting ${submissionId}...`);
const submit = await api('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
  data: {
    type: 'reviewSubmissions',
    id: submissionId,
    attributes: { submitted: true },
  },
});

if (submit.ok) {
  console.log('\n✅ Submitted for review!');
} else {
  console.error('\n❌ Submit failed.');
  process.exit(1);
}
