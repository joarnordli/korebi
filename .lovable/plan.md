

# Add Comprehensive Capacitor & App Store Guide to README

## What to add

Expand the README with two major new sections:

### Section 1: Capacitor Native App Setup & App Store Submission
A step-by-step guide covering:
- **Prerequisites**: Xcode (latest), Apple Developer account ($99/yr), CocoaPods, Node.js
- **Local setup**: Clone repo, `npm install`, remove the `server.url` from `capacitor.config.ts` for production builds, `npm run build`, `npx cap add ios`, `npx cap sync`
- **Xcode configuration**: Open with `npx cap open ios`, set Bundle ID, signing team, deployment target, app icons, launch screen
- **Production build steps**: `npm run build` → `npx cap sync` → Archive in Xcode → Upload to App Store Connect
- **App Store Connect**: Create app listing, screenshots, privacy policy, age rating, submit for review
- **Common pitfalls**: Safari WebView considerations, camera/photo permissions in `Info.plist`, status bar handling

### Section 2: Apple In-App Purchases (replacing/supplementing Stripe)
A guide explaining:
- **Why**: Apple requires IAP for digital content sold within iOS apps (App Store Review Guideline 3.1.1) — Stripe alone will get rejected
- **Options**: (A) Use IAP exclusively on iOS, keep Stripe for web. (B) Use IAP on iOS + Stripe on web with a shared backend to sync entitlements
- **Implementation approach using `@capgo/capacitor-purchases` (RevenueCat SDK)**:
  - Install the plugin, configure in App Store Connect (create subscription product, shared secret)
  - Initialize RevenueCat with API key on app start
  - Purchase flow: call `Purchases.purchasePackage()` instead of Stripe checkout when on iOS
  - Verify entitlements server-side via RevenuCat webhooks or API
  - Platform detection: use `Capacitor.getPlatform()` to route to IAP vs Stripe
- **Alternative**: Direct `cordova-plugin-purchase` / `@capgo/capacitor-purchases` without RevenuCat (more manual but no third-party dependency)
- **Syncing subscriptions**: Edge function to verify both Stripe and Apple receipts, update the `subscriptions` table

### Files Changed
- `README.md` — append the two new sections

