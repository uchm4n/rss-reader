# RSS Reader

A local-first browser extension for RSS, Atom, RDF and JSON feeds. 
No account, hosted API's, analytics or remote push — everything lives in clients browser, offline.

![screenshot.png](screenshot.png)

### Settings

- **General:** theme (system/light/dark), refresh interval (30 seconds to 1 hour; 15 minutes default), retention per feed (default 200), notifications, mark read on open, and start view (All/Unread/Starred).
- **Feeds:** add, edit and delete feeds; see URL, folder, last fetch and last error
- **Folders:** add, rename, reorder and delete folders
- **OPML:** import a file or export subscriptions
- **Storage:** read-only store table and record counts, browser storage estimate, and Clear all data

**Note:** Clear all data removes feeds, folders, posts and settings from IndexedDB. It does not remove the last-view selection stored in `localStorage`.

### Behaviour

- First fetch imports existing entries as read; later fetches add new ones as unread.
- Each feed retains the newest 200 posts by default (configurable); aggregate views cap at 200.
- Feeds refresh on a dynamic alarm (15min default); failures back off exponentially up to 1 hour.
- Media is responsive: images/video cap at 60vh, native controls, sandboxed iframes, no autoplay.

## Development

```bash
npm install
npm run dev          # Extension.js dev browser
npm start            # Extension.js start
npm run build:chrome # production build in dist/chrome
npm run build:firefox
npm run build:edge
npm run preview      # preview the production build
npm test             # Vitest unit, DB, parser, popup and local-fixture tests
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Chrome for Testing smoke test with local fixtures
npm run typecheck    # tsc --noEmit
```

`npm run test:e2e` discovers Playwright’s Chrome for Testing cache on macOS and checks common Chrome/Chromium locations. Set `CHROME_BIN` to a Chrome for Testing or Chromium binary if it is installed elsewhere. Current branded Chrome builds ignore `--load-extension`.

Run `npm run build:chrome` before `npm run test:e2e`; the E2E test uses the built extension in `dist/chrome`, not the source tree.

## Loading the extension

1. `npm run build:chrome`
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. **Load unpacked** → `dist/chrome`.

Use a fresh extension profile: this is a new extension identity with a fresh `rss-reader` database and no migration from older products.

## License

MIT
