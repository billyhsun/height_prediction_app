/**
 * @notch/core — everything the web app and the native apps genuinely share.
 *
 * The rule for what belongs here: no DOM, no React, no Next.js, no server-only
 * secrets. Platform differences are handled by configuration (see http.ts and
 * the session store in prediction-session.ts) rather than by branching on
 * platform inside this package.
 *
 * Deliberately NOT here: anything that reads SUPABASE_SECRET_KEY, the Supabase
 * client, the LLM caller and the prediction proxy. Those stay server-side in the
 * web app, and native reaches them over HTTP — which is what keeps the secret
 * off the device and the authorization logic in one place.
 */

// Design system
export * from "./design/tokens";
export * from "./design/chart";
export * from "./design/growth-curve";

// Localisation
export * from "./i18n/config";
export * from "./i18n/dictionaries";

// Domain
export * from "./age";
export * from "./ethnicities";
export * from "./child-profile";
export * from "./model-domain";
export * from "./prediction-session";

// Transport and API clients
export * from "./http";
export * from "./request-error";
export * from "./api";
export * from "./children";
export * from "./saved-predictions";
export * from "./account";
