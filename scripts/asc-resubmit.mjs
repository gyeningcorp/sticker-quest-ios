/**
 * Sticker Quest — resubmit v1.1 to App Store Review.
 *
 * Idempotent flow:
 *   1. Find the target appStoreVersion (defaults to highest non-COMPLETE).
 *   2. Cancel any open empty reviewSubmissions (state=READY_FOR_REVIEW with
 *      no items), which would otherwise block creating a new one.
 *   3. If the version is already attached to a submission, reuse it;
 *      otherwise create a new reviewSubmission and attach the version
 *      as a reviewSubmissionItem.
 *   4. PATCH the submission with submitted=true.
 *
 * Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY
 * Optional env: VERSION_ID (overrides auto-detect)
 *               DRY_RUN=true (inspect what would happen; no writes)
 */

import crypto from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privKey = process.env.ASC_PRIVATE_KEY;
const VERSION_ID_OVERRIDE = process.env.VERSION_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';
const APP_ID = '6760586844';

if (!keyId || !issuerId || !privKey) {
  console.error('Missing ASC creds');
  process.exit(1);
}

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
    console.log(`[DRY_RUN] ${method} ${path.split('?')[0]}${body ? '\n  body=' + JSON.stringify(body) : ''}`);
    return { ok: true, data: {} };
  }
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + makeToken(), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const txt = await r.text();
  console.log(method, path.split('?')[0], '->', r.status);
  if (!r.ok) {
    console.error('  Error:', txt.slice(0, 600));
    return { ok: false, status: r.status, body: txt };
  }
  return { ok: true, status: r.status, data: txt ? JSON.parse(txt) : {} };
}

console.log('=== Sticker Quest resubmit ===\n');

// Step 1: pick target version
let versionId = VERSION_ID_OVERRIDE;
let versionAttrs = null;
if (!versionId) {
  const versions = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=20`);
  if (!versions.ok || !versions.data?.data?.length) {
    console.error('No app store versions found.');
    process.exit(1);
  }
  // Prefer PREPARE_FOR_SUBMISSION; fall back to REJECTED.
  const candidates = versions.data.data.filter(v =>
    ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'INVALID_BINARY'].includes(v.attributes?.appStoreState)
  );
  if (!candidates.length) {
    console.error('No editable version found. States:', versions.data.data.map(v => v.attributes?.appStoreState).join(', '));
    process.exit(1);
  }
  const target = candidates[0];
  versionId = target.id;
  versionAttrs = target.attributes;
}
console.log(`Target version: ${versionAttrs?.versionString || '?'}  state=${versionAttrs?.appStoreState || '?'}  id=${versionId}\n`);

// Step 2: list existing submissions and clean up empty ones
const subs = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=50`);
const openSubs = (subs.data?.data || []).filter(s =>
  s.attributes?.state === 'READY_FOR_REVIEW' && !s.attributes?.submittedDate
);
console.log(`Found ${openSubs.length} open submissions in READY_FOR_REVIEW (not yet submitted).\n`);

let reuseSubmissionId = null;
let firstEmptyId = null;
for (const s of openSubs) {
  const items = await api('GET', `/v1/reviewSubmissions/${s.id}/items?limit=50`);
  const itemList = items.data?.data || [];
  const matchingItem = itemList.find(it => it.relationships?.appStoreVersion?.data?.id === versionId);
  if (matchingItem) {
    console.log(`  Reusing submission ${s.id} (already has target version attached).`);
    reuseSubmissionId = s.id;
    break;
  } else if (itemList.length === 0) {
    if (!firstEmptyId) firstEmptyId = s.id;
    console.log(`  Empty submission ${s.id} (will attach version if no exact match found).`);
  } else {
    console.log(`  Skipping submission ${s.id} (has ${itemList.length} item(s) for a different version).`);
  }
}
// Empty submissions in READY_FOR_REVIEW aren't cancellable. Re-use one
// by attaching our version to it instead of creating a new submission.
if (!reuseSubmissionId && firstEmptyId) {
  console.log(`\nAttaching version to existing empty submission ${firstEmptyId}.`);
  const itemRes = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: firstEmptyId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
      },
    },
  });
  if (itemRes.ok) {
    reuseSubmissionId = firstEmptyId;
  } else {
    console.error('Failed to attach to existing submission; will try creating new one.');
  }
}

// Step 3: create + attach if no reusable submission
let submissionId = reuseSubmissionId;
if (!submissionId) {
  console.log('\nCreating new review submission.');
  const created = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  if (!created.ok) {
    console.error('Failed to create submission. Aborting.');
    process.exit(1);
  }
  submissionId = created.data?.data?.id;
  console.log(`  Created submission ${submissionId}.`);

  console.log('  Attaching version as reviewSubmissionItem.');
  const itemRes = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
      },
    },
  });
  if (!itemRes.ok) {
    console.error('Failed to attach version. Aborting before submit.');
    process.exit(1);
  }
}

// Step 4: submit
console.log(`\nSubmitting ${submissionId} for review.`);
const submit = await api('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
  data: {
    type: 'reviewSubmissions',
    id: submissionId,
    attributes: { submitted: true },
  },
});
if (submit.ok) {
  console.log('\n✅ Submitted for review.');
} else {
  console.error('\n❌ Submit failed.');
  process.exit(1);
}
