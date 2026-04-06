import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path, method='GET', body=null) { const opts = {method, headers:{'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'}}; if(body) opts.body=JSON.stringify(body); return (await fetch(`https://api.appstoreconnect.apple.com/v1${path}`,opts)).json(); }

// List ALL versions
const v = await asc(`/apps/${APP_ID}/appStoreVersions?limit=10`);
console.log('=== ALL VERSIONS ===');
v.data?.forEach(d => console.log(`${d.id} | v${d.attributes.versionString} | ${d.attributes.platform} | ${d.attributes.appVersionState}`));

// The rejected iOS version - can we edit it?
const rejectedId = '89cfe218-bbdd-47f2-892d-6c508483b39a';
console.log('\nTrying to update rejected version to PREPARE_FOR_SUBMISSION...');
// When an iOS version is REJECTED, you can create a new version from it
// Actually for a rejected version, you need to resubmit - which means editing the existing version
const verDetail = await asc(`/appStoreVersions/${rejectedId}`);
console.log('Rejected version state:', verDetail.data?.attributes?.appVersionState);

// Try creating v1.1 for iOS
console.log('\nTrying to create iOS v1.1...');
const newVer = await asc('/appStoreVersions', 'POST', {
  data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: '1.1' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } }
});
if (newVer.data) {
  console.log('✅ Created:', newVer.data.id);
} else {
  console.log('❌', newVer.errors?.[0]?.detail);
  
  // If rejected version is editable, use it
  console.log('\nTrying to update version string of rejected version to 1.1...');
  const patched = await asc(`/appStoreVersions/${rejectedId}`, 'PATCH', {
    data: { type: 'appStoreVersions', id: rejectedId, attributes: { versionString: '1.1' } }
  });
  if (patched.data) {
    console.log('✅ Updated version string to 1.1! State:', patched.data.attributes.appVersionState);
    console.log('VERSION ID:', patched.data.id);
  } else {
    console.log('❌', patched.errors?.[0]?.detail);
  }
}
