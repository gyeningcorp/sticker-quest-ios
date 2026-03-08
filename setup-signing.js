#!/usr/bin/env node
/**
 * setup-signing.js — Sticker Quest
 * Creates iOS distribution certificate + App Store provisioning profile
 * via App Store Connect REST API.
 */

const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ASC_KEY_ID    = process.env.ASC_KEY_ID;
const ASC_ISSUER_ID = process.env.ASC_ISSUER_ID;
const ASC_KEY_PATH  = process.env.ASC_KEY_PATH;
const BUNDLE_ID_STR = process.env.BUNDLE_ID || 'com.gyeningcorp.stickerquest';
// Key: 6R6XCV229K (updated 2026-03-07)
const TEAM_ID       = process.env.TEAM_ID   || '4LZJ7U5FHS';

function makeJWT() {
  const privKey = fs.readFileSync(ASC_KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg:'ES256', kid:ASC_KEY_ID, typ:'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss:ASC_ISSUER_ID, iat:now, exp:now+1200, aud:'appstoreconnect-v1' })).toString('base64url');
  const toSign  = `${header}.${payload}`;
  const sign    = crypto.createSign('SHA256');
  sign.update(toSign);
  const sig = sign.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${toSign}.${sig}`;
}

function apiCall(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const token = makeJWT();
    const data  = body ? JSON.stringify(body) : null;
    const opts  = {
      hostname: 'api.appstoreconnect.apple.com',
      path: apiPath, method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const TMP = process.env.RUNNER_TEMP || '/tmp';

  console.log('🔑 Generating distribution key pair (RSA 2048)...');
  const distKeyPath = path.join(TMP, 'dist_key.pem');
  const csrPath     = path.join(TMP, 'dist.csr');
  execSync(`openssl genrsa -out ${distKeyPath} 2048`);
  execSync(`openssl req -new -key ${distKeyPath} -out ${csrPath} -subj "/CN=iPhone Distribution: Christopher Gyening/O=Christopher Gyening/C=US"`);
  const csrDer = execSync(`openssl req -in ${csrPath} -outform DER`);
  const csrB64 = csrDer.toString('base64');

  console.log('🧹 Removing existing iOS Distribution certificates...');
  const existingCerts = await apiCall('GET', '/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION');
  for (const c of (existingCerts.body.data || [])) {
    console.log(`🗑️  Deleting cert: ${c.id}`);
    await apiCall('DELETE', `/v1/certificates/${c.id}`);
  }

  console.log('📜 Creating iOS Distribution certificate...');
  const certRes = await apiCall('POST', '/v1/certificates', {
    data: { type: 'certificates', attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent: csrB64 } }
  });
  if (certRes.status !== 201) { console.error('Cert failed:', JSON.stringify(certRes.body)); process.exit(1); }
  const certId      = certRes.body.data.id;
  const certContent = certRes.body.data.attributes.certificateContent;
  console.log(`✅ Certificate: ${certId}`);

  const cerPath = path.join(TMP, 'apple_dist.cer');
  const pemPath = path.join(TMP, 'apple_dist.pem');
  const p12Path = path.join(TMP, 'dist.p12');
  fs.writeFileSync(cerPath, Buffer.from(certContent, 'base64'));
  execSync(`openssl x509 -inform DER -in ${cerPath} -out ${pemPath}`);
  execSync(`openssl pkcs12 -export -out ${p12Path} -inkey ${distKeyPath} -in ${pemPath} -passout pass:TempP4ss!`);

  console.log('🔐 Setting up build keychain...');
  const KEYCHAIN = '/Users/runner/Library/Keychains/build.keychain-db';
  const KP = 'build_ci_pass';
  execSync(`security create-keychain -p "${KP}" "${KEYCHAIN}" 2>/dev/null || true`);
  execSync(`security set-keychain-settings -lut 21600 "${KEYCHAIN}"`);
  execSync(`security unlock-keychain -p "${KP}" "${KEYCHAIN}"`);
  execSync(`security list-keychains -d user -s "${KEYCHAIN}" ~/Library/Keychains/login.keychain-db`);
  execSync(`security import ${p12Path} -k "${KEYCHAIN}" -P "TempP4ss!" -T /usr/bin/codesign -T /usr/bin/security -A`);
  execSync(`security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${KP}" "${KEYCHAIN}"`);

  console.log('📦 Looking up Bundle ID...');
  const bundleRes = await apiCall('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID_STR}`);
  let bundleIdRecord;
  if (bundleRes.body.data && bundleRes.body.data.length > 0) {
    bundleIdRecord = bundleRes.body.data[0];
    console.log(`✅ Found bundle ID: ${bundleIdRecord.id}`);
  } else {
    console.log('Registering bundle ID...');
    const regRes = await apiCall('POST', '/v1/bundleIds', {
      data: { type: 'bundleIds', attributes: { identifier: BUNDLE_ID_STR, name: 'StickerQuest', platform: 'IOS' } }
    });
    if (regRes.status !== 201) { console.error('Bundle ID reg failed:', JSON.stringify(regRes.body)); process.exit(1); }
    bundleIdRecord = regRes.body.data;
    console.log(`✅ Registered bundle ID: ${bundleIdRecord.id}`);
  }

  console.log('📋 Deleting old App Store profiles...');
  const existingProfiles = await apiCall('GET', '/v1/profiles?filter[profileType]=IOS_APP_STORE');
  for (const p of (existingProfiles.body.data || [])) {
    if (p.attributes.name.includes('StickerQuest') || p.attributes.name.includes('Sticker')) {
      console.log(`🗑️  Deleting profile: ${p.id}`);
      await apiCall('DELETE', `/v1/profiles/${p.id}`);
    }
  }

  console.log('📋 Creating App Store provisioning profile...');
  const profileRes = await apiCall('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: 'StickerQuest AppStore', profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId:     { data: { type: 'bundleIds',     id: bundleIdRecord.id } },
        certificates: { data: [{ type: 'certificates', id: certId }] }
      }
    }
  });
  if (profileRes.status !== 201) { console.error('Profile failed:', JSON.stringify(profileRes.body)); process.exit(1); }
  const profileContent = profileRes.body.data.attributes.profileContent;
  const profileUUID    = profileRes.body.data.attributes.uuid;
  console.log(`✅ Profile: ${profileUUID}`);

  const profileDir  = path.join(process.env.HOME, 'Library/MobileDevice/Provisioning Profiles');
  execSync(`mkdir -p "${profileDir}"`);
  fs.writeFileSync(path.join(profileDir, `${profileUUID}.mobileprovision`), Buffer.from(profileContent, 'base64'));

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `DIST_PROFILE_UUID=${profileUUID}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `DIST_CERT_ID=${certId}\n`);
  }
  console.log('\n🎉 Signing setup complete! Profile UUID:', profileUUID);
}

main().catch(e => { console.error(e); process.exit(1); });
