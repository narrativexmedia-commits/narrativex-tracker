import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://364fb0504951bd8538c5520e5f1fe891@o4511556897996800.ingest.us.sentry.io/4511556908023808",
  tracesSampleRate: 0.5,
  debug: false,
  environment: process.env.NODE_ENV,
});