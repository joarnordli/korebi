

## Plan: Random Notification Hour (10 AM – 10 PM)

**Good news: No always-running server needed.** The existing hourly cron job already runs every hour. Instead of checking "is it 11 AM for this user?", we compute a **deterministic random hour per user per day** (using a hash of user_id + today's date) in the range 10–21 (10 AM to 9 PM, so notifications arrive between 10:00 AM and 9:59 PM). Each hourly cron run checks if the current hour matches that user's random hour for today.

### Changes

**1. Edge function `send-reminders/index.ts`**
- Remove `const TARGET_HOUR = 11`
- Add a `getRandomHourForUser(userId, date)` function: hash `userId + YYYY-MM-DD` to produce a number 10–21 (12 possible hours)
- Change the filter from `getCurrentHourInTimezone(tz) === TARGET_HOUR` to `getCurrentHourInTimezone(tz) === getRandomHourForUser(sub.user_id, today)`

**2. Profile UI text (`Profile.tsx`)**
- Change label from "Get a gentle nudge at 11 AM to capture your day" to something like "Get a daily reminder between 10 AM and 10 PM to capture your moment"

### Why this works without extra cost
- The cron job still runs once per hour (same as before)
- Each run, it checks all enabled subscriptions and only sends to users whose deterministic random hour matches the current hour in their timezone
- Different users get different hours, different days get different hours — feels natural
- No persistent server, no extra storage needed

### Files to modify
| File | Change |
|------|--------|
| `supabase/functions/send-reminders/index.ts` | Replace fixed hour with deterministic random hour function |
| `src/pages/Profile.tsx` | Update description text |

