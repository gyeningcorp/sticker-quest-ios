import { createSign } from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_ID = 'SVYGPTR7P7';
const ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13';
const KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const VERSION_ID = '986ae73b-e32a-47c9-b799-025f67f51552';

function makeJWT() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const msg = `${header}.${payload}`;
  const key = fs.readFileSync(KEY_PATH, 'utf8');
  const sign = createSign('SHA256');
  sign.update(msg);
  const sig = sign.sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${msg}.${sig}`;
}

async function asc(apiPath, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${makeJWT()}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${apiPath}`, opts);
  return r.json();
}

// Get the screenshot set for APP_IPHONE_65
const locs = await asc(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?filter[locale]=en-US`);
const locId = locs.data?.[0]?.id;
if (!locId) { console.log('No en-US localization found'); process.exit(1); }

const sets = await asc(`/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
let setId = sets.data?.find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_65')?.id;

if (!setId) {
  console.log('Creating iPhone 6.5" screenshot set...');
  const created = await asc('/appScreenshotSets', 'POST', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: 'APP_IPHONE_65' },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } }
    }
  });
  setId = created.data?.id;
  if (!setId) { console.log('Failed to create set:', JSON.stringify(created.errors)); process.exit(1); }
}
console.log(`Screenshot set ID: ${setId}`);

// Delete any existing screenshots
const existing = await asc(`/appScreenshotSets/${setId}/appScreenshots`);
if (existing.data?.length > 0) {
  console.log(`Deleting ${existing.data.length} existing screenshots...`);
  for (const ss of existing.data) {
    await asc(`/appScreenshots/${ss.id}`, 'DELETE');
  }
}

// Upload each screenshot
const ssDir = 'C:\\Users\\Yours Truly\\OneDrive\\Documents\\Chris\\Projects\\sticker-quest-ios\\screenshots';
const files = [
  '06-login.png',         // 1. Login first (first impression)
  '01-today-quests.png',  // 2. Main quest screen
  '07-sticker-book.png',  // 3. Sticker collection
  '04-reward-store.png',  // 4. Rewards
  '05-parent-dashboard.png', // 5. Parent dashboard
  '08-daily-goal.png',    // 6. Daily goals
];

for (let i = 0; i < files.length; i++) {
  const filePath = path.join(ssDir, files[i]);
  const fileData = fs.readFileSync(filePath);
  const fileSize = fileData.length;
  const fileName = files[i];
  
  console.log(`\n📸 [${i+1}/${files.length}] ${fileName} (${(fileSize/1024/1024).toFixed(1)} MB)...`);
  
  // 1. Reserve
  const reservation = await asc('/appScreenshots', 'POST', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } }
    }
  });
  
  if (!reservation.data) {
    console.log('  ❌ Reserve failed:', JSON.stringify(reservation.errors?.[0]?.detail));
    continue;
  }
  
  const ssId = reservation.data.id;
  const ops = reservation.data.attributes.uploadOperations;
  console.log(`  Reserved: ${ssId} (${ops?.length || 0} upload ops)`);
  
  // 2. Upload parts
  if (ops && ops.length > 0) {
    for (const op of ops) {
      const chunk = fileData.slice(op.offset, op.offset + op.length);
      const headers = {};
      for (const h of op.requestHeaders) {
        headers[h.name] = h.value;
      }
      const uploadRes = await fetch(op.url, { method: op.method, headers, body: chunk });
      console.log(`  Part uploaded: ${uploadRes.status}`);
    }
  }
  
  // 3. Commit
  const { createHash } = await import('crypto');
  const md5 = createHash('md5').update(fileData).digest('base64');
  const commit = await asc(`/appScreenshots/${ssId}`, 'PATCH', {
    data: {
      type: 'appScreenshots',
      id: ssId,
      attributes: { uploaded: true, sourceFileChecksum: md5 }
    }
  });
  
  if (commit.data) {
    console.log(`  ✅ Committed!`);
  } else {
    console.log(`  ⚠️ Commit response:`, JSON.stringify(commit.errors?.[0]?.detail));
  }
}

console.log('\n🎯 Screenshot upload complete!');
