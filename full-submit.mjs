import { createSign, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

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

// === 1. SET DESCRIPTION ===
console.log('📝 Setting description...');
const locs = await asc(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?filter[locale]=en-US`);
const locId = locs.data?.[0]?.id;
if (locId) {
  await asc(`/appStoreVersionLocalizations/${locId}`, 'PATCH', {
    data: { type: 'appStoreVersionLocalizations', id: locId, attributes: {
      description: `Sticker Quest makes chores fun for kids ages 4-8! 🌟\n\nParents set up daily tasks like "Make Your Bed" or "Brush Teeth" — kids complete them to earn points and unlock awesome stickers!\n\n✨ FEATURES:\n• Colorful daily quest board with fun tasks\n• 30 collectible stickers across 5 categories\n• Points system with levels and rewards\n• Streak tracker to build good habits 🔥\n• Parent dashboard to manage tasks and rewards\n• Sign In with Apple for secure accounts\n• COPPA compliant — zero ads, zero tracking\n\nPerfect for building daily routines and rewarding your child's efforts!`,
      keywords: 'kids,chores,stickers,habits,reward,children,tasks,parenting,routine,education',
      whatsNew: 'New: Sign In with Apple, parent dashboard, 30 collectible stickers, settings, backup/restore!'
    }}
  });
  console.log('✅ Description set');
}

// === 2. SET PRIVACY POLICY ===
console.log('\n🔒 Setting privacy policy...');
const appInfo = await asc(`/apps/${APP_ID}/appInfos?limit=1`);
const appInfoId = appInfo.data?.[0]?.id;
if (appInfoId) {
  const infoLocs = await asc(`/appInfos/${appInfoId}/appInfoLocalizations?filter[locale]=en-US`);
  const infoLocId = infoLocs.data?.[0]?.id;
  if (infoLocId) {
    await asc(`/appInfoLocalizations/${infoLocId}`, 'PATCH', {
      data: { type: 'appInfoLocalizations', id: infoLocId, attributes: {
        privacyPolicyUrl: 'https://gyeningcorp.github.io/sticker-quest-ios/privacy.html'
      }}
    });
    console.log('✅ Privacy policy URL set');
  }
}

// === 3. ATTACH BUILD ===
console.log('\n🔨 Finding builds...');
const builds = await asc(`/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=5`);
console.log(`Found ${builds.data?.length || 0} valid builds`);
builds.data?.forEach(b => console.log(`  Build ${b.attributes.version} | ${b.attributes.processingState}`));

const latestBuild = builds.data?.[0];
if (latestBuild) {
  console.log(`Attaching build ${latestBuild.attributes.version}...`);
  const attach = await asc(`/appStoreVersions/${VERSION_ID}/relationships/build`, 'PATCH', {
    data: { type: 'builds', id: latestBuild.id }
  });
  if (attach.errors) {
    console.log('❌ Attach failed:', attach.errors[0]?.detail);
  } else {
    console.log('✅ Build attached!');
  }
} else {
  console.log('❌ No valid builds found');
}

// === 4. UPLOAD SCREENSHOTS ===
console.log('\n📸 Uploading screenshots...');
const ssDir = 'C:\\Users\\Yours Truly\\OneDrive\\Documents\\Chris\\Projects\\sticker-quest-ios\\screenshots';

