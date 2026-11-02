/**
 * Browser Sentry (B-028, guardrail 12). Only NEXT_PUBLIC_* variables reach the
 * client bundle, and they are inlined at build time, so each stack (prod,
 * staging) is built with its own NEXT_PUBLIC_SENTRY_DSN / _ENVIRONMENT.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './instrumentation';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const rate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
  initialScope: { tags: { runtime: 'browser', service: 'noah-web' } },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
