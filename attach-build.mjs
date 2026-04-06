import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7';
const ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13';
const KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '986ae73b-e32a-47c9-b799-025f67f51552';

function makeJWT() {
  const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url');
  const m = `${h}.${p}`;
  const k = fs.readFileSync(KEY_PATH,'utf8');
  const s = createSign('SHA256'); s.update(m);
  return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}
async function asc(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${makeJWT()}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, opts);
  return r.json();
}

// 1. List builds for app
const builds = await asc(`/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5`);
console.log('=== RECENT BUILDS ===');
builds.data?.forEach(b => {
  console.log(`Build ${b.attributes.version} | ${b.attributes.processingState} | uploaded: ${b.attributes.uploadedDate} | ID: ${b.id}`);
});

// 2. Find latest VALID build
const validBuild = builds.data?.find(b => b.attributes.processingState === 'VALID');
if (!validBuild) {
  const processing = builds.data?.find(b => b.attributes.processingState === 'PROCESSING');
  if (processing) {
    console.log(`\n⏳ Build ${processing.attributes.version} is still PROCESSING. Wait a few minutes and try again.`);
  } else {
    console.log('\n❌ No valid builds found.');
  }
  process.exit(0);
}

console.log(`\n✅ Using build ${validBuild.attributes.version} (${validBuild.id})`);

// 3. Attach build to version
const attach = await asc(`/appStoreVersions/${VERSION_ID}/relationships/build`, 'PATCH', {
  data: { type: 'builds', id: validBuild.id }
});

if (attach.errors) {
  console.log('❌ Attach failed:', attach.errors[0]?.detail);
} else {
  console.log('✅ Build attached to version!');
}
