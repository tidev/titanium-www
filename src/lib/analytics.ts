import posthog from 'posthog-js';
import type { Properties } from 'posthog-js';

/**
 * The one place that knows whether analytics is configured.
 *
 * Every call site used to carry its own `if (TOKEN && HOST)` guard, which meant
 * eight copies of the same condition and no way to add a third variable without
 * editing eight files. The guard lives here instead and the components call
 * blind.
 *
 * Both variables are `NEXT_PUBLIC_`, so these reads are inlined at build time -
 * `configured` is a constant by the time it reaches a browser, and the capture
 * calls fold away entirely in a build that has no PostHog credentials.
 */
const configured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST
);

/**
 * Every event this site sends.
 *
 * A union rather than a bare string because these names are the schema: a typo
 * is not a bug that shows up in review, it is a second event in PostHog that
 * nobody notices until a chart is wrong. Adding one here is the deliberate step
 * that adding an event should be.
 */
export type AnalyticsEvent =
  | 'blog_post_shared'
  | 'command_copied'
  | 'directory_filter_applied'
  | 'module_filter_applied'
  | 'sdk_download_started'
  | 'showcase_filter_applied'
  | 'site_search_result_selected';

/**
 * Records an event, or does nothing if analytics is not configured.
 *
 * The try/catch is not defensive padding. These calls sit in `onClick` and
 * `onChange` handlers, so an exception from the SDK would take the interaction
 * down with it - a share button that does not navigate, a filter that does not
 * apply. Analytics failing is never worth breaking the page over.
 */
export function capture(event: AnalyticsEvent, properties?: Properties) {
  if (!configured) {
    return;
  }

  try {
    posthog.capture(event, properties);
  } catch {
    // Nothing to do and nowhere useful to report it: the SDK is what would
    // have reported it.
  }
}

/**
 * Records an event that is immediately followed by leaving the page.
 *
 * PostHog batches captures and drains the queue with `sendBeacon` when the page
 * hides, so the default path mostly survives a navigation on the next line.
 * Mostly is the problem - the SDK documents that drain as best effort, and a
 * request can still be cancelled mid-flight. A beacon is the one transport the
 * browser guarantees it will finish after the document is gone.
 *
 * The tradeoff, per the SDK: an accepted beacon cannot report a server failure
 * back for a retry. That is the right trade for these - a dropped retry costs
 * one event, and the alternative costs the same event more often.
 */
export function captureBeforeLeaving(event: AnalyticsEvent, properties?: Properties) {
  if (!configured) {
    return;
  }

  try {
    posthog.capture(event, properties, { transport: 'sendBeacon' });
  } catch {
    // As above.
  }
}
