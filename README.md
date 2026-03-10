# Okiro

A daily photo journal app built with React, Vite, Tailwind CSS, and TypeScript. Capture one photo per day and build a visual diary of your life.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **Payments**: Stripe (web), Apple In-App Purchase (iOS)
- **Native**: Capacitor

## Development

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

---

## Wrapping with Capacitor & Publishing to the Apple App Store

This guide covers turning the Okiro web app into a native iOS app, submitting it to the App Store, and integrating Apple In-App Purchases.

### Prerequisites

| Requirement | Details |
|---|---|
| **macOS** | Required for Xcode and iOS builds |
| **Xcode** | Latest version from the Mac App Store |
| **Apple Developer Account** | [$99/year enrollment](https://developer.apple.com/programs/) |
| **CocoaPods** | `sudo gem install cocoapods` |
| **Node.js** | v18+ recommended ([install with nvm](https://github.com/nvm-sh/nvm)) |

### Step 1: Local Project Setup

```sh
# Clone and install
git clone <YOUR_GIT_URL>
cd okiroapp
npm install
```

### Step 2: Configure Capacitor for Production

The project already has `capacitor.config.ts`. For production builds you **must** remove the `server.url` property so the app loads from the bundled files instead of the dev server:

```ts
// capacitor.config.ts — PRODUCTION
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.4564fef5d4e24e729e1641eb633eefb7',
  appName: 'okiroapp',
  webDir: 'dist',
  // No server.url — loads from local bundle
};

export default config;
```

> **Tip**: Keep the `server.url` config for local development/hot-reload. Remove it only when building for App Store submission.

### Step 3: Build & Add iOS Platform

```sh
# Build the web app
npm run build

# Add iOS platform (first time only)
npx cap add ios

# Sync web assets to native project
npx cap sync
```

### Step 4: Xcode Configuration

```sh
# Open in Xcode
npx cap open ios
```

In Xcode, configure the following:

1. **Bundle Identifier**: Select the app target → General → set your Bundle ID (e.g., `com.yourcompany.okiro`). This must match what you register in Apple Developer Portal.
2. **Signing & Capabilities**:
   - Select your Team (Apple Developer account)
   - Enable "Automatically manage signing"
3. **Deployment Target**: Set minimum iOS version (recommended: iOS 15+)
4. **App Icons**: Replace the default icons in `Assets.xcassets/AppIcon` with your Okiro logo in all required sizes. Use a tool like [App Icon Generator](https://appicon.co/) to generate all sizes from a single 1024×1024 image.
5. **Launch Screen**: Customize `LaunchScreen.storyboard` or replace it with your branded splash screen.

### Step 5: Info.plist Permissions

Okiro uses the camera and photo library. Add these to `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Okiro needs camera access to capture your daily photo.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Okiro needs photo library access so you can choose a photo for your memory.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Okiro can save photos to your library.</string>
```

### Step 6: Build for App Store

1. **Build the web app**: `npm run build`
2. **Sync**: `npx cap sync`
3. **Archive in Xcode**:
   - Select a physical device or "Any iOS Device" as the build target (not a simulator)
   - Menu → Product → Archive
   - Once the archive completes, the Organizer window opens
4. **Upload**:
   - In the Organizer, click "Distribute App"
   - Choose "App Store Connect" → Upload
   - Follow the prompts to upload

### Step 7: App Store Connect

Go to [App Store Connect](https://appstoreconnect.apple.com/):

1. **Create a New App**: Apps → "+" → New App. Select your Bundle ID, set the app name.
2. **App Information**: Set category (Lifestyle or Photo & Video), subtitle, privacy policy URL.
3. **Pricing**: Set pricing or select Free (if using IAP for subscriptions).
4. **Screenshots**: Upload screenshots for required device sizes:
   - 6.7" (iPhone 15 Pro Max): 1290 × 2796
   - 6.5" (iPhone 14 Plus): 1284 × 2778
   - 5.5" (iPhone 8 Plus): 1242 × 2208
   - iPad Pro 12.9": 2048 × 2732
5. **Age Rating**: Complete the questionnaire (Okiro has no objectionable content → likely 4+).
6. **Build**: Select the uploaded build.
7. **Submit for Review**: Click "Submit for Review". First reviews typically take 24–48 hours.

### Common Pitfalls

| Issue | Solution |
|---|---|
| **White screen on launch** | Ensure `npm run build` ran successfully and `npx cap sync` copied the `dist/` folder |
| **Camera not working** | Check `Info.plist` permissions are added (Step 5) |
| **Status bar overlaps content** | Use the `@capacitor/status-bar` plugin or add `viewport-fit=cover` + safe area CSS |
| **WKWebView networking** | Capacitor uses WKWebView. Ensure your API URLs use HTTPS in production |
| **App rejected for payments** | See the In-App Purchases section below — you cannot use Stripe for digital subscriptions on iOS |

---

## Apple In-App Purchases (IAP)

### Why You Need IAP on iOS

**Apple App Store Review Guideline 3.1.1** requires that digital content and subscriptions sold within iOS apps use Apple's In-App Purchase system. Using Stripe (or any external payment processor) for digital subscriptions will result in **app rejection**.

**Strategy**: Use IAP on iOS, keep Stripe on web. A shared backend syncs entitlements so the `subscriptions` table remains the single source of truth.

### Option A: RevenueCat (Recommended)

[RevenueCat](https://www.revenuecat.com/) wraps Apple's StoreKit and provides a server-side receipt validation API, webhooks, and a dashboard. Free up to $2,500/mo in tracked revenue.

#### 1. App Store Connect Setup

1. Go to App Store Connect → Your App → Subscriptions
2. Create a **Subscription Group** (e.g., "Okiro Premium")
3. Create a **Subscription Product**:
   - Reference Name: `Okiro Weekly`
   - Product ID: `com.yourcompany.okiro.weekly` (you choose this)
   - Duration: 1 Week
   - Price: Tier matching 7 NOK/week (Apple sets regional pricing from your base price)
4. Under App Information → App Store Server Notifications, set the URL to your RevenueCat webhook endpoint

#### 2. RevenueCat Setup

1. Create a RevenueCat account at [revenuecat.com](https://www.revenuecat.com/)
2. Create a new project, add your iOS app with the Bundle ID
3. Add your App Store Connect API key (Shared Secret from App Store Connect → App → General → App-Specific Shared Secret)
4. Create an **Offering** containing your weekly subscription **Package**
5. Copy your RevenueCat **Public API Key** (starts with `appl_`)

#### 3. Install the Capacitor Plugin

```sh
npm install @capgo/capacitor-purchases
npx cap sync
```

#### 4. Platform-Aware Purchase Flow

```ts
import { Capacitor } from '@capacitor/core';

// Detect platform
const isNativeIOS = Capacitor.getPlatform() === 'ios';

if (isNativeIOS) {
  // Use Apple IAP via RevenueCat
  await triggerIAPPurchase();
} else {
  // Use Stripe checkout (existing flow)
  await handleStripeCheckout();
}
```

#### 5. Initialize RevenueCat (iOS only)

```ts
import { Purchases } from '@capgo/capacitor-purchases';

// Call once on app startup (e.g., in App.tsx or main.tsx)
if (Capacitor.getPlatform() === 'ios') {
  await Purchases.configure({
    apiKey: 'appl_YOUR_REVENUECAT_API_KEY',
    appUserID: user.id, // Your Supabase user ID
  });
}
```

#### 6. Purchase Flow (iOS)

```ts
async function triggerIAPPurchase() {
  try {
    // Get available offerings
    const offerings = await Purchases.getOfferings();
    const weeklyPackage = offerings.current?.availablePackages.find(
      (p) => p.packageType === 'WEEKLY'
    );

    if (!weeklyPackage) {
      throw new Error('Weekly subscription not available');
    }

    // Trigger native Apple purchase sheet
    const { customerInfo } = await Purchases.purchasePackage({
      aPackage: weeklyPackage,
    });

    // Check if entitlement is now active
    if (customerInfo.entitlements.active['premium']) {
      // Sync to your backend
      await syncSubscriptionToBackend(user.id);
    }
  } catch (error) {
    if (error.code === 'PURCHASE_CANCELLED_ERROR') {
      // User cancelled — do nothing
      return;
    }
    throw error;
  }
}
```

#### 7. Server-Side Sync via Webhook

Create an edge function to receive RevenueCat webhooks and update your `subscriptions` table:

```ts
// supabase/functions/revenuecat-webhook/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  const body = await req.json();
  const event = body.event;

  // Verify webhook authenticity via Authorization header
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("REVENUECAT_WEBHOOK_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userId = event.app_user_id; // This is the Supabase user ID you set

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        active: true,
        is_trialing: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      break;

    case "CANCELLATION":
    case "EXPIRATION":
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        active: false,
        is_trialing: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      break;
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

#### 8. Check Entitlements (iOS)

Modify your subscription check to also query RevenueCat on iOS:

```ts
async function checkSubscriptionStatus() {
  if (Capacitor.getPlatform() === 'ios') {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active['premium'];
  }
  // Web: use existing check-subscription edge function
  const { data } = await supabase.functions.invoke('check-subscription');
  return data?.subscribed;
}
```

### Option B: Direct StoreKit (No RevenueCat)

If you prefer no third-party dependency, use [`cordova-plugin-purchase`](https://github.com/nicklockwood/cordova-plugin-purchase) or Apple's StoreKit 2 directly. This requires:

- Manual receipt validation (send receipts to Apple's `/verifyReceipt` endpoint from an edge function)
- Manual renewal tracking
- More code, but zero revenue-sharing with RevenueCat

### Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  iOS App     │────▶│  RevenueCat  │────▶│  Webhook Edge   │
│  (StoreKit)  │     │  (validates) │     │  Function       │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
┌─────────────┐     ┌──────────────┐               │
│  Web App     │────▶│  Stripe      │               │
│  (Checkout)  │     │  (charges)   │               ▼
└─────────────┘     └──────┬───────┘     ┌─────────────────┐
                           │             │  subscriptions   │
                           └────────────▶│  table (single   │
                                         │  source of truth)│
                                         └─────────────────┘
```

### Checklist Before App Store Submission

- [ ] Remove `server.url` from `capacitor.config.ts`
- [ ] Set correct Bundle ID matching Apple Developer Portal
- [ ] Add all `Info.plist` permission descriptions
- [ ] Generate all app icon sizes
- [ ] Configure IAP products in App Store Connect
- [ ] Test purchases in Sandbox environment (App Store Connect → Users and Access → Sandbox Testers)
- [ ] Implement platform-aware payment routing (IAP on iOS, Stripe on web)
- [ ] Set up RevenueCat webhook → edge function → `subscriptions` table sync
- [ ] Prepare privacy policy URL
- [ ] Take screenshots for all required device sizes
- [ ] Test on a physical device before submitting

### Further Reading

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [RevenueCat Getting Started](https://docs.revenuecat.com/docs/getting-started)
- [Building a Capacitor App with Lovable](https://docs.lovable.dev/tips-tricks/mobile-development)
