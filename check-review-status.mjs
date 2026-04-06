import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
function makeJWT() {
  const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url');
  const m = `${h}.${p}`;
  const k = fs.readFileSync(KEY_PATH,'utf8');
  const s = createSign('SHA256'); s.update(m);
  return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}
async function asc(p) { const r = await fetch(`https://api.appstoreconnect.apple.com/v1${p}`,{headers:{'Authorization':`Bearer ${makeJWT()}`}}); return r.json(); }
async function run() {
  const subs = await asc(`/reviewSubmissions?filter[app]=${APP_ID}&limit=5`);
  console.log('=== Sticker Quest Review Submissions ===');
  for (const s of (subs.data||[])) {
    console.log(`${s.id} — state: ${s.attributes?.state} — platform: ${s.attributes?.platform}`);
  }
  // Also check versions
  const vers = await asc(`/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS`);
  console.log('\n=== iOS Versions ===');
  for (const v of (vers.data||[])) {
    console.log(`v${v.attributes?.versionString} — ${v.attributes?.appStoreState} (${v.id})`);
  }
}
run();
