# RSS Reader

A local-first RSS and Atom reader for Browser, built with TypeScript, React, Dexie and feedsmith. Feeds, posts, folders, read/star state and settings live in the browser. 
There is no account, hosted API, sync, analytics or remote push.

## Architecture

```text
┌─────────────────────────────────────────────┐
│ Popup (React + shadcn + useLiveQuery)       │
│  reader, feed tree, search, settings        │
└───────────────┬─────────────────────────────┘
                │ Dexie reads/writes
                │ chrome.runtime.sendMessage
┌───────────────▼─────────────────────────────┐
│ Dexie / IndexedDB (`rss-reader`)            │
│  feeds, folders, posts, settings            │
└───────────────▲─────────────────────────────┘
                │ Dexie writes
┌───────────────┴─────────────────────────────┐
│  service worker (TypeScript)                │
│  alarms, fetch, parse, retention, badge,    │
│  notifications, command router              │
└─────────────────────────────────────────────┘
```

- `src/popup` renders the reader and settings. It reads with `useLiveQuery` and writes read/star/settings changes directly.
- `src/background` owns fetching, parsing, retention, scheduling, notifications, the toolbar badge and feed/folder/OPML commands.
- `src/db` holds the Dexie schema and post/settings repositories.
- `src/shared/parser` normalizes RSS, Atom, RDF, JSON Feed and OPML with feedsmith.
- `src/shared/model` contains pure helpers for the feed tree, unread counts, search, selection and post formatting.

Only feed URLs, article links and images referenced by feeds are fetched.
Stored posts render without a network connection; refreshing needs one.

## Data behaviour

- First successful fetch imports the feed's existing entries as read, up to the retention limit.
- Later fetches insert new entries at the top as unread.
- Each feed keeps the newest 200 posts by default; the limit is configurable in settings. A single feed shows all of its retained posts, while aggregate views show the newest 200 matching posts. 
- `status: true` means read. `starred` is independent.
- A single dynamic alarm refreshes due feeds in small batches. The minimum interval is 30 seconds; feeds can override the global interval.
- Search is a local filter over stored posts, capped at 200 results.

## Permissions

- `alarms`, `storage`, `unlimitedStorage`, `notifications`.
- `http://*/*` and `https://*/*` host permissions for direct feed and article fetches.
- No content scripts, no hosted settings page and no external update URL.

## Development

```bash
npm install
npm run dev          # Extension.js dev browser
npm run build:chrome # production build in dist/chrome
npm run preview      # preview the production build
npm run test         # Vitest
npm run test:e2e     # Chrome for Testing smoke test with local fixtures
npm run typecheck    # tsc --noEmit
```

`npm run test:e2e` discovers Playwright's Chrome for Testing cache. Set
`CHROME_BIN` to a Chrome for Testing or Chromium binary if it is installed elsewhere. Current branded Chrome builds ignore `--load-extension`.

## Loading the extension

1. `npm run build:chrome`
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. **Load unpacked** → `dist/chrome`.

Use a fresh extension profile: this is a new extension identity with a fresh `rss-reader` database and no migration from older products.

## Verification

`npm run test`, `npm run typecheck` and `npm run build:chrome` cover the unit, Dexie and build checks. 
The test suite includes parser fixtures, retention and dedupe, scheduler backoff, commands, OPML import/export, settings and the feed tree. 
End-to-end checks use a local fixture server and Chrome for Testing.

## License
MIT