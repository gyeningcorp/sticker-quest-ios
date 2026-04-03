# Sticker Quest iOS — Build Status

## Project Type
- **Native Swift/SwiftUI** app using **XcodeGen** (`project.yml`) to generate `.xcodeproj`
- The app is a WKWebView wrapper that loads bundled HTML/JS content from `Sources/StickerQuest/WebContent/`
- All web content is local (no external network calls) — designed for Apple Kids category compliance
- Deployment target: iOS 15.0, Swift 5.9, Xcode 16

## App Identity
| Field | Value |
|-------|-------|
| Bundle ID | `com.gyeningcorp.stickerquest` |
| App Name (ASC) | Sticker Quest Kids |
| Apple ID | 6760586844 |
| Team ID | 4LZJ7U5FHS |
| Marketing Version | 1.1 (in `project.yml`) |
| Build Number | 2 (in `project.yml`; CI overrides with `GITHUB_RUN_NUMBER`) |

## App Store Connect Status
- **iOS version 1.0**: **REJECTED** (created 2026-03-14)
- **macOS version 1.0**: PREPARE_FOR_SUBMISSION (auto-created, not relevant)
- **Uploaded Builds**: 3 valid builds (11, 12, 13) — latest is build 13 (uploaded 2026-03-18)

## CI/CD Pipeline
- **GitHub Actions** workflow at `.github/workflows/build-and-submit.yml`
- Runs on `macos-14` runner with Xcode 16.2
- Pipeline: checkout → xcodegen → code signing (ASC API key) → archive → export IPA → upload via `altool`
- **Last run**: #13 on 2026-03-18 — **SUCCESS** (build uploaded to TestFlight)
- Required secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`

## What Is Needed to Submit to App Store

### Immediate Blockers
1. **iOS v1.0 was REJECTED** (submitted 2026-03-14, state: UNRESOLVED_ISSUES) — rejection reason not available via API; check Resolution Center in App Store Connect UI
2. **Version mismatch**: `project.yml` says version 1.1, but ASC only has a v1.0 version entry. A new App Store version (1.1) needs to be created in ASC, or the version in `project.yml` needs to match what's in ASC.
3. A **new review submission** is already in `READY_FOR_REVIEW` state — indicating resubmission has been prepared but not yet submitted.

### Before Submission
1. **Address rejection feedback** — log into App Store Connect Resolution Center to read the rejection notes
2. **Create new App Store version** (1.1) in ASC if submitting a new version
3. **App Store metadata** — screenshots, description, keywords, age rating, privacy policy URL must be complete
4. **Attach a build** to the App Store version (build 13 or the incoming build 14 are both VALID)
5. **Submit for review**

### Notes
- The `isOrEverWasMadeForKids` flag is currently `false` in ASC, but the code blocks all external URLs for Kids category compliance. If targeting Kids category, this needs to be set in ASC.
- The `Info.plist` still has exception domains for `gyeningcorp.github.io` and Google Fonts, but the code blocks all non-file URLs. These exception domains are harmless but could be cleaned up.
- `altool` is deprecated — Apple recommends migrating to `notarytool` or the Transporter app for uploads. Consider switching to `xcrun notarytool` in CI.

## Latest Build
- **Build #14** triggered via workflow_dispatch on 2026-03-24
- **Status: SUCCESS** — all steps passed (archive, export IPA, upload to TestFlight)
- Build is now processing in TestFlight and will be available for testing once Apple completes processing

## Build Locally?
- **Not possible from this machine** (Windows 11). Builds must go through GitHub Actions CI on macOS.
- To trigger a build: push to `main` or use workflow_dispatch.

---
*Generated: 2026-03-23, updated 2026-03-24*
