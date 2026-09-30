# iOS release — build and submission runbook

Status: infrastructure in place, nothing submitted yet.

What already exists in the repo:

- `apps/mobile/app.json` — release config: display name, `ai.heightmaxxing.app`
  bundle identifier, icon, splash screen, `buildNumber`, encryption-exemption
  flag. The icon and splash at `apps/mobile/assets/` are generated from the web
  logo (`apps/web/public/logo.png`), center-cropped to full bleed; the splash
  background `#6E9FBF` is sampled from the logo so the mark sits seamlessly.
- `apps/mobile/eas.json` — three build profiles. `development` builds a
  simulator dev client; `preview` builds an internal-distribution device build
  (ad hoc, for phones without TestFlight); `production` builds for the store
  and auto-increments the build number (`appVersionSource: remote` — EAS owns
  the build number, the `buildNumber` in app.json is just the starting value).

The bundle identifier, slug, and scheme can still be changed freely — they
become permanent only once a build is uploaded to App Store Connect.

## One-time setup

1. **Apple Developer Program** — enroll at
   [developer.apple.com](https://developer.apple.com/programs/enroll/) (US$99/yr).
   Personal or organization; organization requires a D-U-N-S number and shows
   a company name as the App Store seller.
2. **Expo account** — `npm i -g eas-cli`, then `eas login`.
3. **Link the project** — from `apps/mobile/`, run `eas init`. This writes
   `extra.eas.projectId` into app.json; commit that change.
4. **EAS environment variables** — the build profiles reference EAS
   environments rather than baking values into eas.json. Create both variables
   in the `production` (and optionally `preview`) environment:

   ```bash
   eas env:create --environment production \
     --name EXPO_PUBLIC_API_BASE_URL --value https://<the-vercel-deployment>
   eas env:create --environment production \
     --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_...
   ```

   `EXPO_PUBLIC_API_BASE_URL` is the deployed web app — the native app calls
   its `/api/*` route handlers. The Clerk key must be from a **production**
   Clerk instance; the committed `.env.example` shows a `pk_test` dev-instance
   key that Clerk will refuse in a release context.
5. **App Store Connect record** — created automatically on first
   `eas submit`, or by hand at appstoreconnect.apple.com. Signing certificates
   and provisioning profiles are generated and stored by EAS on first build;
   just answer yes when prompted.

## Building

```bash
cd apps/mobile
eas build --platform ios --profile production   # store build
eas build --platform ios --profile preview      # ad-hoc device build
```

Monorepo note: EAS uploads the workspace root (it detects npm workspaces), so
`@notch/core` comes along automatically. The build runs on EAS servers; no
local Xcode needed.

## TestFlight and submission

```bash
eas submit --platform ios --latest
```

Uploads the newest build to App Store Connect. It appears in TestFlight for
internal testers within the hour; external testers need a (light) beta review.

Before submitting **for App Store review**, App Store Connect needs:

- **Privacy policy URL** — `https://<the-deployment>/privacy`. The page exists
  in the web app (with `/terms` beside it, both localized, linked from the web
  footer and the mobile settings sheet), and its content is written from what
  the code actually does — keep the two in step. The named contact
  (`LEGAL_CONTACT_EMAIL` in `apps/web/src/components/LegalPage.tsx`) is
  kangleelab0@gmail.com; it doubles as the listing's support contact.
- **App Privacy labels** — the questionnaire answers, derived from the actual
  data flows (Supabase via the web API, Clerk for auth, OpenAI for LLM
  predictions, Google Cloud for the ML model):

  | App Store category | Collected? | Linked to identity? | Used for tracking? | Purpose |
  |---|---|---|---|---|
  | Contact info → Email address | Yes (account) | Yes | No | App functionality |
  | Health & fitness → Health | Yes (child height/weight/DOB) | Yes, on an account | No | App functionality |
  | Sensitive info | Yes — ethnicity, when the user opts to enter it | Yes, on an account | No | App functionality |
  | Identifiers → User ID | Yes (Clerk user id) | Yes | No | App functionality |
  | Everything else (location, browsing, purchases, diagnostics, ads) | No | — | — | — |

  Guest-mode caveat: with `ENABLE_GUEST_DATA_COLLECTION` off (the default),
  guest predictions are not collected at all. If that flag is ever turned on,
  the labels above still hold — the guest rows carry no identifiers — but
  "Health & fitness" then also applies to users without accounts, collected
  "not linked to identity".
- **Tracking**: none. No ATT prompt is needed; answer "no" to tracking
  throughout.
- **Listing assets** — description, keywords, support URL, screenshots for
  6.9" and 6.5" iPhones (and 13" iPad while `supportsTablet` is true — drop
  tablet support if nobody will maintain iPad screenshots).
- **Age rating questionnaire** — note this is a *parents'* app; it is not in
  the Kids Category.
- **Review notes** — reviewers get a cold Cloud Run instance: the first
  prediction can take ~10 s. Either set `min-instances=1` on
  `kangleelab-modern` for the review window or warn them in the notes.

## Known review risks

- **Guideline 4.2 (minimum functionality)** — see the UI-modernization section
  of [design.md](design.md). The growth chart helps; make sure empty/loading/
  error states look intentional before submitting.
- **Guideline 5.1.1 / health data** — the in-app "not medical advice"
  disclaimers already shown on prediction screens are what reviewers look for;
  keep them visible.

## Maintenance

- `npx expo-doctor` in `apps/mobile` should stay at one known failure: the
  `disableHierarchicalLookup` Metro override, which is deliberate (monorepo
  React dedupe — see metro.config.js) and safe to ignore.
- Expo package versions are patch-pinned by the SDK; `npx expo install --fix`
  applies bumps, and the root package.json's `react-native` pin must be kept
  identical to apps/mobile's (see the comments in the root package.json).
