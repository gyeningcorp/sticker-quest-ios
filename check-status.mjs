import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path) { const r = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`,{headers:{'Authorization':`Bearer ${makeJWT()}`}}); return r.json(); }
const v = await asc(`/appStoreVersions/${VERSION_ID}`);
console.log(`Sticker Quest v${v.data?.attributes?.versionString}: ${v.data?.attributes?.appStoreState}`);
const subs = await asc(`/reviewSubmissions?filter[app]=${APP_ID}`);
for (const s of subs.data||[]) console.log(`  Submission ${s.id}: ${s.attributes?.state}`);
