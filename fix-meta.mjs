import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path, method='GET', body=null) { const opts = {method, headers:{'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'}}; if(body) opts.body=JSON.stringify(body); const r = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`,opts); if(r.status===204) return {data:true}; return r.json(); }

// 1. List available categories
console.log('=== AVAILABLE CATEGORIES ===');
const cats = await asc('/appCategories?filter[platforms]=IOS&limit=50');
const edu = cats.data?.filter(c => c.attributes?.platforms?.includes('IOS'));
edu?.forEach(c => console.log(`${c.id} - ${c.attributes?.platforms}`));

// 2. Set category
console.log('\n📂 Setting categories...');
const appInfo = await asc(`/apps/${APP_ID}/appInfos?limit=1`);
const appInfoId = appInfo.data?.[0]?.id;
console.log('AppInfo ID:', appInfoId);

// Get full appInfo to see what relationships exist
const fullInfo = await asc(`/appInfos/${appInfoId}`);
console.log('Current relationships keys:', Object.keys(fullInfo.data?.relationships || {}));

const catRes = await asc(`/appInfos/${appInfoId}`, 'PATCH', {
  data: { type: 'appInfos', id: appInfoId,
    relationships: {
      primaryCategory: { data: { type: 'appCategories', id: 'EDUCATION' } }
    }
  }
});
if (catRes.data) { console.log('✅ Primary category set'); } else { console.log('❌ Cat:', JSON.stringify(catRes.errors?.[0])); }

// 3. Fix age rating
console.log('\n🔞 Setting age rating...');
const ageRes = await asc(`/appInfos/${appInfoId}?include=ageRatingDeclaration`);
const ageDecl = ageRes.included?.find(i => i.type === 'ageRatingDeclarations');
console.log('Age rating ID:', ageDecl?.id);
console.log('Current attributes:', JSON.stringify(ageDecl?.attributes));

if (ageDecl) {
  const ageUpdate = await asc(`/ageRatingDeclarations/${ageDecl.id}`, 'PATCH', {
    data: { type: 'ageRatingDeclarations', id: ageDecl.id, attributes: {
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      contests: 'NONE',
      gambling: false,
      gamblingSimulated: 'NONE',
      horrorOrFearThemes: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      sexualContentOrNudity: 'NONE',
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      kidsAgeBand: 'FIVE_AND_UNDER',
      unrestrictedWebAccess: false,
      seventeenPlus: false
    }}
  });
  if (ageUpdate.data) { console.log('✅ Age rating set!'); } else { console.log('❌ Age:', JSON.stringify(ageUpdate.errors?.[0])); }
}

// 4. Check current state
console.log('\n=== CURRENT STATE ===');
const ver = await asc('/appStoreVersions/89cfe218-bbdd-47f2-892d-6c508483b39a');
console.log('Version:', ver.data?.attributes?.versionString, ver.data?.attributes?.appVersionState);

// 5. Try submission again
console.log('\n🚀 Trying submission...');
const sub = await asc('/reviewSubmissions', 'POST', {
  data: { type: 'reviewSubmissions', relationships: { app: { data: { type: 'apps', id: APP_ID } } } }
});
if (sub.data) {
  const item = await asc('/reviewSubmissionItems', 'POST', {
    data: { type: 'reviewSubmissionItems', relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: '89cfe218-bbdd-47f2-892d-6c508483b39a' } }
    }}
  });
  if (item.data) {
    console.log('✅ Item added');
    const confirm = await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', {
      data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } }
    });
    console.log(confirm.data ? `🎉 SUBMITTED! State: ${confirm.data.attributes?.state}` : '❌ ' + confirm.errors?.[0]?.detail);
  } else {
    console.log('❌ Item:', item.errors?.[0]?.detail);
    // Cancel the submission
    await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', {
      data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { canceled: true } }
    });
  }
} else {
  console.log('❌', sub.errors?.[0]?.detail);
}
