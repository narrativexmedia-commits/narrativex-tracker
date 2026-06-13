import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "narrativex-media",
  project: "narrativex-tracker",
  silent: true,
  sourcemaps: { disable: true },
  disableLogger: true,
});