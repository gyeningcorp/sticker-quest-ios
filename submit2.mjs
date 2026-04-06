import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path, method='GET', body=null) { const opts = {method, headers:{'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'}}; if(body) opts.body=JSON.stringify(body); const r = await fetch(`https://api.appstoreconnect.apple.com${path}`,opts); if(r.status===204) return {data:true}; return r.json(); }

// Try reviewSubmissions (newer ASC API)
console.log('Trying reviewSubmissions...');
const r1 = await asc('/v1/reviewSubmissions', 'POST', {
  data: {
    type: 'reviewSubmissions',
    relationships: {
      app: { data: { type: 'apps', id: APP_ID } }
    }
  }
});
if (r1.data && r1.data.id) {
  console.log('✅ Review submission created:', r1.data.id);
  
  // Add the version as an item
  console.log('Adding version to submission...');
  const r2 = await asc('/v1/reviewSubmissionItems', 'POST', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: r1.data.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }
    }
  });
  console.log(r2.data ? '✅ Version added' : '❌ ' + r2.errors?.[0]?.detail);
  
  // Submit
  console.log('Confirming submission...');
  const r3 = await asc(`/v1/reviewSubmissions/${r1.data.id}`, 'PATCH', {
    data: { type: 'reviewSubmissions', id: r1.data.id, attributes: { submitted: true } }
  });
  if (r3.data) {
    console.log('🎉 SUBMITTED FOR REVIEW! State:', r3.data.attributes?.state);
  } else {
    console.log('❌', r3.errors?.[0]?.detail);
  }
} else {
  console.log('❌', r1.errors?.[0]?.detail || JSON.stringify(r1));
}
