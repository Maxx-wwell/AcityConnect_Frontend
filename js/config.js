/**
 * Single place to point the static site at your API.
 * Override before loading other scripts if needed:
 *   <script>window.ACITY_API_ORIGIN = "https://your-host.com";</script>
 */
window.ACITY_API_ORIGIN =
  window.ACITY_API_ORIGIN || "http://localhost:3000";

window.ACITY_API_BASE = `${window.ACITY_API_ORIGIN}/api/v1`;
