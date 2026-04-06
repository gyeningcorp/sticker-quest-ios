import { createSign, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(apiPath, method='GET', body=null) { const opts = {method, headers:{'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'}}; if(body) opts.body=JSON.stringify(body); const r = await fetch(`https://api.appstoreconnect.apple.com/v1${apiPath}`,opts); if(r.status===204) return {data:true}; return r.json(); }

// === 1. SET CATEGORY ===
console.log('📂 Setting category...');
const appInfo = await asc(`/apps/${APP_ID}/appInfos?limit=1`);
const appInfoId = appInfo.data?.[0]?.id;
if (appInfoId) {
  const catRes = await asc(`/appInfos/${appInfoId}`, 'PATCH', {
    data: { type: 'appInfos', id: appInfoId,
      relationships: {
        primaryCategory: { data: { type: 'appCategories', id: 'EDUCATION' } },
        primarySubcategoryOne: { data: null },
        primarySubcategoryTwo: { data: null },
        secondaryCategory: { data: { type: 'appCategories', id: 'FAMILY' } }
      }
    }
  });
  console.log(catRes.data ? '✅ Categories set (Education + Family)' : '❌ ' + catRes.errors?.[0]?.detail);
}

// === 2. SET AGE RATING ===
console.log('\n🔞 Setting age rating...');
const ageRes = await asc(`/appInfos/${appInfoId}?include=ageRatingDeclaration`);
const ageId = ageRes.included?.find(i => i.type === 'ageRatingDeclarations')?.id;
if (ageId) {
  const ageUpdate = await asc(`/ageRatingDeclarations/${ageId}`, 'PATCH', {
    data: { type: 'ageRatingDeclarations', id: ageId, attributes: {
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      contests: 'NONE',
      gamblingAndContests: false,
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
  console.log(ageUpdate.data ? '✅ Age rating set (Kids 5 and under)' : '❌ ' + JSON.stringify(ageUpdate.errors?.[0]));
} else {
  console.log('⚠️ No age rating declaration found');
}

// === 3. RE-UPLOAD SCREENSHOTS ===
console.log('\n📸 Re-uploading screenshots at 1290x2796...');
const locs = await asc(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?filter[locale]=en-US`);
const locId = locs.data?.[0]?.id;
const sets = await asc(`/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
const setId = sets.data?.find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_67')?.id;

if (setId) {
  // Delete failed screenshots
  const existing = await asc(`/appScreenshotSets/${setId}/appScreenshots`);
  for (const ss of (existing.data || [])) {
    await asc(`/appScreenshots/${ss.id}`, 'DELETE');
    console.log(`  Deleted ${ss.attributes.fileName}`);
  }
  
  // Upload new ones
  const ssDir = 'C:\\Users\\Yours Truly\\OneDrive\\Documents\\Chris\\Projects\\sticker-quest-ios\\screenshots';
  const files = ['06-login.png','01-today-quests.png','07-sticker-book.png','04-reward-store.png','05-parent-dashboard.png','08-daily-goal.png'];
  
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(ssDir, files[i]);
    const fileData = fs.readFileSync(filePath);
    console.log(`  [${i+1}/${files.length}] ${files[i]} (${(fileData.length/1024/1024).toFixed(1)}MB)...`);
    
    const res = await asc('/appScreenshots', 'POST', {
      data: { type: 'appScreenshots', attributes: { fileName: files[i], fileSize: fileData.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } } }
    });
    if (!res.data) { console.log(`    ❌ ${res.errors?.[0]?.detail}`); continue; }
    
    const ssId = res.data.id;
    for (const op of (res.data.attributes.uploadOperations || [])) {
      const chunk = fileData.slice(op.offset, op.offset + op.length);
      const headers = {}; for (const h of op.requestHeaders) headers[h.name] = h.value;
      await fetch(op.url, { method: op.method, headers, body: chunk });
    }
    
    const md5 = createHash('md5').update(fileData).digest('base64');
    const commit = await asc(`/appScreenshots/${ssId}`, 'PATCH', {
      data: { type: 'appScreenshots', id: ssId, attributes: { uploaded: true, sourceFileChecksum: md5 } }
    });
    console.log(commit.data ? `    ✅ Done` : `    ⚠️ ${commit.errors?.[0]?.detail}`);
  }
}

// === 4. SUBMIT ===
console.log('\n🚀 Submitting for review...');
// Create review submission
const sub = await asc('/reviewSubmissions', 'POST', {
  data: { type: 'reviewSubmissions', relationships: { app: { data: { type: 'apps', id: APP_ID } } } }
});
if (sub.data) {
  // Add version
  const item = await asc('/reviewSubmissionItems', 'POST', {
    data: { type: 'reviewSubmissionItems', relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
    }}
  });
  console.log(item.data ? '✅ Version added to submission' : '❌ ' + item.errors?.[0]?.detail);
  
  // Confirm
  const confirm = await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', {
    data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } }
  });
  console.log(confirm.data ? '🎉 SUBMITTED FOR REVIEW!' : '❌ ' + confirm.errors?.[0]?.detail);
} else {
  console.log('❌', sub.errors?.[0]?.detail);
}
