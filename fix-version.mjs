import { createSign } from 'crypto';
import fs from 'fs';
const KEY_ID = 'SVYGPTR7P7', ISSUER_ID = 'b308a499-b1ae-4bb3-b84d-21676751dd13', KEY_PATH = 'C:\\Users\\Yours Truly\\Downloads\\AuthKey_SVYGPTR7P7.p8';
const APP_ID = '6760586844';
function makeJWT() { const h = Buffer.from(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'})).toString('base64url'); const n = Math.floor(Date.now()/1000); const p = Buffer.from(JSON.stringify({iss:ISSUER_ID,iat:n,exp:n+1200,aud:'appstoreconnect-v1'})).toString('base64url'); const m = `${h}.${p}`; const k = fs.readFileSync(KEY_PATH,'utf8'); const s = createSign('SHA256'); s.update(m); return `${m}.${s.sign({key:k,dsaEncoding:'ieee-p1363'}).toString('base64url')}`; }
async function asc(path, method = 'GET', body = null) { const opts = { method, headers: {'Authorization':`Bearer ${makeJWT()}`,'Content-Type':'application/json'} }; if (body) opts.body = JSON.stringify(body); return (await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, opts)).json(); }

// 1. Create a new iOS v1.1 version
console.log('Creating iOS v1.1...');
const newVer = await asc('/appStoreVersions', 'POST', {
  data: {
    type: 'appStoreVersions',
    attributes: { platform: 'IOS', versionString: '1.1' },
    relationships: { app: { data: { type: 'apps', id: APP_ID } } }
  }
});

if (newVer.data) {
  const vId = newVer.data.id;
  console.log(`✅ Created iOS v1.1: ${vId}`);
  
  // 2. Set description/keywords
  const locs = await asc(`/appStoreVersions/${vId}/appStoreVersionLocalizations?filter[locale]=en-US`);
  const locId = locs.data?.[0]?.id;
  if (locId) {
    await asc(`/appStoreVersionLocalizations/${locId}`, 'PATCH', {
      data: { type: 'appStoreVersionLocalizations', id: locId, attributes: {
        description: `Sticker Quest makes chores fun for kids ages 4-8! 🌟\n\nParents set up daily tasks like "Make Your Bed" or "Brush Teeth" — kids complete them to earn points and unlock awesome stickers!\n\n✨ FEATURES:\n• Colorful daily quest board with fun tasks\n• 30 collectible stickers across 5 categories\n• Points system with levels and rewards\n• Streak tracker to build good habits 🔥\n• Parent dashboard to manage tasks and rewards\n• Sign In with Apple for secure accounts\n• COPPA compliant — zero ads, zero tracking\n\nPerfect for building daily routines and rewarding your child's efforts!`,
        keywords: 'kids,chores,stickers,habits,reward,children,tasks,parenting,routine,education',
        whatsNew: 'Sign In with Apple, parent dashboard, 30 collectible stickers, settings, backup/restore!'
      }}
    });
    console.log('✅ Description & keywords set');
  }
  
  // 3. Find and attach latest iOS build
  const builds = await asc(`/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=5`);
  console.log('\nBuilds found:', builds.data?.length);
  builds.data?.forEach(b => console.log(`  Build ${b.attributes.version} | ${b.attributes.processingState}`));
  
  const latestBuild = builds.data?.[0];
  if (latestBuild) {
    const attach = await asc(`/appStoreVersions/${vId}/relationships/build`, 'PATCH', {
      data: { type: 'builds', id: latestBuild.id }
    });
    if (attach.errors) {
      console.log('❌ Attach failed:', attach.errors[0]?.detail);
    } else {
      console.log(`✅ Build ${latestBuild.attributes.version} attached!`);
    }
  }
  
  // 4. Set review notes
  const reviewRes = await asc('/appStoreReviewDetails', 'POST', {
    data: {
      type: 'appStoreReviewDetails',
      attributes: { notes: 'TEST ACCOUNT:\nEmail: reviewer@stickerquest.app\nPassword: Review1234!\n\n1. Check "I am the parent/guardian" → Continue\n2. Sign In with Apple or use email above\n3. Enter child name, pick avatar\n4. Complete quests to earn stickers!', demoAccountRequired: true, demoAccountName: 'reviewer@stickerquest.app', demoAccountPassword: 'Review1234!' },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: vId } } }
    }
  });
  console.log(reviewRes.data ? '✅ Review notes set' : '⚠️ ' + (reviewRes.errors?.[0]?.detail || 'unknown'));
  
  console.log(`\n🎯 NEW iOS VERSION ID: ${vId}`);
  console.log('Now upload screenshots and submit!');
} else {
  console.log('❌ Failed:', JSON.stringify(newVer.errors?.[0]));
}
