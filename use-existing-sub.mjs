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
  return r.json();
}

async function run() {
  // Get the 4 READY_FOR_REVIEW submissions
  const subs = await asc(`/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW`);
  console.log(`Found ${subs.data?.length || 0} READY_FOR_REVIEW submissions\n`);

  for (const sub of (subs.data || [])) {
    console.log(`--- Submission ${sub.id} ---`);
    
    // Check existing items
    const items = await asc(`/reviewSubmissions/${sub.id}/items`);
    console.log(`  Existing items: ${items.data?.length || 0}`);
    for (const item of (items.data || [])) {
      console.log(`    - ${item.id} state: ${item.attributes?.state}`);
    }

    // Try adding our version
    console.log('  Adding version item...');
    const addItem = await asc('/reviewSubmissionItems', 'POST', {
      data: { type: 'reviewSubmissionItems', relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } }
      }}
    });

    if (addItem.data) {
      console.log(`  ✅ Added! Item: ${addItem.data.id}`);
      
      // Now submit
      console.log('  Submitting...');
      const confirm = await asc(`/reviewSubmissions/${sub.id}`, 'PATCH', {
        data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } }
      });
      if (confirm.data) {
        console.log(`  🎉 SUBMITTED! State: ${confirm.data.attributes?.state}`);
        return; // Done!
      } else {
        console.log(`  ❌ Submit failed: ${JSON.stringify(confirm.errors?.[0])}`);
      }
    } else {
      console.log(`  ❌ Add failed: ${JSON.stringify(addItem.errors?.[0]?.detail)}`);
    }
    console.log('');
  }

  // If none worked, try removing items from stale ones to free them up
  console.log('\n🔧 Trying to remove items from stale submissions to make them cancellable...');
  for (const sub of (subs.data || [])) {
    const items = await asc(`/reviewSubmissions/${sub.id}/items`);
    for (const item of (items.data || [])) {
      console.log(`  Deleting item ${item.id} from ${sub.id}...`);
      const del = await asc(`/reviewSubmissionItems/${item.id}`, 'DELETE');
      console.log(`    ${del.data ? '✅ Deleted' : '❌ ' + JSON.stringify(del.errors?.[0]?.detail)}`);
    }
    // Try cancel again
    const cancel = await asc(`/reviewSubmissions/${sub.id}`, 'PATCH', {
      data: { type: 'reviewSubmissions', id: sub.id, attributes: { canceled: true } }
    });
    console.log(`  Cancel ${sub.id}: ${cancel.data ? '✅' : '❌ ' + JSON.stringify(cancel.errors?.[0]?.detail)}`);
  }
}

run();
