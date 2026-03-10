

# Taking Okiro to the App Stores with Capacitor

## How It Works

Your Okiro app is a standard React web app. Capacitor wraps it in a native shell so it can run as a real iOS/Android app. Your existing Lovable Cloud backend continues to work — the app just talks to the same APIs from inside a native container instead of a browser.

## Steps to Get There

### 1. Export the Code to GitHub
In Lovable, go to **Settings → GitHub → Connect project**. This creates a GitHub repository with your full codebase. From that point, Lovable and GitHub stay in sync — you can keep editing in Lovable and changes push to GitHub automatically.

### 2. Set Up Locally
Clone the repo and install dependencies:
```
git clone <your-repo-url>
cd <project-folder>
npm install
```

### 3. Add Capacitor (I'll do this part)
I'll add the Capacitor configuration to the project:
- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- Create `capacitor.config.ts` with your app ID and live-reload pointed at the Lovable preview for development

### 4. Add Native Platforms (You do this locally)
After pulling the changes:
```
npx cap add ios
npx cap add android
npx cap sync
```

### 5. Run on Device/Emulator
- **iOS**: `npx cap run ios` (requires Mac + Xcode)
- **Android**: `npx cap run android` (requires Android Studio)

### 6. Build for Store Submission
- **iOS**: Open in Xcode, configure signing with your Apple Developer account ($99/year), archive and submit via App Store Connect
- **Android**: Open in Android Studio, generate a signed APK/AAB, submit via Google Play Console ($25 one-time)

## What About the Backend?

Your Lovable Cloud backend (database, auth, edge functions, storage) is hosted independently. The mobile app connects to it via the same API URLs already in your `.env` file. Nothing changes — it just works.

The only consideration: if you ever want to fully self-host, you'd need to set up your own Supabase instance and migrate the data. But for now, Lovable Cloud continues serving your app regardless of where the frontend runs.

## What I'll Set Up Now (if you approve)

1. Install Capacitor dependencies
2. Create `capacitor.config.ts` with live-reload for development
3. Update `package.json` with build scripts

After that, you export to GitHub, clone locally, and follow the native platform steps above.

## Requirements on Your Side

| Platform | Tool | Cost |
|----------|------|------|
| iOS | Mac + Xcode + Apple Developer Program | $99/year |
| Android | Android Studio (any OS) + Google Play Console | $25 one-time |

