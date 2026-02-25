# PlayOrbit — Google Play Store Publishing Guide (TWA)

This guide walks you through publishing your existing Next.js PWA as a native Android app using **Trusted Web Activity (TWA)** via Google's Bubblewrap CLI.

---

## Prerequisites

| Item | Status |
|------|--------|
| PWA manifest.json | ✅ Already done |
| Service Worker (sw.js) | ✅ Already done |
| Icons (192x192 + 512x512) | ✅ Already done |
| App deployed on HTTPS | ✅ Vercel |
| Google Play Developer Account | ❌ Need to create ($25 one-time) |
| Java JDK 11+ | Need on your machine |
| Android SDK (or Android Studio) | Need on your machine |

---

## Step 1: Create Google Play Developer Account

1. Go to [https://play.google.com/console/signup](https://play.google.com/console/signup)
2. Sign in with the Google account you want to own the app
3. Pay the **$25 one-time** registration fee
4. Complete identity verification (can take 1-3 days)
5. Once verified, you'll have access to the Play Console

---

## Step 2: Get Your Vercel Production URL

Your Vercel project is `abca-booking`. Your production URL is likely:

```
https://abca-booking.vercel.app
```

If you've set up a custom domain, use that instead. You can check in:
**Vercel Dashboard → abca-booking → Settings → Domains**

> **Important**: For Play Store, a custom domain (e.g., `playorbit.com`) looks much more professional and is strongly recommended. You can add one in Vercel for ~$10-15/year.

---

## Step 3: Install Bubblewrap CLI (on your local machine)

```bash
# Install Node.js 18+ if not already installed

# Install Bubblewrap globally
npm install -g @nickvdh/nickvdh-bubblewrap-cli

# If the above fails, use the Google fork:
npm install -g @nickvdh/nickvdh-nickvdh-bubblewrap-cli
```

If npm packages have moved, use the PWABuilder web tool instead (Step 3 Alternative below).

### Step 3 Alternative: Use PWABuilder (Easier, No CLI Needed)

1. Go to [https://www.pwabuilder.com](https://www.pwabuilder.com)
2. Enter your deployed URL (e.g., `https://abca-booking.vercel.app`)
3. Click **"Start"** — it will audit your PWA
4. Click **"Package for stores"** → select **"Android"**
5. Choose **"Google Play"** (TWA option)
6. Configure:
   - **Package ID**: `com.playorbit.app`
   - **App name**: `PlayOrbit`
   - **App version**: `1.0.0`
   - **Version code**: `1`
   - **Host**: your Vercel URL
   - **Start URL**: `/`
   - **Theme color**: `#1e3a5f`
   - **Background color**: `#0a1628`
   - **Splash screen color**: `#0a1628`
   - **Icon**: Upload your 512x512 icon
   - **Maskable icon**: Upload your 512x512 maskable icon
   - **Signing key**: Select **"New"** — PWABuilder generates one for you
7. Click **"Download"** — you get a ZIP with:
   - `app-release-signed.aab` (the Android App Bundle)
   - `signing-key.jks` (your signing keystore — **KEEP THIS SAFE**)
   - `signing-key-info.txt` (keystore passwords)
   - `assetlinks.json` (for Digital Asset Links verification)

> ⚠️ **CRITICAL**: Back up your `signing-key.jks` and `signing-key-info.txt` immediately. If you lose these, you can NEVER update your app on Google Play.

---

## Step 4: Set Up Digital Asset Links (Required for TWA)

This proves to Android that your website and app are owned by the same entity. Without this, your app will show the browser URL bar.

### 4a. Get your SHA-256 fingerprint

If you used PWABuilder, it's in the `signing-key-info.txt` file.

If you used Bubblewrap or have a `.jks` keystore:
```bash
keytool -list -v -keystore signing-key.jks -alias my-key-alias
# Enter the keystore password when prompted
# Copy the SHA256 fingerprint (looks like: AB:CD:EF:12:34:...)
```

### 4b. Create the assetlinks.json file

Create the file at `public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.playorbit.app",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

### 4c. Serve it from your Next.js app

Add this route to your Next.js app. Create the file:

**`src/app/.well-known/assetlinks.json/route.ts`**

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.playorbit.app",
          sha256_cert_fingerprints: [
            "YOUR_SHA256_FINGERPRINT_HERE"
          ],
        },
      },
    ]
  );
}
```

### 4d. Deploy and verify

```bash
# Deploy to Vercel
git add . && git commit -m "Add Digital Asset Links for TWA" && git push

# Verify it works (after deployment)
curl https://YOUR-DOMAIN/.well-known/assetlinks.json
```

The response should return the JSON you created.

---

## Step 5: Prepare Play Store Listing Assets

You'll need these assets before you can publish:

### Required Assets

| Asset | Specs |
|-------|-------|
| **App icon** | 512x512 PNG, 32-bit, no transparency |
| **Feature graphic** | 1024x500 PNG or JPG |
| **Phone screenshots** | Min 2, max 8. 16:9 or 9:16, min 320px, max 3840px |
| **Short description** | Max 80 characters |
| **Full description** | Max 4000 characters |

### Suggested Content

**Short description:**
```
Book professional cricket practice sessions with bowling machines
```

**Full description:**
```
PlayOrbit makes it easy to book professional cricket practice sessions with advanced bowling machines.

Features:
• Browse available time slots in real-time
• Book sessions instantly with secure authentication
• View and manage your upcoming bookings
• Get session reminders and notifications
• Track your practice history

Whether you're a beginner looking to improve or a seasoned player maintaining your edge, PlayOrbit connects you with professional-grade practice facilities at your convenience.

Download now and take your cricket game to the next level!
```

### Creating Screenshots

The easiest way:
1. Open your deployed app on Chrome
2. Open DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
3. Select "Pixel 7" or similar device
4. Navigate to key screens (login, home, booking, etc.)
5. Take screenshots (Ctrl+Shift+P → "Capture screenshot")
6. Take at least 4 screenshots showing different features

---

## Step 6: Upload to Google Play Console

1. Go to [https://play.google.com/console](https://play.google.com/console)
2. Click **"Create app"**
3. Fill in:
   - **App name**: PlayOrbit
   - **Default language**: English (India) or English (US)
   - **App or Game**: App
   - **Free or Paid**: Free (or Paid if applicable)
   - Accept declarations
4. Click **"Create app"**

### 6a. Complete Store Listing

Go to **Grow → Store presence → Main store listing**:
- Upload app icon, feature graphic, screenshots
- Add short & full descriptions
- Select category: **Sports** or **Health & Fitness**

### 6b. Complete App Content Section

Go to **Policy → App content** and complete ALL sections:
- **Privacy policy**: You MUST have a privacy policy URL. Create one at [https://www.freeprivacypolicy.com](https://www.freeprivacypolicy.com) or host one on your site.
- **Ads declaration**: Declare whether your app contains ads
- **App access**: If your app requires login, provide test credentials
- **Content ratings**: Complete the IARC questionnaire
- **Target audience**: Select appropriate age groups
- **News apps**: Select "No" unless applicable
- **Data safety**: Declare what data your app collects

### 6c. Upload the App Bundle

Go to **Release → Production**:
1. Click **"Create new release"**
2. If prompted about app signing, select **"Use Google-managed signing"** (recommended) or upload your signing key
3. Upload the `.aab` file from PWABuilder
4. Set **Version name**: `1.0.0`
5. Add **Release notes**: "Initial release of PlayOrbit"
6. Click **"Review release"** → **"Start rollout to Production"**

### 6d. Select Countries

Go to **Release → Production → Countries/regions**:
- Add India (or whichever countries you target)

---

## Step 7: Review & Submit

Google will review your app. This typically takes:
- **First submission**: 3-7 days
- **Updates**: 1-3 days

Common rejection reasons and fixes:
- **Missing privacy policy** → Add one to your website and link it
- **Login required without test account** → Provide demo credentials in "App access"
- **Broken functionality** → Ensure your Vercel deployment is stable
- **Asset Links not configured** → Step 4 must be complete before submission

---

## Post-Launch Checklist

- [ ] Verify Digital Asset Links are working (no browser bar showing)
- [ ] Test the app on a real Android device
- [ ] Set up crash reporting (Firebase Crashlytics or similar)
- [ ] Monitor Play Console for reviews and crash reports
- [ ] Plan for regular updates (new .aab uploads)

---

## Quick Reference: Key Values

| Field | Value |
|-------|-------|
| Package name | `com.playorbit.app` |
| App name | PlayOrbit |
| Theme color | `#1e3a5f` |
| Background color | `#0a1628` |
| Start URL | `/` |
| Display mode | `standalone` |

---

## Need a Custom Domain?

For a more professional Play Store presence, consider:
1. Buy `playorbit.com` (or similar) from Namecheap/GoDaddy/Google Domains
2. Add it as a custom domain in Vercel Dashboard → Settings → Domains
3. Vercel handles SSL automatically
4. Update the `assetlinks.json` host accordingly
