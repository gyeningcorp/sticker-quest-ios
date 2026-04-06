import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }

// Delete the macOS PREPARE_FOR_SUBMISSION version
const MACOS_VERSION_ID = '986ae73b-e32a-47c9-b799-025f67f51552';
console.log('Deleting macOS v1.0 PREPARE_FOR_SUBMISSION...');
const r = await fetch(`https://api.appstoreconnect.apple.com/v1/appStoreVersions/${MACOS_VERSION_ID}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${makeJWT()}` }
});
console.log('Status:', r.status, r.status === 204 ? '✅ Deleted!' : '❌ Failed');
if (r.status !== 204) console.log(await r.text());
