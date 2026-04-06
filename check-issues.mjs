import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path) { return (await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {headers:{'Authorization':`Bearer ${makeJWT()}`}})).json(); }

// Check version details
const ver = await asc(`/appStoreVersions/${VERSION_ID}?include=appStoreReviewDetail,build`);
console.log('Version:', ver.data?.attributes?.versionString, ver.data?.attributes?.appVersionState);
console.log('Build attached:', ver.data?.relationships?.build?.data ? 'YES' : 'NO');

// Check screenshot sets
const locs = await asc(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`);
for (const loc of (locs.data || [])) {
  console.log(`\nLocale: ${loc.attributes.locale}`);
  const sets = await asc(`/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
  for (const s of (sets.data || [])) {
    const shots = await asc(`/appScreenshotSets/${s.id}/appScreenshots`);
    console.log(`  ${s.attributes.screenshotDisplayType}: ${shots.data?.length || 0} screenshots`);
    shots.data?.forEach(ss => console.log(`    ${ss.attributes.fileName} - ${ss.attributes.assetDeliveryState?.state}`));
  }
}

// Check app info (categories, age rating)
const appInfo = await asc(`/apps/${APP_ID}/appInfos?limit=1`);
const ai = appInfo.data?.[0];
console.log('\nApp Info:', ai?.id);
console.log('Primary category:', ai?.relationships?.primaryCategory?.data?.id || 'NOT SET');
console.log('Age rating:', ai?.relationships?.ageRatingDeclaration?.data?.id || 'NOT SET');

// Check age rating declaration
if (ai?.relationships?.ageRatingDeclaration?.data?.id) {
  const ard = await asc(`/ageRatingDeclarations/${ai.relationships.ageRatingDeclaration.data.id}`);
  console.log('Age rating details:', JSON.stringify(ard.data?.attributes));
}

// Check required screenshot display types
console.log('\n=== REQUIRED SCREENSHOT TYPES ===');
const loc0 = locs.data?.[0]?.id;
if (loc0) {
  const allSets = await asc(`/appStoreVersionLocalizations/${loc0}/appScreenshotSets`);
  console.log('Sets:', allSets.data?.map(s => s.attributes.screenshotDisplayType).join(', ') || 'NONE');
}
