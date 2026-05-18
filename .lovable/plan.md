# Playful push notification titles

## Problem
Every push currently uses `title: "Okiro"`, so iOS renders the lockscreen as:
**Okiro — from Okiro — {message}**
The title slot is wasted. We can use it as a hook, and let the body expand on it.

## Approach
For each notification source, replace the flat message list with **title + body pairs** where:
- **Title** = short, playful hook (≤ ~40 chars, can use emoji)
- **Body** = a sentence that expands the hook into an action

Result on lockscreen: **{Hooky title} — from Okiro — {expanding body}**

No schema changes. Only edge function content + the `push_send_events.title` we log.

## Files to change

### 1. `supabase/functions/send-reminders/index.ts`
Replace the `messages` string array (line 74) with a `reminders` array of `{title, body}` pairs. Pick one at random per send. Pass `chosen.title` into both the `push_send_events` insert (line 200) and the `buildPushHTTPRequest` payload (line 216).

Example pairs (10–12 entries, rotating tone — curious, warm, playful, quiet):
- `"Today, in one frame ✨"` → `"What's worth holding onto from today?"`
- `"Psst… got a second? 📸"` → `"One photo. One memory. That's it."`
- `"Future-you is watching 👀"` → `"Leave them something to smile about."`
- `"Tiny ritual time 🌱"` → `"Capture today before it slips away."`
- `"What did today look like? 🎞️"` → `"One frame is all it takes."`
- `"Pause for a sec 🤍"` → `"Snap the moment, then carry on."`
- `"Hey, quick one 💭"` → `"What's the photo of your day?"`
- `"Don't let today disappear 🌙"` → `"One picture is enough."`
- `"A moment, bottled 🫙"` → `"Add today to your memory shelf."`
- `"Sunset check-in 🌇"` → `"Catch today before it's gone."`

### 2. `supabase/functions/send-engagement/index.ts`
Three triggers, each gets its own title style:

**Streak (line 79 `streakMessage`)** — return `{title, body}` instead of string:
- `"🔥 {n}-day streak alive"` → `"One photo away from day {n+1}."`
- `"Keep the chain going ✨"` → `"You're {n} days in — don't stop now."`
- `"Day {n+1} is calling 📸"` → `"Snap today to extend your streak."`

**Comeback (line 87 `comebackMessages`)** — convert to pairs:
- `"We saved your spot 🤍"` → `"Pick up where you left off."`
- `"Long time, no frame 💭"` → `"What's worth remembering today?"`
- `"Your shelf misses you 🎞️"` → `"One photo and you're back."`

**Recap (line 209)**:
- title: `"Your {Month} recap is ready 🎞️"`
- body: `"Tap to relive last month, one frame at a time."`

Update the three `chosen = { … title: "Okiro", body: … }` blocks (lines 209, 225, 245) to use the new title from the helper/array. The `push_send_events` insert (line 267) and `buildPushHTTPRequest` payload (line 284) already read `chosen.title`, so no wiring changes there.

### 3. `supabase/functions/send-test-notification/index.ts`
Leave as-is — already uses `"Okiro test ✨"`, which is fine for the admin test path. (Optional: change to `"Test ping ✨"` so it doesn't show "Okiro from Okiro" either.) I'll make this small tweak.

### 4. `supabase/functions/send-broadcast/index.ts`
No change. Admin already supplies a custom title per broadcast.

## Out of scope
- Service worker (`public/sw.js`) — its hard-coded `"Okiro"` fallback only fires if a push arrives with no JSON payload, which never happens from our senders.
- Notification grouping/threading.
- Localization (current copy is English-only, matching existing strings).

## Verification
1. Trigger `send-test-notification` from admin → confirm new title renders on iOS lockscreen.
2. Manually invoke `send-reminders` in a dev window → confirm a paired title/body appears.
3. Check `push_send_events.title` in DB shows the new hooky titles (used for open-rate analytics).
