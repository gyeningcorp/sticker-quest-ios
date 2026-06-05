/**
 * Inspect a specific reviewSubmission — what versions/builds it contains
 * and the appStoreState of those versions. Read-only.
 *
 * Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, SUBMISSION_ID
 */

import crypto from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privKey = process.env.ASC_PRIVATE_KEY;
const SUBMISSION_ID = process.env.SUBMISSION_ID;

if (!keyId || !issuerId || !privKey || !SUBMISSION_ID) {
  console.error('Missing env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, SUBMISSION_ID');
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

const sub = await api(`/v1/reviewSubmissions/${SUBMISSION_ID}?include=items`);
console.log('Submission:', JSON.stringify(sub?.data?.attributes, null, 2));
console.log('\nItems:');
for (const item of sub?.included || []) {
  if (item.type === 'reviewSubmissionItems') {
    const versionId = item.relationships?.appStoreVersion?.data?.id;
    console.log(`  itemId=${item.id}  appStoreVersionId=${versionId || 'none'}  state=${item.attributes?.state}`);
    if (versionId) {
      const v = await api(`/v1/appStoreVersions/${versionId}?include=build`);
      const attrs = v?.data?.attributes;
      const build = v?.included?.find(i => i.type === 'builds');
      console.log(`    version=${attrs?.versionString}  state=${attrs?.appStoreState}  platform=${attrs?.platform}  build=${build?.attributes?.version || 'none'}`);
    }
  }
}
