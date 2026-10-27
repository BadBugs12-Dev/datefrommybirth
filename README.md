# Date From My Birth

A live, responsive age dashboard anchored to **May 21, 2012 at 3:02:00 PM EDT**, Maryland (**2012-05-21T19:02:00Z**).

## Run locally

Node 22+; no third-party dependencies.

```sh
npm run dev
```

Open http://127.0.0.1:4173. Run `npm test` for calendar and elapsed-time checks.

## Vercel

Import this repository, select **Other**, and leave the root directory at the repository root. `vercel.json` serves `public/` and Vercel deploys `api/time.js` as a Node function. No build step, dependencies, environment variables, API keys, or database are needed. The existing Vercel Git integration deploys pushes to `main`.

## Calculation contract

- The birth instant is fixed; users never manually provide the current time.
- `/api/time` returns the server clock in Unix milliseconds, with caching disabled. The client takes three initial samples and chooses the lowest round trip; it estimates transit with RTT/2 and advances with `performance.now()`. It resyncs every minute, on returning to the tab, and on reconnect. If initial sync fails, device time is explicitly marked unverified; a later failure is shown without hiding the last sample.
- Every displayed result uses the **same whole-second timestamp** (milliseconds truncated, never rounded). Freeze pins that second; copy exports a self-contained snapshot.
- Calendar age uses Gregorian whole years, then months, then days in `America/New_York`, retaining the 15:02 birth time at each step. The remainder is exact elapsed hours/minutes/seconds. Afternoon anchors avoid DST gaps and folds. A fall-back day may leave 24 remainder hours; this is intentional.
- Elapsed totals subtract UTC instants. Full days are completed **24-hour periods**, not calendar-midnight crossings. Hours and minutes show approximate decimal equivalents plus exact whole-unit remainders. Seconds are exact integers.
- Decimal years use the birthday-interval convention: whole years + elapsed seconds since last birthday / seconds until the following birthday measured from the last one. The exact rational expression is included; a finite decimal is an approximation.
- The next birthday is May 21 at **15:02:00 Maryland time**, rather than midnight. Countdown days are 86,400-second elapsed days; DST is handled by subtracting zoned birthday instants.
- All totals use standard JavaScript/Unix civil time, which excludes leap seconds. No claim of atomic-clock accuracy is made: network asymmetry and server-clock error can affect the live estimate. Arithmetic is exact for the explicitly displayed timestamp.

No analytics, external fonts, tracking scripts, or third-party requests. Calendar calculations run in the browser. Birth details are intentionally part of this personalized public repository and page.