// Get screenshot sets
const sets = await asc(`/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
let setId = sets.data?.find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_67')?.id;

if (!setId) {
  // Try different iPhone types
  const types = ['APP_IPHONE_67', 'APP_IPHONE_65', 'APP_IPHONE_61', 'APP_IPHONE_55'];
  for (const t of types) {
    const created = await asc('/appScreenshotSets', 'POST', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: t },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } }
    });
    if (created.data) {
      setId = created.data.id;
      console.log(`✅ Created ${t} screenshot set: ${setId}`);
      break;
    } else {
      console.log(`  ${t}: ${created.errors?.[0]?.detail}`);
    }
  }
}

if (setId) {
  // Delete existing screenshots
  const existing = await asc(`/appScreenshotSets/${setId}/appScreenshots`);
  for (const ss of (existing.data || [])) {
    await asc(`/appScreenshots/${ss.id}`, 'DELETE');
  }

  const files = ['06-login.png', '01-today-quests.png', '07-sticker-book.png', '04-reward-store.png', '05-parent-dashboard.png', '08-daily-goal.png'];
  
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(ssDir, files[i]);
    if (!fs.existsSync(filePath)) { console.log(`  ⚠️ ${files[i]} not found`); continue; }
    const fileData = fs.readFileSync(filePath);
    const fileSize = fileData.length;
    
    console.log(`  [${i+1}/${files.length}] ${files[i]} (${(fileSize/1024/1024).toFixed(1)}MB)...`);
    
    const reservation = await asc('/appScreenshots', 'POST', {
      data: { type: 'appScreenshots', attributes: { fileName: files[i], fileSize },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } } }
    });
    
    if (!reservation.data) { console.log(`    ❌ Reserve failed: ${reservation.errors?.[0]?.detail}`); continue; }
    
    const ssId = reservation.data.id;
    const ops = reservation.data.attributes.uploadOperations || [];
    
    for (const op of ops) {
      const chunk = fileData.slice(op.offset, op.offset + op.length);
      const headers = {};
      for (const h of op.requestHeaders) headers[h.name] = h.value;
      await fetch(op.url, { method: op.method, headers, body: chunk });
    }
    
    const md5 = createHash('md5').update(fileData).digest('base64');
    const commit = await asc(`/appScreenshots/${ssId}`, 'PATCH', {
      data: { type: 'appScreenshots', id: ssId, attributes: { uploaded: true, sourceFileChecksum: md5 } }
    });
    console.log(commit.data ? `    ✅ Done` : `    ⚠️ ${commit.errors?.[0]?.detail}`);
  }
} else {
  console.log('⚠️ Could not create screenshot set — screenshots need to be uploaded manually in ASC');
}

// === 5. SET REVIEW NOTES ===
console.log('\n📋 Setting review notes...');
const reviewInfo = await asc(`/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
const reviewId = reviewInfo.data?.id;
const notes = 'TEST ACCOUNT:\nEmail: reviewer@stickerquest.app\nPassword: Review1234!\n\n1. Accept parental consent checkbox → Continue\n2. Sign In with Apple or use email above\n3. Enter child name, pick avatar\n4. Complete quests, collect stickers!\n\nNo internet required after login.';

if (reviewId) {
  await asc(`/appStoreReviewDetails/${reviewId}`, 'PATCH', {
    data: { type: 'appStoreReviewDetails', id: reviewId, attributes: { notes, demoAccountRequired: true, demoAccountName: 'reviewer@stickerquest.app', demoAccountPassword: 'Review1234!' } }
  });
  console.log('✅ Review notes updated');
} else {
  const r = await asc('/appStoreReviewDetails', 'POST', {
    data: { type: 'appStoreReviewDetails', attributes: { notes, demoAccountRequired: true, demoAccountName: 'reviewer@stickerquest.app', demoAccountPassword: 'Review1234!' },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } } } }
  });
  console.log(r.data ? '✅ Review notes created' : '⚠️ ' + r.errors?.[0]?.detail);
}

// === 6. SUBMIT FOR REVIEW ===
console.log('\n🚀 Submitting for review...');
const submit = await asc('/appStoreVersionSubmissions', 'POST', {
  data: { type: 'appStoreVersionSubmissions',
    relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION_ID } } } }
});
if (submit.data) {
  console.log('🎉 SUBMITTED FOR REVIEW!');
} else {
  console.log('❌ Submit failed:', submit.errors?.[0]?.detail);
}

console.log('\n✅ All done!');
