# Privacy Policy — RSS Reader

Last updated: November 9, 2026

RSS Reader is a local-first browser extension for reading RSS, Atom, RDF, and JSON feeds. This policy explains what the extension stores, what it sends over the network, and what it does not do.

## Summary

- No account, analytics, telemetry, advertising, or tracking.
- No developer-operated server or backend.
- Feeds, posts, read/star state, folders, and settings are stored in your browser.
- The extension connects directly to the sites you subscribe to and to the media providers in the posts you open.
- We do not sell or share your data.

## Data stored in your browser

The extension stores the following in IndexedDB (`rss-reader`) on your device:

- **Feeds:** feed URL, site URL, title, description, folder, refresh interval, fetch metadata (ETag/Last-Modified, last and next fetch times, error state), and cached favicon data.
- **Posts:** title, link, publication date, excerpt, content HTML, author, image URL, read/star state, and search text.
- **Folders and settings.**
- **Saved app state:** the last selected view/post and collapsed folders, when “Remember app state” is enabled.

It also uses:

- `chrome.storage.session` for the window ID of a pinned post window. This is cleared when the browser session ends.
- `localStorage` for the last selection key.

This data stays on your device. The developer does not receive it.

## Network requests

The extension fetches content directly from the sources you choose:

- Feed URLs you add, using normal HTTP(S) requests.
- If a feed blocks background requests, the extension can ask an open tab on the same site to fetch the feed (page-context fetch).
- Favicons and site metadata from the feed’s site.
- When you open the extension, it may inspect the active tab’s HTML for feed links (discovery). This happens locally and temporarily; the HTML is not sent to the developer.
- Hacker News discussions from `hn.algolia.com` when you open a Hacker News post.
- YouTube thumbnails from `i.ytimg.com` for YouTube preview cards.
- Images, video/audio, and embedded media in posts, loaded from their original providers.

Those third-party sites receive standard request information (such as IP address, user agent, requested URL, and possibly cookies or a referrer, depending on your browser settings and the provider). Their own privacy policies apply. The developer does not receive or control those requests.

## What the extension does not do

- No account or sign-in.
- No analytics, telemetry, crash reporting, or usage tracking.
- No advertising or profiling.
- No sale or sharing of personal data.
- No developer server or cloud sync.
- No remote JavaScript is downloaded or executed by the extension itself. Embedded media providers may load their own content in sandboxed iframes.

## Permissions

- `alarms` — schedule background feed refreshes.
- `storage` — keep the session-only pinned-post window ID.
- `unlimitedStorage` — store feeds, posts, and cached favicons in IndexedDB.
- `notifications` — show new-post notifications if you enable them.
- `scripting` — on-demand feed discovery and same-origin page-context fetches.
- Host permissions (`http://*/*`, `https://*/*`) — fetch any feed URL you subscribe to, its favicon, and (on your action) the current tab’s HTML for discovery or a page-context retry.

## Data retention and deletion

- Posts are retained per feed according to your retention setting (default 200).
- Deleting a feed deletes its posts.
- “Clear all data” in Settings removes feeds, folders, posts, settings, and saved app state from IndexedDB.
- Uninstalling the extension removes its local storage.
- The last-view selection key in `localStorage` is not removed by “Clear all data”; clear site data for the extension or uninstall it to remove it.

## Security

- The extension supports HTTPS feeds and uses HTTPS for the services that require it.
- Stored post HTML is sanitized before rendering.
- Embedded third-party media is sandboxed and restricted to an allowlist of providers.
- No remote scripts are loaded or executed by the extension itself.

## Chrome Web Store Limited Use

The extension uses the information it accesses only to provide its single purpose: reading feeds selected by the user. It does not sell user data, use it for advertising, or transfer it to third parties except as necessary to fetch the content the user requested or to comply with applicable law.

## Children’s privacy

The extension is not directed to children under 13 and does not knowingly collect personal information from children.

## Changes

If this policy changes, the updated version will be posted at this URL with a new “Last updated” date.

## Contact

Questions about this policy: <https://github.com/uchm4n/rss-reader/issues>
