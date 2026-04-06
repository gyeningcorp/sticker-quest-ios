import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7';
const ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13';
const KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
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
async function asc(path) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {headers:{'Authorization':`Bearer ${makeJWT()}`}});
  return r.json();
}

// Get localization
const locs = await asc(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?filter[locale]=en-US`);
const locId = locs.data?.[0]?.id;
console.log('Localization ID:', locId);

// Get existing screenshot sets
const sets = await asc(`/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
console.log('Existing sets:', sets.data?.map(s => `${s.attributes.screenshotDisplayType} (${s.id})`));

// Try all known types
const types = [
  'APP_IPHONE_35', 'APP_IPHONE_40', 'APP_IPHONE_47', 'APP_IPHONE_55', 'APP_IPHONE_58',
  'APP_IPHONE_61', 'APP_IPHONE_65', 'APP_IPHONE_67', 'APP_IPHONE_69',
  'APP_IPAD_97', 'APP_IPAD_105', 'APP_IPAD_PRO_3RD_GEN_11', 'APP_IPAD_PRO_3RD_GEN_129',
  'APP_IPAD_PRO_129'
];

for (const t of types) {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1/appScreenshotSets', {
    method: 'POST',
    headers: {'Authorization':`Bearer ${makeJWT()}`, 'Content-Type':'application/json'},
    body: JSON.stringify({data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:t},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:locId}}}}})
  });
  const j = await r.json();
  if (j.data) {
    console.log(`✅ ${t} — CREATED (${j.data.id})`);
  } else {
    console.log(`❌ ${t} — ${j.errors?.[0]?.detail}`);
  }
}
