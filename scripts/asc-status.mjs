/**
 * Sticker Quest — ASC state inspection.
 *
 * Prints every appStoreVersion for the app, latest builds, and any open
 * reviewSubmissions. Read-only — never mutates ASC. Use the output to
 * decide what to do next (attach build, submit for review, etc).
 *
 * Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY
 */

import crypto from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const privKey = process.env.ASC_PRIVATE_KEY;
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
  const sig = s.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return hdr + '.' + pld + '.' + sig;
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

console.log('=== Sticker Quest ASC status ===\n');

const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=20&include=build`);
if (versions?.data?.length) {
  console.log('--- App Store Versions ---');
  for (const v of versions.data) {
    const buildRelId = v.relationships?.build?.data?.id;
    const buildRec = buildRelId ? versions.included?.find(i => i.type === 'builds' && i.id === buildRelId) : null;
    const buildLabel = buildRec ? `build ${buildRec.attributes?.version}` : '(no build attached)';
    console.log(`  ${v.attributes?.versionString}  ${v.attributes?.appStoreState}  platform=${v.attributes?.platform}  ${buildLabel}  id=${v.id}`);
  }
} else {
  console.log('No app store versions found.');
}

const builds = await api(`/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=10&include=preReleaseVersion`);
if (builds?.data?.length) {
  console.log('\n--- Recent Builds (latest first) ---');
  for (const b of builds.data) {
    const pv = b.relationships?.preReleaseVersion?.data?.id;
    const pvRec = pv ? builds.included?.find(i => i.type === 'preReleaseVersions' && i.id === pv) : null;
    const pvLabel = pvRec ? pvRec.attributes?.version : '?';
    console.log(`  ${pvLabel} (${b.attributes?.version})  state=${b.attributes?.processingState}  expired=${b.attributes?.expired}  uploaded=${b.attributes?.uploadedDate}  id=${b.id}`);
  }
}

const subs = await api(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=20`);
if (subs?.data?.length) {
  console.log('\n--- Review Submissions ---');
  for (const s of subs.data) {
    console.log(`  state=${s.attributes?.state}  submitted=${s.attributes?.submittedDate || 'no'}  id=${s.id}`);
  }
} else {
  console.log('\nNo review submissions found.');
}

console.log('\nDone.');
