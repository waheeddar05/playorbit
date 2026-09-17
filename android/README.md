# Android TWA build

The Play listing (`com.playorbit.app`) is a Trusted Web Activity wrapping
`https://www.playorbit.in`. It is generated with Bubblewrap, the same tool
PWABuilder uses — building locally keeps the upload key off third-party servers.

`twa-manifest.json` here is the source of truth. Without it the config has to be
reconstructed from the live web manifest by hand, which is how the 2026-09-18
rebuild lost an evening.

## Rebuild

    mkdir -p ~/playorbit-twa && cd ~/playorbit-twa
    cp <repo>/android/twa-manifest.json .
    # bump appVersionCode (must exceed the highest code ever uploaded) and appVersionName
    export JAVA_HOME=~/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home
    npx @bubblewrap/cli@latest update --skipVersionUpgrade
    export BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=...   # ~/playorbit-upload-key-credentials.txt
    npx @bubblewrap/cli@latest build --skipPwaValidation

Output: `app-release-bundle.aab`.

## Verify before uploading

    AAPT=~/.bubblewrap/android_sdk/build-tools/36.1.0/aapt2
    $AAPT dump badging app-release-signed.apk | grep -E '^package:|^targetSdkVersion'
    unzip -p app-release-bundle.aab 'META-INF/*.RSA' | keytool -printcert | grep SHA256

Expect versionCode/targetSdk as intended and the upload key
`E6:88:33:C1:05:3D:2B:19:F6:95:D6:E5:B7:03:82:88:CD:88:19:2B:6A:6A:69:50:C7:05:A2:64:A8:EA:55:4D`.

## Toolchain gotchas hit on 2026-09-18

- Bubblewrap wants the **legacy** SDK layout: `sdkmanager` at `$SDK/bin/` or
  `$SDK/tools/bin/`. Modern command-line tools install to
  `cmdline-tools/latest/bin/`, so symlink `$SDK/bin` -> `cmdline-tools/latest/bin`
  (and `lib`) or it reports "The provided androidSdk isn't correct."
- It pins an exact build-tools version (36.1.0 at the time of writing); having
  only 36.0.0 is not enough.
- `jdkPath` in `~/.bubblewrap/config.json` must be the directory *containing*
  `Contents/Home`, not `Contents/Home` itself.
- Omitting a field from `twa-manifest.json` interpolates an empty value straight
  into `app/build.gradle` (e.g. `splashScreenFadeOutDuration: ,`) and fails with a
  Groovy parse error rather than a validation message.
- `appVersionName` alone leaves `versionName ""`; set `appVersion` too.

The Digital Asset Links fingerprint served by
`src/app/.well-known/assetlinks.json/route.ts` is the Play **app signing** key
(`9E:36:AB:FE:...:8D:3D`), which is unrelated to the upload key and must not be
changed when the upload key is rotated.
