# Google Play listing — Heightmaxxing AI

Main store listing in Play Console (Grow users → Store presence → Main store listing).
Copy is adapted from the App Store listing in ../listing.md; keep the two in step.

## App name (30 max) — 16
Heightmaxxing AI

## Short description (80 max) — 73
Predict your child's adult height, with a likely range and a growth curve

## Full description (4000 max) — 1820
How tall will your child be as an adult? Heightmaxxing AI turns a few simple measurements into a clear, honest estimate, with the range of likely outcomes and the growth path to get there.

PREDICT ADULT HEIGHT
Enter your child's age, height and weight. A machine-learning model trained on growth data estimates their height and weight at the age you choose, along with an 80% likely range, so you see the realistic spread rather than a single number.

SEE THE GROWTH CURVE
A year-by-year chart shows the projected path from today to adulthood, shaded with the likely range and set against the typical range for each age.

KNOW WHERE THEY STAND
Percentiles compare your child with peers of the same age and sex, now and at the predicted age, using the CDC growth reference. "Taller than about 75 in 100 peers" is easier to read than a raw number.

A SECOND OPINION FROM AI
Add both parents' heights and an AI model gives its own estimate, explaining in plain language how genetics and current growth combine.

EXPECTING OR HAVE A BABY?
No measurements needed. Estimate adult height from the parents' heights using the mid-parental (Tanner) method, the approach pediatricians use, and add birth length and weight if you have them.

TRACK EVERY CHILD
Create a free account to save a profile for each child, keep every prediction in your history, and watch how the estimate changes as they grow. Or use guest mode without signing up.

GOOD TO KNOW
• Metric or imperial units
• English and Simplified Chinese
• Delete your account and data at any time, right in the app

The growth model covers children up to age 15.

Heightmaxxing AI provides estimates for informational purposes only. It is not medical advice and does not diagnose any condition. If you have concerns about your child's growth, talk to your pediatrician.

## Graphics (all in this folder)
| Asset | File | Spec |
|---|---|---|
| App icon | play-icon-512.png | 512×512 PNG |
| Feature graphic | play-feature-graphic.png | 1024×500, no alpha |
| Phone screenshots | screenshots/01-form.png … 04-baby.png | 1080×1920 (9:16) |

The iPhone screenshots in ../screenshots can't be reused here: Play rejects
images whose long side is more than twice the short side (1320×2868 is 2.17).
Regenerate with `node shoot.mjs <apps/mobile> <store/android/screenshots> "" android`
(absolute paths; the web export lands in ../dist relative to the output dir)
and `node build-banners.mjs screenshots ../assets/icon.png marketing`, then move
marketing/play-feature-graphic.png here.

## Store settings
- App category: **Health & Fitness** (alternative: Parenting)
- Tags: Parenting, Health & fitness
- Contact email: kangleelab0@gmail.com · Website: https://www.heightmaxxing-ai.app/app
- Privacy policy: https://www.heightmaxxing-ai.app/privacy

## App content answers
- **Privacy policy:** https://www.heightmaxxing-ai.app/privacy
- **Ads:** No, the app contains no ads.
- **App access:** Some features are restricted. Guest mode needs no sign-in;
  saved children and history need an account. Sign-in is by emailed code, so give
  reviewers a Clerk test account (see "Reviewer account" below).
- **Content rating (IARC):** Reference / utility, no violence, sexuality,
  language, controlled substances, gambling, user-to-user interaction or location
  sharing. Expect "Everyone" / PEGI 3.
- **Target audience:** 18 and over only. The app is for parents and guardians;
  selecting under-13 age groups pulls it into the Families policy.
- **News app:** No. **Government app:** No. **Financial features:** None.
- **Health apps:** Declare it. Choose the category closest to growth tracking /
  general health and wellness information. It is not a medical device and makes
  no diagnosis.
- **Data safety:** see ../privacy.md, "Google Play → Data safety answers".
- **Account deletion URL:** https://www.heightmaxxing-ai.app/delete-account

## Reviewer account
Clerk supports test emails: any address with `+clerk_test` (for example
`review+clerk_test@heightmaxxing-ai.app`) accepts the fixed code `424242` and
sends no email. Test mode must be allowed on the production instance (Clerk
dashboard → Settings → Test mode). Put the address and code in App access.
