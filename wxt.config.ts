import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  // Firefox too: a content script in the MAIN world needs MV3 (Firefox 128+).
  manifestVersion: 3,
  manifest: {
    name: 'Google Flow Fix',
    description: "Skips Google Flow's unsupported-country, unavailable and unsupported-browser redirects.",
    // No permissions needed: the content script's own match grants page access,
    // and the bundle is re-fetched from the page's origin (gstatic sends
    // Access-Control-Allow-Origin: https://flow.google.com).
  },
});
