import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path) { return (await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {headers:{'Authorization':`Bearer ${makeJWT()}`}})).json(); }

const v = await asc('/apps/6760586844/appStoreVersions?limit=5');
console.log('=== VERSIONS ===');
v.data?.forEach(d => console.log(`${d.id} | v${d.attributes.versionString} | platform: ${d.attributes.platform} | state: ${d.attributes.appVersionState}`));

const b = await asc('/builds?filter[app]=6760586844&sort=-uploadedDate&limit=3&fields[builds]=version,platform,processingState');
console.log('\n=== BUILDS ===');
b.data?.forEach(d => console.log(`Build ${d.attributes.version} | platform: ${d.attributes.platform} | ${d.attributes.processingState}`));
