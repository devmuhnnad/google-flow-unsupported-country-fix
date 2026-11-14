# Google Flow Fix — unsupported-country, unavailable, unsupported-browser

A tiny browser extension that stops [Google Flow](https://flow.google.com) from
redirecting you to its **"not available in your country"**, **"unavailable"** and
**"unsupported browser"** pages.

Flow decides whether to show you those pages in the browser, in its own JavaScript —
all three come out of a single router guard. This extension rewrites the three lines
that make those calls, so the app loads normally instead of bouncing you to
`/unsupported-country`, `/unavailable` or `/unsupported-browser`.

## Why you might want it

- **The app loads.** No redirect to any of the three dead ends, so you get the real UI.
- **Nothing to configure.** No popup, no options page, no account, no sign-in. Install
  it and open Flow.
- **No proxy, no VPN.** Nothing is routed anywhere; the patch happens locally in your
  browser, on page load.
- **Nothing is collected.** The extension has no network access of its own, no storage,
  and no telemetry. It requests **zero permissions** beyond running on `flow.google.com`
  — check `manifest.json` in the zip, it's four lines.
- **Small and auditable.** About 12 kB, one source file, no dependencies shipped.

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

There's nothing to use. Open <https://flow.google.com> and the page loads patched. With
devtools open you'll see one line naming what it bypassed:

```
[google-flow-fix] bypassed: unsupported-country, unavailable, unsupported-browser
```

If a Google deploy breaks one of the patterns, the console says which, the other
bypasses still apply, and Flow keeps working the way it did without the extension.

## How it works

Three substitutions in Flow's main bundle, all inside the same router guard:

```js
// 1. region gate
if(!r.Pa())return new oq(_.hF(g,"/unsupported-country"))   // before
if(false)  return new oq(_.hF(g,"/unsupported-country"))   // after

// 2. account/status gate — `return!0` is the guard's own "allow" value
case 4:case 5:case 6:case 8:return new oq(_.hF(g,"/unavailable"))   // before
case 4:case 5:case 6:case 8:return!0                               // after

// 3. user-agent gate
if(_.Ls(h))return new oq(g.ma(["/unsupported-browser"],...))   // before
if(false)  return new oq(g.ma(["/unsupported-browser"],...))   // after
```

The minified names above are from one particular build and are not matched on — Google
renames them constantly (`l.Pa` became `r.Pa` within three days). Each pattern is
anchored on the route string instead, tolerates the line wrapping the minifier inserts
at arbitrary token boundaries, and has to match exactly once or it's skipped.

What that does *not* survive is Google restructuring the guard: changing the shape of a
condition, renaming the route strings, or moving a check server-side. Then the pattern
misses, the console says which one, and you're back to the page you'd get without the
extension.

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

Everything deploy-specific — the URL patterns and the substitutions themselves — is in
the `--- PATCH ---` block at the top of [entrypoints/content.ts](entrypoints/content.ts).
That's the only place to edit when a Google deploy breaks a match.
