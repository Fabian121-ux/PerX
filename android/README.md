# ptahx Android app

An actual Android application (not a PWA) that displays the live https://www.ptahx.com/ Next.js site in a hardened Android WebView. Existing web deployments update the embedded experience; native changes still require Play Store updates.

## Build and test

Open the `android/` folder in Android Studio, install Android SDK 36 and JDK 17, then run the app. The project uses Android Gradle Plugin 8.13.2 / Gradle 8.13. Alternatively, install Gradle 8.13 and run:

```bash
gradle -p android :app:assembleDebug
gradle -p android :app:bundleRelease
```

The GitHub workflow `.github/workflows/android.yml` builds a debug APK and an **unsigned** release AAB on PRs or manual runs. Download the debug APK from Actions artifacts for a device test. Do NOT upload a debug or unsigned artifact to Google Play.

## Signing for Google Play

In Android Studio choose Build > Generate Signed Bundle / APK, generate or securely import an upload key, select Android App Bundle and the release variant. Keep the keystore and passwords outside GitHub. Enroll in Play App Signing and use the signed `.aab` in your authorized Play Console account. The package ID is `com.ptahx.app`, version code starts at 1; check uniqueness before the first upload. Subsequent releases must increment `versionCode`.

## Native shell behavior

- Android launcher, branded icon, edge-to-edge safe insets, first-party HTTPS-only WebView, progress indicator, network error/retry view, native Back, file-picker support.
- First-party cookies persist in WebView; external links open in the device browser.
- The app does not request access to camera, location, microphone, or external storage by default.
- Authentication currently uses the site's first-party email/password form. Third-party identity providers such as Google cannot be completed within Android WebView. They require a secure browser/native OAuth integration and a deliberate return-to-app session strategy before claiming support.
- External/browser file downloads are not equivalent to authenticated in-app downloads; verify each download flow before release.
- A WebView is still subject to Play's minimum-functionality policy. Test content, sign-in, signup/email verification, uploads, navigation, offline recovery, privacy policy and user data disclosures on a real device before submission.

## Naming

The product and app are **ptahx** at `ptahx.com`. Repository name `PerX` and older internal env keys are migration concerns, not the name to show users. Do not rename environment variables or database identifiers without coordinated deployment migration.
