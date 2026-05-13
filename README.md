## About App

### `Name`: WebShooter

### `Description`: Takes screenshots of webpages for you while you do other things 👌 :blue_heart:

--

## Important Operational Parameters:

### `MaxCrons`: This is the maximum number of crons a user can set (1 for now)

### `SafeAddCron`: This checks the cron schedule variation against the max number of cron schedules offered in CloudFlare's worker free tier (5);

#### `note`: Max cron schedules is 5 but any one of these can cater to a larger number of users (limited by the TTL of invoked worker - 10ms in free tier).

### `SafeAddSite`: This checks the maxi...

---

## Database structure:

### `private.settings`: sets maxCrons (total app cron limit), storeDuration (in days), admin notifications (Error logs)

### `User sites`: share a shot_url column unlike {site}\_html_key, {site}\_shot_key which are per site.

## DB query Functions to rateLimit:

### `getUnviewedIds`: (main)/page.tsx

---

## Operational flaws ?

### Effects with deps `(download*)` are triggered by number mutations and not reset to null -- which may be problematic in special cases.

### Global restore position `function for switching to prev active slide after mutation` set in Gallery.tsx

### Limited Shots Download: Vercel API payload cap is 4.5mb, this means at most a single image data from R2 can be retrieved -- requiring much invocations.

--

--

## Access Privileges

### `Settings table`: holds maxCrons:text, storeDays:number, admin:[] (admins(uuid) here can modify Settings and access errorLogs);

---

## Security flaws (potential)

### `getShots`: sends 'htmlKey' to client, which can be used to access user shotdata from R2 bucket. Mitigating this through signed API validation in worker. ~can encrypt htmlKey on db write and send that instead~
