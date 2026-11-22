# App privacy — Heightmaxxing AI

Derived from the code (sign-up form, Supabase schema, API routes), not from the
policy text. Keep in step with https://www.heightmaxxing-ai.app/privacy.

## Plain-language summary

Heightmaxxing AI collects only what it needs to make growth predictions and run
your account. Free-tier builds may show AdMob ads; Premium removes them. We
never sell your data, and we don't track you across other apps beyond what the
ad SDK requires to serve ads.

- **Without an account (guest mode):** predictions are calculated and shown,
  but nothing is saved to a profile, and we never ask for a name or date of birth.
- **With an account:** we store your name and email address (for sign-in), the
  child profiles you create (name, sex, date of birth, optional ethnicity), the
  measurements you enter (child height and weight, parents' heights and
  weights), and the predictions made from them, so you can see each child's
  history.
- **Who processes it:** Clerk (sign-in), Supabase (database), Vercel (hosting),
  Google Cloud (runs the growth model; receives measurements only) and OpenAI
  (AI estimates; receives measurements, parents' heights and ethnicity if
  given, never names or account details).
- **Deleting it:** Account → Delete my account permanently erases your account,
  every child profile and every saved prediction immediately.

The app is for parents and guardians. It is not directed at children.

## App Store Connect → App Privacy answers

Data collection: **Yes**. Tracking: **No** for every type. Purpose: **App
Functionality** for every type.

| Apple category → type | What it is | Linked to user |
|---|---|---|
| Contact Info → Name | Account holder's first and last name (sign-up) | Yes |
| Contact Info → Email Address | Sign-in | Yes |
| Health & Fitness → Health | Child height, weight, BMI, predictions; parents' heights and weights | Yes |
| Sensitive Info → Sensitive Info | Optional ethnicity (racial/ethnic data) | Yes |
| User Content → Other User Content | Child names and dates of birth | Yes |
| Identifiers → User ID | Account ID | Yes |

Purchases: Premium subscription status is handled by Apple/Google and
RevenueCat (purchase receipts / app user id). Declare Purchases →
Purchase History if Apple's questionnaire requires it for IAP.

Not collected: location, contacts, browsing/search history, financial info
beyond store subscription status, usage data, diagnostics, photos, audio.
Device identifiers may be used by AdMob to serve ads on the free tier.

If `ENABLE_GUEST_DATA_COLLECTION=true` is set in production, also declare
Health and Sensitive Info as **Not linked to user**, purpose **Analytics**
(anonymized guest predictions kept for model improvement), and update the
policy's "Guest mode" section, which currently says this is off.

## Google Play → Data safety answers

Overview questions:
- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**,
  in the app (Account → Delete my account) and at
  https://www.heightmaxxing-ai.app/delete-account
- Shared: **No** for every type. Clerk, Supabase, Vercel, Google Cloud and OpenAI
  process data on our behalf as service providers, which Google doesn't count as
  sharing.

| Data type | Collected | Optional? | Ephemeral? | Purposes |
|---|---|---|---|---|
| Personal info → Name | Yes | Optional (accounts are optional) | No | App functionality, Account management |
| Personal info → Email address | Yes | Optional | No | App functionality, Account management |
| Personal info → User IDs | Yes | Optional | No | App functionality, Account management |
| Personal info → Race and ethnicity | Yes | Optional | No | App functionality |
| Personal info → Other info (child names, dates of birth) | Yes | Optional | No | App functionality |
| Health and fitness → Health info (heights, weights, BMI, predictions) | Yes | Required | No | App functionality |

Health info is "required" because every prediction sends measurements to our
server, guest mode included. It is stored only for signed-in users, unless
`ENABLE_GUEST_DATA_COLLECTION=true` (see above). In that case, also tick
**Analytics** for Health info and Race and ethnicity.

Also declare for free-tier ads (AdMob):
- App activity / Device or other IDs as collected and shared with Google for
  Advertising, when ads are enabled.

Also declare Purchases → In-app purchase history for Premium subscriptions
(processed by Google Play Billing / RevenueCat).

Not collected: location, messages, photos/videos, audio, files, calendar,
contacts, web browsing, crash diagnostics beyond store defaults.
