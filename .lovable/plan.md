## What I found

The notification system is not failing because your phone is missing setup. The active subscription exists in the backend, but a manual delivery test failed with:

```text
VapidPkHashMismatch
```

That means the phone/browser subscription was created with a different push key than the key the backend is using to send notifications. Apple Push rejects the notification before it reaches your device.

I also found that the hourly reminder job is running, but recent scheduled calls are timing out after 5 seconds. That can happen because the function intentionally waits/randomizes delivery and can take too long for the scheduler call window.

## Plan

1. **Unify the push keys**
   - Stop hardcoding the VAPID public key separately in the app/service worker.
   - Expose the active backend public push key through a small backend function, then have the Profile screen use that key when subscribing.
   - Keep the service worker aligned with the same source so future key changes do not silently break installed devices.

2. **Force clean re-subscription when the key changes**
   - When enabling reminders, compare the current browser subscription with the active push key.
   - If it was created with an old key, unsubscribe it first, then create a fresh subscription.
   - Upsert the fresh endpoint into `push_subscriptions` and remove stale rows for that user where needed.

3. **Add a safe test notification path**
   - Add a backend function path/mode that can send a clear test notification, for example: `Okiro test notification`.
   - Initially support testing the signed-in user only, so we can confirm your device without spamming every customer.
   - Add a small “Send test notification” button in Profile under Daily reminders.

4. **Make scheduled delivery reliable**
   - Remove per-notification waiting from the scheduler path or cap it safely so the hourly job does not exceed the network timeout.
   - Keep the once-per-day protection using `last_sent_date`.
   - Improve logs so each run shows eligible, sent, failed, and expired counts clearly.

5. **Optional mass test only after the single-device test succeeds**
   - I do not recommend sending a “Test” to all customers yet.
   - After your own device receives a test notification, we can add an admin-only/manual broadcast path with a confirmation step and clear wording.

## Validation

After implementation I will:
- Re-enable reminders to create a fresh push subscription.
- Trigger the single-user test send.
- Check backend logs for delivery status.
- Confirm the database row is updated only after successful delivery.