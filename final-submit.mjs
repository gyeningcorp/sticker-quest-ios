import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path, method='GET', body=null) { const opts = {method, headers:{'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'}}; if(body) opts.body=JSON.stringify(body); const r = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`,opts); if(r.status===204) return {data:true}; return r.json(); }

async function run() {
  const appInfo = await asc(`/apps/${APP_ID}/appInfos?limit=1`);
  const appInfoId = appInfo.data?.[0]?.id;

  // 1. Fix Age Rating (using verified attribute names)
  console.log('🔞 Updating Age Rating...');
  const ageRes = await asc(`/appInfos/${appInfoId}?include=ageRatingDeclaration`);
  const ageId = ageRes.included?.find(i => i.type === 'ageRatingDeclarations')?.id;
  if (ageId) {
    await asc(`/ageRatingDeclarations/${ageId}`, 'PATCH', {
      data: { type: 'ageRatingDeclarations', id: ageId, attributes: {
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
        unrestrictedWebAccess: false
      }}
    });
    console.log('✅ Age rating updated');
  }

  // 2. Set Support URL
  console.log('\n📋 Setting Support URL...');
  const locs = await asc(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?filter[locale]=en-US`);
  const locId = locs.data?.[0]?.id;
  if (locId) {
    await asc(`/appStoreVersionLocalizations/${locId}`, 'PATCH', {
      data: { type: 'appStoreVersionLocalizations', id: locId, attributes: {
        supportUrl: 'https://github.com/gyeningcorp/sticker-quest-ios'
      }}
    });
    console.log('✅ Support URL set');
  }

  // 3. Create Submission
  console.log('\n🚀 Submitting...');
  const sub = await asc('/reviewSubmissions', 'POST', {
    data: { type: 'reviewSubmissions', relationships: { app: { data: { type: 'apps', id: APP_ID } } } }
  });
  
  if (sub.data) {
    const item = await asc('/reviewSubmissionItems', 'POST', {
      data: { type: 'reviewSubmissionItems', relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }}
    });
    
    if (item.data) {
      const confirm = await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', {
        data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } }
      });
      console.log(confirm.data ? '🎉 SUBMITTED FOR REVIEW!' : '❌ ' + JSON.stringify(confirm.errors?.[0]));
    } else {
      console.log('❌ Failed to add version to submission:', JSON.stringify(item.errors?.[0]));
      // Clean up empty submission
      await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', { data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { canceled: true } } });
    }
  } else {
    console.log('❌ Failed to create submission:', JSON.stringify(sub.errors?.[0]));
  }
}

run();
