# Google Flow unsupported-country Fix

A tiny browser extension that stops [Google Flow](https://flow.google.com) from
redirecting you to its **"not available in your country"** page.

Flow decides whether to show you that page in the browser, in its own JavaScript.
This extension rewrites the single line that makes the call, so the app loads
normally instead of bouncing you to `/unsupported-country`.

## Why you might want it

- **The app loads.** No redirect to `/unsupported-country`, so you get the real UI.
- **Nothing to configure.** No popup, no options page, no account, no sign-in. Install
  it and open Flow.
- **No proxy, no VPN.** Nothing is routed anywhere; the patch happens locally in your
  browser, on page load.
- **Nothing is collected.** The extension has no network access of its own, no storage,
  and no telemetry. It requests **zero permissions** beyond running on `flow.google.com`
  — check `manifest.json` in the zip, it's four lines.
- **Small and auditable.** About 11 kB, one source file, no dependencies shipped.

## Install

Grab the latest zip from the [Releases](../../releases) page.

### Chrome, Edge, Brave, or any Chromium browser

1. Download `google-flow-fix-<version>-chrome.zip` and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**, top right.
4. Click **Load unpacked** and pick the unzipped folder.
5. Open <https://flow.google.com>.

Keep the unzipped folder where it is — the browser loads the extension from that
folder every time it starts, so deleting it uninstalls the extension. To update, remove
the old entry and repeat with the new zip.

## Usage

There's nothing to use. Open <https://flow.google.com> and the page loads patched.


## How it works

The patch is one substitution in Flow's main bundle:

```js
if(!l.Pa())return new Iq(_.UG(f,"/unsupported-country"))   // before
if(false) return new Iq(_.UG(f,"/unsupported-country"))    // after
```

## Build from source

Needs [Node](https://nodejs.org) 20+ and [pnpm](https://pnpm.io). Built with
[WXT](https://wxt.dev).

```sh
pnpm install
pnpm dev          # launches a browser with the extension loaded, hot reload
pnpm build        # -> .output/chrome-mv3/
pnpm zip          # -> .output/google-flow-fix-<version>-chrome.zip
pnpm compile      # typecheck
```

Append `:firefox` to `dev`, `build`, or `zip` for the Firefox build.

Everything deploy-specific — the URL patterns and the substitution itself — is in the
`--- PATCH ---` block at the top of [entrypoints/content.ts](entrypoints/content.ts).
That's the only place to edit when a Google deploy breaks the match.
