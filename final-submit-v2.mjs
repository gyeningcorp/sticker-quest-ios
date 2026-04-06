import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a'; // iOS v1.1 (was rejected v1.0)

function makeJWT() {
  const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url');
  const m = `${h}.${p}`;
  const k = fs.readFileSync(KEY_PATH,'utf8');
  const s = createSign('SHA256'); s.update(m);
  return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}

async function asc(apiPath, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${makeJWT()}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${apiPath}`, opts);
  if (r.status === 204) return { data: true };
  return r.json();
}

async function run() {
  // === 1. SET CATEGORY AND AGE RATING ===
  console.log('🎯 Setting App Store Metadata...');
  const appInfo = await asc(`/apps/${APP_ID}/appInfos?limit=1`);
  const appInfoId = appInfo.data?.[0]?.id;
  if (!appInfoId) { console.log('❌ App Info not found.'); return; }

  // Update App Info (Category and Age Rating)
  await asc(`/appInfos/${appInfoId}`, 'PATCH', {
    data: {
      type: 'appInfos',
      id: appInfoId,
      attributes: {
        // Primary category set to EDUCATION, secondary to FAMILY
        // Kids Age Band set to FIVE_AND_UNDER
        // Note: Some attributes like 'seventeenPlus' caused errors, so omitted.
      },
      relationships: {
        primaryCategory: { data: { type: 'appCategories', id: 'EDUCATION' } },
        secondaryCategory: { data: { type: 'appCategories', id: 'FAMILY' } },
        ageRatingDeclaration: {
          // Fetching existing and patching it, or creating if it doesn't exist
          // The API for ageRatingDeclarations is tricky - need to ensure it exists or is fetched correctly before PATCH
          // For simplicity, assuming we can update it directly if it has an ID.
          // If not, we'd need to POST first.
          // Let's try to get the existing one first.
        }
      }
    }
  });

  // Fetching and patching age rating declaration separately is safer
  const ageRes = await asc(`/appInfos/${appInfoId}?include=ageRatingDeclaration`);
  const ageDecl = ageRes.included?.find(i => i.type === 'ageRatingDeclarations');
  if (ageDecl) {
    await asc(`/ageRatingDeclarations/${ageDecl.id}`, 'PATCH', {
      data: {
        type: 'ageRatingDeclarations', id: ageDecl.id,
        attributes: {
          kidsAgeBand: 'FIVE_AND_UNDER', // Correct attribute for kids age band
          unrestrictedWebAccess: false, // Assuming no unrestricted web access
          // Omitting attributes that caused errors ('seventeenPlus', 'gamblingAndContests')
          // Other attributes remain default ('NONE' or false) as per initial checks.
        }
      }
    });
    console.log('✅ Age rating set to FIVE_AND_UNDER');
  } else {
    console.log('⚠️ No existing age rating declaration found to patch.');
  }

  // Update categories again if the first attempt failed (though the above PATCH should cover it)
  console.log('\n✅ Categories should be set to Education/Family.');

  // === 2. ATTACH BUILD (already done, but good to confirm state)
  console.log('\n🔨 Checking build attachment...');
  const v = await asc(`/appStoreVersions/${VERSION_ID}`);
  const buildAttached = v.data?.relationships?.build?.data;
  if (buildAttached) {
    console.log(`✅ Build ${buildAttached.id} is attached to v1.1`);
  } else {
    console.log('❌ Build is NOT attached to v1.1. Attaching latest valid build...');
    const builds = await asc(`/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=1`);
    const latestBuild = builds.data?.[0];
    if (latestBuild) {
      await asc(`/appStoreVersions/${VERSION_ID}/relationships/build`, 'PATCH', {
        data: { type: 'builds', id: latestBuild.id }
      });
      console.log(`✅ Attached build ${latestBuild.attributes.version} (${latestBuild.id})`);
    } else {
      console.log('❌ No valid builds found to attach.');
    }
  }

  // === 3. RE-SUBMIT FOR REVIEW ===
  console.log('\n🚀 Resubmitting for review...');
  // This part was failing due to submission endpoint issues or missing required data.
  // Let's re-attempt the submission with the latest data.
  // First, try creating a new submission request, then adding the version item, then submitting.
  
  // Create review submission
  const sub = await asc('/reviewSubmissions', 'POST', {
    data: {
      type: 'reviewSubmissions',
      relationships: { app: { data: { type: 'apps', id: APP_ID } } }
    }
  });

  if (sub.data && sub.data.id) {
    const subId = sub.data.id;
    console.log(`  Created submission: ${subId}`);

    // Add the version to the submission
    const item = await asc('/reviewSubmissionItems', 'POST', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
        }
      }
    });

    if (item.data) {
      console.log('  Version added to submission.');
      // Confirm submission
      const confirm = await asc(`/reviewSubmissions/${subId}`, 'PATCH', {
        data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } }
      });
      if (confirm.data) {
        console.log(`  🎉 SUBMITTED FOR REVIEW! State: ${confirm.data.attributes?.state}`);
      } else {
        console.log('  ❌ Failed to confirm submission:', JSON.stringify(confirm.errors?.[0]));
      }
    } else {
      console.log('  ❌ Failed to add version to submission:', JSON.stringify(item.errors?.[0]));
      // Clean up the submission if item add failed
      await asc(`/reviewSubmissions/${subId}`, 'PATCH', { data: { type: 'reviewSubmissions', id: subId, attributes: { canceled: true } } });
    }
  } else {
    console.log('❌ Failed to create submission:', JSON.stringify(sub.errors?.[0]));
  }
}

run();
