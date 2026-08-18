# Guest data collection

**Status:** Off by default
**Last updated:** 2026-08-18
**Flag:** `ENABLE_GUEST_DATA_COLLECTION`

Predictions run without an account can be recorded for model-improvement work.
This is off unless explicitly switched on, and the switch exists so collection
can be stopped without a code change if the compliance position changes.

---

## 1. The flag

```
ENABLE_GUEST_DATA_COLLECTION=true    # collect
ENABLE_GUEST_DATA_COLLECTION=false   # do not collect (default)
```

Two properties are deliberate:

- **Server-only.** No `NEXT_PUBLIC_` prefix, so the value never reaches the
  browser and no client can flip it. The decision is made in the route handler.
- **Fails closed.** Only the exact string `"true"` enables collection. Missing,
  empty, misspelled, or `"TRUE"` all collect nothing. For a switch whose purpose
  is compliance, the safe state must be what you get by accident.

Turning it off stops collection immediately on the next deploy. It does **not**
delete rows already collected — see §5.

---

## 2. What is collected

One row in `GuestPrediction` per prediction submitted from the form, containing
the model's inputs and its outputs:

| Field | Why |
|-------|-----|
| `sex`, `heightCm`, `weightKg`, `currentAgeYears`, `targetAgeYears` | Model features |
| `motherHeightCm`, `fatherHeightCm` | Features for the LLM path, candidates for a future ML model |
| `ethnicities` | LLM feature — see the warning in §4 |
| `predHeightCm`, `predWeightKg`, `predBmi`, `modelVersion` | What the model returned, for calibration analysis |
| `llmPredHeightCm`, `llmModel` | LLM comparison |
| `createdAt` | Ordering |

## 3. What is deliberately NOT collected

The table has **no column** for any of these, so they cannot be recorded by
mistake later:

- user id or any account reference
- IP address
- user agent or device information
- session or cookie identifier
- child name or date of birth (guest mode never asks for either)
- `llmReasoning` — free-form generated prose about a child, and not a model
  feature

`GuestPrediction` is a separate table rather than a nullable `userId` on
`Prediction`. That was chosen so that it:

1. can be dropped wholesale if collection has to be undone,
2. has no foreign key to identity, so no row links to a person,
3. can never appear in a signed-in user's history through a missed filter.

Signed-in users are also rejected by the route. Their predictions belong in
`Prediction`; accepting them here would double-count and blur the line between
identified and anonymous data.

---

## 4. ⚠️ Two things to weigh before switching this on

### `ethnicities` is special-category data

Under GDPR Article 9, racial and ethnic origin is a special category with a
higher bar than ordinary personal data, and this is collected without an account
or a consent step. It is the single field most likely to cause a problem.

It is included because it is a genuine model input and the field is optional for
the user. If that trade is not acceptable, drop it from the insert in
`src/lib/guest-collection.ts` — nothing else depends on it.

### It cannot produce training pairs

This is the important limitation, and it follows directly from §3. Supervised
training of "what height will this child reach" needs a pair: features observed
at one age, and the actual height at a later age. Building that pair requires
linking two records of the same child — and linking requires a stable
identifier, which is exactly the re-identification risk this design avoids.

So guest data gives you:

- ✅ the distribution of inputs real users enter
- ✅ calibration checks — how the deployed model behaves on real traffic
- ✅ volume and funnel signal
- ❌ **not** before/after pairs for supervised training

Longitudinal pairs can only come from signed-in users who return to the same
child profile. Guest collection supplements that; it does not substitute for the
`measurements` table (`docs/design.md` §5), which remains the higher-value item.

---

## 5. Operational notes

**Where it happens.** Only on form submission in `PredictionForm`, when
`savePredictionToAccount` returns `null` (a 401, meaning no account). The
`/results` page can also compute a prediction from URL parameters, and that path
deliberately does *not* collect — it would duplicate rows on refresh and on
shared links.

**Failure behaviour.** Collection never throws. A failed insert is logged and
swallowed on both client and server, because analytics must not break or delay
someone's prediction.

**Deleting collected data.** Rows have no user reference, so there is no
per-person deletion request to service — nothing identifies a subject. To remove
everything:

```sql
TRUNCATE TABLE "GuestPrediction";
```

**Before enabling**, the privacy policy should say that anonymous predictions may
be retained to improve the model. That is a content change, not a code change,
but it belongs with the same decision.
