# App Review notes — Heightmaxxing AI

Paste everything between the lines into App Store Connect → the version →
App Review Information → Notes. Fill in the [bracketed] parts first. Limit: 4000 characters.

---

SCREEN RECORDING
[link to the recording, e.g. a Google Drive / iCloud link viewable by anyone, or "attached"]
Recorded on [iPhone model], iOS [version]. It starts at app launch and shows: a guest prediction, the Baby estimate, account sign-up with email verification, adding a child, saving a prediction and viewing History, deleting that account (Account → Delete my account), and signing in to the demo account.

1. PURPOSE AND AUDIENCE
Heightmaxxing AI helps parents and guardians estimate how tall their child is likely to grow. From the child's sex, age, height and weight, a machine-learning model trained on growth data predicts height and weight at a chosen age, with an 80% likely range, a year-by-year growth curve and CDC percentiles. If both parents' heights are entered, an AI model gives a second estimate with a plain-language explanation. For babies and expecting parents, a Baby page uses the mid-parental (Tanner) method. Parents use it to understand where their child stands and what range of adult heights is realistic, instead of guessing or relying on single-number online calculators.
The audience is parents and guardians (adults). The app is not directed at children.

2. HOW TO USE IT AND LOGIN
No account is needed for the main features. Launch the app, keep the sample values or enter your own, and tap "Get prediction". Tap "A baby's adult height" on the home screen for the Baby estimate.
An optional free account saves child profiles and prediction history.
Demo account (tap Sign in on the home screen):
  Email: review+clerk_test@heightmaxxing-ai.app
  Password: [password]
  Verification code: 424242
After the password, the app asks for a 6-digit code because the reviewer's device is new to the account. No email is sent for this demo address; enter 424242. The same code works if you choose to sign in by code instead of password.
Account deletion: sign in → Account (on the home screen) → "Delete my account" → confirm. This permanently deletes the account, all child profiles and all saved predictions immediately.
Settings (gear icon) switches between English and Simplified Chinese and between metric and imperial units.
There is no paid content, no in-app purchase and no subscription. There is no content shared between users (no posts, messages, comments or public profiles), so content reporting and blocking do not apply.

3. EXTERNAL SERVICES
- Clerk (clerk.com): account sign-up, sign-in and email verification codes
- Supabase: database for saved child profiles and predictions
- Vercel: hosts the app's backend API (www.heightmaxxing-ai.app)
- Google Cloud Run: runs our own machine-learning growth model (receives measurements only)
- OpenAI API: the optional AI estimate and explanation (receives measurements, parents' heights and optional ethnicity; never names or account details)
- CDC growth reference data (public domain) for percentiles
No ads, analytics or tracking SDKs.

4. REGIONAL DIFFERENCES
None. The app works the same in every region. The language follows the in-app setting (English or Simplified Chinese).

5. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
The app is not a medical device and does not diagnose, treat or monitor any condition. It provides statistical estimates for informational purposes only, and the app and its listing say so and advise talking to a pediatrician with concerns. The percentiles use the CDC growth charts, a US government work in the public domain. The mid-parental method is a standard published formula. No protected third-party material is used, so no licences or credentials are required.

---

## Recording checklist (on a physical iPhone, latest iOS)

Control Center → Screen Recording. Start from the home screen so the launch is included.

1. Tap the app icon to launch it.
2. Guest prediction: fill the form, tap Get prediction, scroll the results (ML estimate, percentiles, growth curve, AI estimate).
3. Back → A baby's adult height → Not yet born → parents' heights → Estimate.
4. Sign up: name, email, password → enter the emailed code.
5. Add a child, run a prediction for them, open History.
6. Open Settings and switch language once, then back.
7. Account → Delete my account → confirm, and show you're signed out.
   (Delete this new account, not the demo account; the reviewer needs that one.)
8. Sign in with the demo account to show login works.
9. Stop recording. Trim it if you like, but keep the launch at the start.

Upload it somewhere a reviewer can open without signing in, or attach it in the App Review Information section, then paste the link above.
