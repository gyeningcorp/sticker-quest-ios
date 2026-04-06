import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }

// Try the v2 submission endpoint  
const endpoints = [
  { path: '/v2/submissions', body: { data: { type: 'submissions', relationships: { items: { data: [{ type: 'appStoreVersions', id: VERSION_ID }] } } } } },
  { path: '/v1/submissions', body: { data: { type: 'submissions', relationships: { items: { data: [{ type: 'appStoreVersions', id: VERSION_ID }] } } } } },
];

for (const ep of endpoints) {
  console.log(`Trying ${ep.path}...`);
  const r = await fetch(`https://api.appstoreconnect.apple.com${ep.path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${makeJWT()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(ep.body)
  });
  const j = await r.json();
  if (j.data) {
    console.log('🎉 SUBMITTED!', JSON.stringify(j.data.attributes || j.data.id));
    process.exit(0);
  } else {
    console.log('❌', j.errors?.[0]?.detail || JSON.stringify(j));
  }
}

// Check current version state
const vr = await fetch(`https://api.appstoreconnect.apple.com/v1/appStoreVersions/${VERSION_ID}`, {
  headers: { 'Authorization': `Bearer ${makeJWT()}` }
});
const vj = await vr.json();
console.log('\nCurrent state:', vj.data?.attributes?.appVersionState);
