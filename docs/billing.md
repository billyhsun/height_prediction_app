# Billing & paywall (Stripe)

Premium is a Stripe subscription, monthly or yearly, bought on the **web only**.

| | Free | Premium |
|---|---|---|
| ML (SVR) prediction, percentiles | ✓ | ✓ |
| Birth prediction | ✓ | ✓ |
| LLM estimate (`/api/v1/predict/llm`) | — | ✓ |
| Child profiles | 1 (`FREE_CHILD_LIMIT`) | Unlimited |
| History list / saved prediction detail / earlier points on the growth chart | — | ✓ |

Free accounts still **save** predictions, so upgrading reveals their full history
and lapsing never deletes anything. A lapsed subscriber keeps every child profile
they already have; they just can't add more.

## How it fits together

```
Pricing page ──POST /api/billing/checkout──► Stripe Checkout ──► /account?checkout=success
                                                   │                    │
                                                   ▼                    ▼ POST /api/billing/sync
                                     POST /api/stripe/webhook ──► syncStripeCustomer() ──► "User" billing columns
                                                                                              │
                     gated routes ── hasPremium(user) ◄───────────────────────────────────────┘
```

- **Source of truth is Stripe.** The `User` columns (`stripeCustomerId`,
  `subscriptionStatus`, `stripePriceId`, `subscriptionPeriodEnd`,
  `cancelAtPeriodEnd`, `stripeSubscriptionId`) are a mirror so a gate costs no API call.
- **Only `syncStripeCustomer` writes them** (`apps/web/src/lib/stripe.ts`). The webhook
  treats each event as a signal and re-reads the subscription from Stripe, so
  out-of-order or retried events can't leave stale state.
- **Gates live in route handlers** and return `402 { code: "premium_required", feature }`.
  The UI only decides what to show; it can't unlock anything.
- **What counts as paid:** `active`, `trialing`, `past_due` (`src/lib/entitlements.ts`).
  `past_due` is a grace period while Stripe retries the card.
- **Account deletion** deletes the Stripe customer first, which cancels the
  subscription immediately (no proration refund).

## iOS

The app gets entitlements from the same API, so a web subscriber has Premium on
iOS. The app **never** shows prices, a buy button or a link to the website —
App Store guideline 3.1.1. Locked features show neutral "not in your current plan"
text (`billing.locked.*Native`). Selling inside the app needs Apple In-App Purchase
(e.g. via RevenueCat) that writes the same entitlement; see `docs/design.md` Phase 6.

## Setup

### 1. Stripe dashboard (do this in test mode first)

1. **Product catalog → Add product** "Premium" with two recurring prices: monthly
   and yearly. Copy both `price_…` ids.
2. **Settings → Billing → Customer portal**: enable it and allow *cancel
   subscriptions*, *update payment methods*, *view invoices*, and *switch plans*
   between the two prices.
3. **Developers → Webhooks → Add endpoint**:
   `https://<your-domain>/api/stripe/webhook`, subscribed to exactly:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`

   Copy the signing secret (`whsec_…`).
4. **Settings → Billing → Subscriptions and emails → Manage failed payments**:
   decide what happens when retries run out. Either `canceled` or `unpaid` ends access.

### 2. Database

Re-run `apps/web/supabase/setup.sql` in the Supabase SQL editor. It's idempotent;
the new `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS …` lines add the billing columns.

### 3. Environment variables (Vercel and `apps/web/.env.local`)

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…`. Server-only |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the endpoint above. Test and live differ |
| `STRIPE_PRICE_ID_MONTHLY` | `price_…` |
| `STRIPE_PRICE_ID_YEARLY` | `price_…` |
| `PAYWALL_ENABLED` | Optional. Gating is **on** unless this is exactly `false` |

### 4. Local testing

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints a whsec_ for .env.local
cd apps/web && npm run dev
```

Pay with card `4242 4242 4242 4242`, any future date and CVC. To simulate lapses:
`stripe trigger customer.subscription.deleted`, or cancel in the portal, or use a
[test clock](https://docs.stripe.com/billing/testing/test-clocks).

Set `PAYWALL_ENABLED=false` to develop without Stripe at all (everyone is Premium).

### 5. Going live

Repeat step 1 in live mode (new price ids, new webhook secret), swap the four
`STRIPE_*` env vars in Vercel production, and redeploy. Then consider turning on
Stripe Tax, which needs `automatic_tax` added to the Checkout session in
`src/app/api/billing/checkout/route.ts`.
