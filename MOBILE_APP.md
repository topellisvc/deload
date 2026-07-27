# Shipping Deload to the App Store / Google Play

The repo now has a Capacitor project (`capacitor.config.ts`, `ios/`, `android/`) that wraps the live site at `https://deloadhq.com` in a native shell. It's not a separate build of the app — both platforms load the real deployed site, so every server feature (auth, program builder, coaching, notifications) keeps working exactly as it does in a browser today. What changes is packaging: a home-screen icon, a native process, and a listing in each store.

None of the actual building/signing can happen in the sandbox this was set up in — it needs Xcode (Mac only) and Android Studio, both of which need to run on your own machine.

## Before you submit: read this

Apple's App Store Review Guideline 4.2 ("Minimum Functionality") is the one thing most likely to get a wrapped-website app rejected: if the app is just a WebView pointing at a site with no native functionality, reviewers can and do reject it as "not sufficiently different from a mobile browsing experience." Google is more lenient but has tightened similar rules for "trivial" WebView wrappers on Google Play.

Practical fix: add at least one real native capability before submitting to Apple. The natural fit here is **push notifications** — this app already has a full notification system (`src/lib/notifications/`, the `notify()` call sites in programs/coaching mutations) that currently only does in-app + email. Wiring Capacitor's Push Notifications plugin into that same `notify()` call would give coaches/athletes a real push alert when a program's assigned or an invite's accepted, and it's a genuine differentiator from the website, not just decoration. Other options if push feels like too much for now: native share sheet, haptics on key actions, biometric unlock for the coach dashboard. Happy to build any of these next — just say which.

## iOS

1. Install Xcode from the Mac App Store (free), and CocoaPods: `sudo gem install cocoapods`.
2. Enroll in the Apple Developer Program ($99/year) at developer.apple.com if you haven't already — required to submit to the App Store (not required just to run on your own device via Xcode).
3. From the repo root: `npm run cap:sync` (installs native deps into the Xcode project), then `npm run cap:ios` to open it in Xcode.
4. In Xcode: select the App target → Signing & Capabilities → pick your team. Xcode will provision automatically.
5. Run on a simulator or your own phone (plugged in, "Trust This Computer") straight from Xcode's Run button to sanity-check it first.
6. Create the app listing in App Store Connect (appstoreconnect.apple.com): name, bundle ID `com.deloadhq.app` (already set), screenshots (Xcode's simulator can generate these — Product → Screenshot), description, privacy policy URL, age rating.
7. Archive (Product → Archive) and submit through Xcode's Organizer, or upload via Transporter. Consider a TestFlight beta first — it's free and doesn't require review.

## Android

1. Install Android Studio (free) — it bundles the Android SDK.
2. From the repo root: `npm run cap:sync`, then `npm run cap:android` to open it in Android Studio.
3. You'll need a signing keystore for release builds: Build → Generate Signed Bundle/APK in Android Studio walks through creating one. **Back this keystore file up somewhere safe outside the repo** — losing it means you can never update the app under the same listing again.
4. Enroll in the Google Play Console ($25 one-time) at play.google.com/console.
5. Build a release .aab (Android App Bundle, not .apk) via Build → Generate Signed Bundle/APK.
6. Create the store listing: name, package `com.deloadhq.app`, screenshots, short/full description, privacy policy URL, content rating questionnaire, data safety form (this app collects email + training data, so that form needs to reflect that accurately).
7. Upload the .aab to an internal testing track first, then promote to production once you're happy.

## Local dev / live reload

`capacitor.config.ts` currently points `server.url` at production (`https://deloadhq.com`), so both native builds always show what's actually live. To iterate against local changes instead: run `npm run dev`, find your machine's LAN IP, and temporarily change `server.url` to `http://<your-ip>:3000` (not `localhost` — the device/simulator needs to reach your machine over the network), then `npm run cap:sync` again. Switch it back before archiving a release build.

## What's already done

- App icon and splash screen generated for both platforms from the existing brand mark (`resources/icon.png` is the source — regenerate via `npx capacitor-assets generate` if the logo ever changes).
- `public/manifest.webmanifest` + safe-area CSS handling for the iPhone notch/home indicator.
- Bundle/package ID set to `com.deloadhq.app` — change this in `capacitor.config.ts` before your first build if you'd rather use something else (it can't be changed after you've published under it).
