export type AnalyticsEvent =
  | "start_clicked"
  | "install_prompt_accepted"
  | "template_selected"
  | "capture_completed"
  | "capture_skipped"
  | "download_clicked"
  | "caption_copied";

export function trackEvent(event: AnalyticsEvent, payload?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log("[analytics]", event, { timestamp, ...payload });
}
