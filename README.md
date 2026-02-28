## `Name`: ScreenShooter

## `Description`: Takes screenshots of webpages for you while you do other things 👌 :blue_heart:

## Important Operational Parameters:

### `MaxCrons`: This is the maximum number of crons a user can set (1 for now)

### `SafeAddCron`: This checks the cron schedule variation against the max number of cron schedules offered in CloudFlare's worker free tier (5);

#### `note`: Max cron schedules is 5 but any one of these can cater to a larger number of users (limited by the TTL of invoked worker - 10ms in free tier).

### `SafeAddSite`: This checks the maxi...

---

## Database structure:

### `private.settings`: sets maxCrons (total app cron limit), storeDuration (in days), admin notifications (Error logs)

## DB query Functions to rateLimit:

### `getUnviewedCount`: (main)/page.tsx

---

## Notes

### Effects with deps `(download*)` are triggered by number mutations and not reset to null -- which may be problematic in special cases.

### Global restore position `function for switching to prev active slide after mutation` set in Gallery.tsx
