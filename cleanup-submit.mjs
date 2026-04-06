import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
const VERSION_ID = '89cfe218-bbdd-47f2-892d-6c508483b39a';

function makeJWT() {
  const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url');
  const m = `${h}.${p}`;
  const k = fs.readFileSync(KEY_PATH,'utf8');
  const s = createSign('SHA256'); s.update(m);
  return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}

async function asc(apiPath, method='GET', body=null) {
  const opts = {method, headers:{'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'}};
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${apiPath}`, opts);
  if(r.status===204) return {data:true};
  const j = await r.json();
  return j;
}

async function run() {
  // Step 1: List all existing review submissions and cancel stale ones
  console.log('🧹 Cleaning up stale review submissions...');
  const subs = await asc(`/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,UNRESOLVED_ISSUES`);
  
  if (subs.data?.length) {
    console.log(`  Found ${subs.data.length} existing submissions:`);
    for (const sub of subs.data) {
      console.log(`  - ${sub.id} (state: ${sub.attributes?.state})`);
      // Cancel it
      const cancel = await asc(`/reviewSubmissions/${sub.id}`, 'PATCH', {
        data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } }
      });
      if (cancel.data) {
        console.log(`    ✅ Canceled`);
      } else {
        console.log(`    ❌ Cancel failed: ${JSON.stringify(cancel.errors?.[0]?.detail || cancel.errors?.[0])}`);
        // Try DELETE if cancel doesn't work
        const del = await asc(`/reviewSubmissions/${sub.id}`, 'DELETE');
        console.log(`    DELETE attempt: ${del.data ? '✅' : '❌ ' + JSON.stringify(del.errors?.[0]?.detail)}`);
      }
    }
  } else {
    console.log('  No active submissions found. Checking all states...');
    // Try without filter to see what's there
    const allSubs = await asc(`/reviewSubmissions?filter[app]=${APP_ID}`);
    console.log(`  Total submissions: ${allSubs.data?.length || 0}`);
    for (const sub of (allSubs.data || [])) {
      console.log(`  - ${sub.id} (state: ${sub.attributes?.state})`);
      if (['READY_FOR_REVIEW','WAITING_FOR_REVIEW','UNRESOLVED_ISSUES','CANCELING'].includes(sub.attributes?.state)) {
        const cancel = await asc(`/reviewSubmissions/${sub.id}`, 'PATCH', {
          data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } }
        });
        console.log(`    Cancel: ${cancel.data ? '✅' : '❌'}`);
      }
    }
  }

  // Step 2: Check version state
  console.log('\n📋 Checking version state...');
  const ver = await asc(`/appStoreVersions/${VERSION_ID}`);
  console.log(`  Version: ${ver.data?.attributes?.versionString} — State: ${ver.data?.attributes?.appStoreState}`);

  // Step 3: Check build is attached
  const buildRel = await asc(`/appStoreVersions/${VERSION_ID}/build`);
  if (buildRel.data) {
    console.log(`  Build: ${buildRel.data.attributes?.version} (${buildRel.data.id})`);
  } else {
    console.log('  ⚠️ No build attached!');
  }

  // Step 4: Try to submit fresh
  console.log('\n🚀 Creating fresh submission...');
  const sub = await asc('/reviewSubmissions', 'POST', {
    data: { type: 'reviewSubmissions', relationships: { app: { data: { type: 'apps', id: APP_ID } } } }
  });

  if (sub.data?.id) {
    console.log(`  Submission created: ${sub.data.id}`);
    
    const item = await asc('/reviewSubmissionItems', 'POST', {
      data: { type: 'reviewSubmissionItems', relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }}
    });

    if (item.data) {
      console.log('  Version added to submission');
      const confirm = await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', {
        data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } }
      });
      if (confirm.data) {
        console.log(`  🎉 SUBMITTED! State: ${confirm.data.attributes?.state}`);
      } else {
        console.log(`  ❌ Submit failed: ${JSON.stringify(confirm.errors?.[0])}`);
      }
    } else {
      console.log(`  ❌ Add version failed: ${JSON.stringify(item.errors?.[0])}`);
      await asc(`/reviewSubmissions/${sub.data.id}`, 'PATCH', {
        data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { canceled: true } }
      });
    }
  } else {
    console.log(`  ❌ Create failed: ${JSON.stringify(sub.errors?.[0])}`);
  }
}

run();
