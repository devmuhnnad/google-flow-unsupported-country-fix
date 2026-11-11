/**
 * Rewrites one line in Google Flow's main JS bundle before the page runs it.
 *
 * The bundle is a parser-inserted <script id="base-js"> at the end of <body>.
 * We catch the element at document_start, cancel it, re-fetch the source
 * (gstatic allows CORS from flow.google.com), apply the patch, and run the
 * result in its place. The fetch is synchronous on purpose: it keeps the
 * bundle's original timing, so it still executes before DOMContentLoaded.
 */

// --- PATCH -----------------------------------------------------------------

/** The main app bundle on gstatic. Build hash and locale change per deploy. */
const APP_BUNDLE =
  /^https:\/\/www\.gstatic\.com\/_\/mss\/boq-labs-ai-sandbox\/_\/js\/k=boq-labs-ai-sandbox\.AiSandboxAngularFrontend\./;

/** Only the entry chunk; lazy chunks use other `m=` values and must be left alone. */
const MAIN_CHUNK = /\/m=_b$/;

/** Set by the bundle itself on its first line — our "has it already run?" sentinel. */
const APP_GLOBAL = 'default_AiSandboxAngularFrontend';

/**
 * Tried in order; the first one that matches exactly once wins.
 *  1. the literal line
 *  2. same line, anchored on the "/unsupported-country" route instead of the
 *     minified names, so a rename of `l.Pa` on the next deploy still patches
 */
const PATCHES: Array<{ find: string | RegExp; replace: string }> = [
  { find: 'if(!l.Pa())', replace: 'if(false)' },
  {
    find: /if\(![\w$]+\.[\w$]+\(\)\)(?=return new [\w$]+\(_\.[\w$]+\([\w$]+,"\/unsupported-country"\))/,
    replace: 'if(false)',
  },
];

// ---------------------------------------------------------------------------

const TAG = '[google-flow-fix]';

export default defineContentScript({
  matches: ['https://flow.google.com/*'],
  runAt: 'document_start',
  // MAIN: the patched bundle has to run in the page's own realm.
  world: 'MAIN',
  main() {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!isAppBundle(node)) continue;
          observer.disconnect();
          try {
            patchBundle(node);
          } catch (error) {
            console.error(TAG, 'left the page unpatched:', error);
          }
          return;
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => observer.disconnect(), { once: true });
  },
});

function isAppBundle(node: Node): node is HTMLScriptElement {
  if (!(node instanceof HTMLScriptElement) || !node.src) return false;
  return APP_BUNDLE.test(node.src) && (node.id === 'base-js' || MAIN_CHUNK.test(node.src));
}

function patchBundle(original: HTMLScriptElement) {
  const url = original.src;
  const parent = original.parentNode;
  if (!parent) return;

  // If the bundle already executed we must not run a second copy of it.
  if (APP_GLOBAL in window) {
    console.warn(TAG, 'bundle already executed, skipping:', url);
    return;
  }

  // Synchronous: nothing else can run on this thread until it returns, so the
  // original script cannot slip through while we are fetching.
  const source = fetchSync(url);
  const code = applyPatch(source, url);

  // Build both elements before touching the DOM. Anything that throws in here
  // (Trusted Types, mainly) then leaves the original in place, and the page
  // still boots - just unpatched.
  const twin = inertTwin(original);
  const patched = document.createElement('script');
  patched.nonce = original.nonce;
  setText(patched, code);

  const next = original.nextSibling;
  original.remove(); // cancels the pending parser-blocking execution
  parent.insertBefore(twin, next); // stand-in #base-js for lazy-chunk URLs
  parent.insertBefore(patched, next);
  console.info(TAG, 'patched', url);
}

function applyPatch(source: string, url: string): string {
  for (const { find, replace } of PATCHES) {
    const hits = countMatches(source, find);
    if (hits === 1) return source.replace(find, replace);
    if (hits > 1) console.warn(TAG, String(find), `matched ${hits}x, skipping it`);
  }
  console.warn(TAG, 'no pattern matched, running the bundle unchanged:', url);
  return source;
}

function countMatches(source: string, find: string | RegExp): number {
  if (typeof find === 'string') return source.split(find).length - 1;
  const global = new RegExp(find.source, find.flags.includes('g') ? find.flags : `${find.flags}g`);
  return (source.match(global) ?? []).length;
}

function fetchSync(url: string): string {
  const request = new XMLHttpRequest();
  request.open('GET', url, false);
  request.send();
  if (request.status !== 200) throw new Error(`${url} returned ${request.status}`);
  return request.responseText;
}

/** A copy that keeps the attributes but can never fetch or execute. */
function inertTwin(original: HTMLScriptElement): HTMLScriptElement {
  const twin = document.createElement('script');
  twin.type = 'application/json';
  for (const { name, value } of Array.from(original.attributes)) {
    // `src` is a TrustedScriptURL sink, so it cannot go through setAttribute.
    if (name !== 'type' && name !== 'src') twin.setAttribute(name, value);
  }
  twin.nonce = original.nonce;
  setSrc(twin, original.src);
  return twin;
}

// --- Trusted Types ---------------------------------------------------------
// flow.google.com enforces `require-trusted-types-for 'script'`, so a script
// element's text and src both have to be assigned trusted values. Its CSP has
// no `trusted-types` directive, which leaves policy names unrestricted.

type Policy = { createScript(s: string): unknown; createScriptURL(s: string): unknown };
let policy: Policy | undefined;
let policyTried = false;

function trustedTypes(): Policy | undefined {
  if (policyTried) return policy;
  policyTried = true;
  const factory = (globalThis as { trustedTypes?: any }).trustedTypes;
  if (!factory?.createPolicy) return undefined; // not enforced, raw strings are fine
  try {
    policy = factory.createPolicy('google-flow-fix', {
      createScript: (s: string) => s,
      createScriptURL: (s: string) => s,
    });
  } catch (error) {
    console.warn(TAG, 'could not create a trusted types policy:', error);
  }
  return policy;
}

function setText(script: HTMLScriptElement, code: string) {
  const trusted = trustedTypes();
  (script as unknown as { text: unknown }).text = trusted ? trusted.createScript(code) : code;
}

function setSrc(script: HTMLScriptElement, url: string) {
  const trusted = trustedTypes();
  (script as unknown as { src: unknown }).src = trusted ? trusted.createScriptURL(url) : url;
}
