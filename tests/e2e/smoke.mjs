import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {existsSync, readdirSync} from 'node:fs'
import {homedir, tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {startFixtureServer} from './fixture-server.mjs'

function playwrightChrome() {
  const root = join(homedir(), 'Library/Caches/ms-playwright')
  if (!existsSync(root)) return null

  const installations = readdirSync(root)
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .reverse()
  const relativePaths = [
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-linux64/chrome',
    'chrome-linux/chrome'
  ]

  for (const installation of installations) {
    for (const relativePath of relativePaths) {
      const candidate = join(root, installation, relativePath)
      if (existsSync(candidate)) return candidate
    }
  }

  return null
}

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  playwrightChrome(),
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean)

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function chromeBinary() {
  const binary = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
  if (!binary) throw new Error('Chrome not found; set CHROME_BIN')
  return binary
}

class Cdp {
  static async connect(url) {
    const client = new Cdp(url)
    await client.open()
    return client
  }

  constructor(url) {
    this.url = url
    this.id = 0
    this.pending = new Map()
    this.socket = new WebSocket(url)
  }

  open() {
    return new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', () => resolvePromise())
      this.socket.addEventListener('error', () => reject(new Error(`CDP connect failed: ${this.url}`)))
      this.socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data)
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
      })
    })
  }

  send(method, params = {}) {
    const id = (this.id += 1)
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, {resolve: resolvePromise, reject})
      this.socket.send(JSON.stringify({id, method, params}))
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'Page evaluation failed'
      )
    }
    return result.result?.value
  }

  close() {
    this.socket.close()
  }
}

async function waitForPort(profile, timeoutMs = 20_000) {
  const file = join(profile, 'DevToolsActivePort')
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const [port] = (await readFile(file, 'utf8')).split('\n')
      if (port) return Number(port)
    } catch {
      // Chrome has not written the port yet.
    }
    await sleep(100)
  }

  throw new Error('Chrome did not expose a DevTools port')
}

async function targets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  return response.json()
}

function unpackedExtensionId(path) {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 32)
  return [...hash]
    .map((character) => String.fromCharCode(97 + Number.parseInt(character, 16)))
    .join('')
}

async function openPopup(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  })
  const target = await response.json()
  return Cdp.connect(target.webSocketDebuggerUrl)
}

async function waitFor(check, message, timeoutMs = 15_000) {
  const start = Date.now()
  let lastError

  while (Date.now() - start < timeoutMs) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }

  throw new Error(`${message}${lastError ? ` (${lastError.message})` : ''}`)
}

const DB_HELPERS = `
  const dbAll = (store) => new Promise((resolve, reject) => {
    const open = indexedDB.open('rss-reader')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const database = open.result
      const transaction = database.transaction(store, 'readonly')
      const request = transaction.objectStore(store).getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => { resolve(request.result); database.close() }
    }
  })
`

async function main() {
  const extension = resolve('dist/chrome')
  assert(existsSync(join(extension, 'manifest.json')), 'Run npm run build:chrome first')

  const fixture = await startFixtureServer()
  const profile = await mkdtemp(join(tmpdir(), 'rss-reader-e2e-'))
  const chrome = spawn(
    chromeBinary(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--remote-debugging-port=0',
      'about:blank'
    ],
    {stdio: 'ignore'}
  )

  let popup
  try {
    const port = await waitForPort(profile)
    const extensionId = unpackedExtensionId(extension)

    popup = await openPopup(port, `chrome-extension://${extensionId}/action/index.html`)
    await popup.send('Runtime.enable')
    await popup.send('Page.enable')
    await popup.send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false
    })
    assert(
      await popup.evaluate('chrome?.runtime?.id'),
      'Extension popup did not load; the extension ID may be wrong'
    )

    const evaluate = (expression) => popup.evaluate(expression)
    const dbAll = (store) =>
      evaluate(`(async () => { ${DB_HELPERS}; return dbAll(${JSON.stringify(store)}) })()`)
    const badge = () => evaluate('chrome.action.getBadgeText({})')
    const bodyText = () => evaluate('document.body.innerText')

    const command = async (payload) =>
      waitFor(
        async () => {
          const result = await evaluate(
            `chrome.runtime.sendMessage(${JSON.stringify(payload)})`
          )
          if (!result) return false
          if (!result.ok) throw new Error(result.error)
          return result
        },
        `Command failed: ${payload.type}`
      )

    const openPage = async (path) => {
      const target = await (
        await fetch(
          `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${fixture.url}${path}`)}`,
          {method: 'PUT'}
        )
      ).json()
      return target
    }

    const pageTabId = async (suffix) =>
      evaluate(`(async () => {
        const tabs = await chrome.tabs.query({})
        return tabs.find((tab) => tab.url && tab.url.endsWith(${JSON.stringify(suffix)}))?.id ?? null
      })()`)

    const discoverPage = async (path, expectedUrlPart) => {
      await openPage(path)
      return waitFor(
        async () => {
          const tabId = await pageTabId(path)
          if (!tabId) return false
          const result = await evaluate(
            `chrome.runtime.sendMessage(${JSON.stringify({type: 'discovery:detect', tabId})})`
          )
          if (!result?.ok) return false
          const feeds = result.data?.feeds ?? []
          return feeds.some((feed) => feed.url.includes(expectedUrlPart))
            ? {tabId, feeds}
            : false
        },
        `Feed was not detected on ${path}`
      )
    }

    await waitFor(
      () => evaluate('document.body.innerText.length > 0'),
      'Popup did not render'
    )
    await command({type: 'worker:reschedule'})

    console.log('1. add first feed')
    const added = await command({
      type: 'feed:add',
      url: `${fixture.url}/rss.xml`
    })
    assert(added.ok, 'feed:add failed')

    await waitFor(async () => {
      const posts = await dbAll('posts')
      return posts.length === 3 && posts.every((post) => post.status)
    }, 'first fetch was not imported as read')
    const addedFeed = (await dbAll('feeds')).find((feed) =>
      feed.url.endsWith('/rss.xml')
    )
    assert(
      addedFeed?.favicon?.startsWith('data:image/'),
      'feed favicon was not cached as a data URL'
    )
    assert((await badge()) === '', 'badge should be clear after the first fetch')
    console.log('   first fetch imported 3 posts as read and cached the favicon')

    console.log('2. fetch a new item')
    await fetch(`${fixture.url}/add-item`)
    await command({type: 'feed:refresh-all'})
    await waitFor(async () => {
      const posts = await dbAll('posts')
      const newest = [...posts].sort((left, right) => right.publishedAt - left.publishedAt)[0]
      return (
        posts.length === 4 &&
        newest?.title === 'New RSS item 1' &&
        newest?.status === false
      )
    }, 'new item was not added unread at the top')
    await waitFor(async () => (await badge()) === '1', 'badge did not show 1')
    console.log('   new item is unread, badge is 1')

    console.log('3. read and star the item')
    const opened = await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('New RSS item 1')
      )
      if (!button) return false
      button.click()
      return true
    })()`)
    assert(opened, 'new item row not found')

    await waitFor(async () => {
      const posts = await dbAll('posts')
      return posts.find((post) => post.title === 'New RSS item 1')?.status === true
    }, 'opening the item did not mark it read')
    await waitFor(async () => (await badge()) === '', 'badge did not clear after reading')

    console.log('3a. pin the open post')
    const pinPoint = await evaluate(`(() => {
      const button = document.querySelector('button[aria-label="Open pinned post"]')
      const rect = button.getBoundingClientRect()
      return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2}
    })()`)
    await popup.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: pinPoint.x,
      y: pinPoint.y
    })
    await sleep(650)
    assert(
      (await evaluate(`document.querySelector('[data-slot="tooltip-content"]')?.textContent`)) ===
        'Open pinned post',
      'pin tooltip did not appear after the delay'
    )
    const tooltipBox = await evaluate(`(() => {
      const element = document.querySelector('[data-slot="tooltip-content"]')
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {x: rect.x, y: rect.y, width: rect.width, height: rect.height}
    })()`)
    assert(
      tooltipBox &&
        tooltipBox.y >= 0 &&
        tooltipBox.y < 600 &&
        Math.abs(tooltipBox.x + tooltipBox.width / 2 - pinPoint.x) < 4,
      'pin tooltip was not anchored to its button'
    )
    await evaluate(`document.querySelector('button[aria-label="Open pinned post"]')?.click()`)
    const pinnedTarget = await waitFor(async () => {
      const list = await targets(port)
      return list.find((target) => target.url.includes('?pinnedPost=')) ?? false
    }, 'pinned window did not open')
    const pinned = await Cdp.connect(pinnedTarget.webSocketDebuggerUrl)
    await pinned.send('Runtime.enable')
    await pinned.send('Page.enable')
    const pinnedEval = (expression) => pinned.evaluate(expression)
    await waitFor(
      () => pinnedEval(`document.querySelector('article h1')?.textContent === 'New RSS item 1'`),
      'pinned window did not render the post'
    )
    assert(
      await pinnedEval(`!document.querySelector('aside') && !document.body.innerText.includes('Search all feeds')`),
      'pinned window rendered app chrome'
    )
    assert(
      await pinnedEval(`Boolean(document.querySelector('button[aria-label="Close pinned window"]'))`),
      'pinned window close button missing'
    )
    const pinnedWindow = await pinnedEval(
      `chrome.windows.getCurrent().then((win) => ({id: win.id, state: win.state, left: win.left, top: win.top, width: win.width, height: win.height}))`
    )
    assert(pinnedWindow.state === 'normal', 'pinned window did not open as a normal window')
    assert(pinnedWindow.width === 600, 'pinned window did not use its normal width')
    const pinnedWindowId = pinnedWindow.id
    await pinnedEval(
      `chrome.windows.update(${pinnedWindowId}, {width: 700, height: 800})`
    )
    await waitFor(
      () => pinnedEval(`window.innerWidth === 700`),
      'pinned window did not resize'
    )
    await pinnedEval(
      `document.querySelector('button[aria-label="Close pinned window"]')?.click()`
    )
    await waitFor(async () => {
      const list = await targets(port)
      return !list.some((target) => target.url.includes('?pinnedPost='))
    }, 'pinned window did not close')
    pinned.close()
    console.log('   pinned post window opened, resized and closed')

    await evaluate(`document.querySelector('button[aria-label="Back to posts"]')?.click()`)

    const starred = await evaluate(`(() => {
      const open = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('New RSS item 1')
      )
      const star = open?.parentElement?.querySelector('button[aria-label="Star post"]')
      if (!star) return false
      star.click()
      return true
    })()`)
    assert(starred, 'star button not found')
    await waitFor(async () => {
      const posts = await dbAll('posts')
      return posts.find((post) => post.title === 'New RSS item 1')?.starred === true
    }, 'star did not persist')
    await waitFor(
      () =>
        evaluate(`(() => {
          const view = [...document.querySelectorAll('aside button')].find((candidate) =>
            candidate.textContent?.includes('Starred')
          )
          return view?.querySelector('[data-slot="badge"]')?.textContent?.trim() === '1'
        })()`),
      'Starred count badge did not show 1'
    )
    assert(
      (await badge()) === '',
      'starring a post changed the toolbar unread badge'
    )

    await evaluate(`(() => {
      const view = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('Starred')
      )
      view?.click()
    })()`)
    await waitFor(
      async () => (await bodyText()).includes('New RSS item 1'),
      'starred view does not contain the item'
    )
    console.log('   read/star persisted and Starred view shows the item')

    console.log('3b. mark all as read')
    await evaluate(`(() => {
      const view = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('All posts')
      )
      view?.click()
    })()`)
    await fetch(`${fixture.url}/add-item`)
    await command({type: 'feed:refresh-all'})
    await waitFor(async () => {
      const posts = await dbAll('posts')
      return posts.filter((post) => !post.status).length === 1 && (await badge()) === '1'
    }, 'new unread post did not arrive')
    await waitFor(
      () => evaluate(`(() => {
        const button = document.querySelector('button[aria-label="Mark all as read"]')
        return Boolean(button && !button.disabled)
      })()`),
      'mark-all button was not enabled'
    )
    const markAllPoint = await evaluate(`(() => {
      const button = document.querySelector('button[aria-label="Mark all as read"]')
      const rect = button.getBoundingClientRect()
      return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2}
    })()`)
    await popup.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: markAllPoint.x,
      y: markAllPoint.y
    })
    await waitFor(
      () => evaluate(`[...document.querySelectorAll('[data-slot="tooltip-content"]')].some((element) => element.textContent === 'Mark all as read')`),
      'mark-all tooltip did not appear after the delay',
      3_000
    )
    await evaluate(
      `document.querySelector('button[aria-label="Mark all as read"]')?.click()`
    )
    await waitFor(async () => {
      const posts = await dbAll('posts')
      return posts.every((post) => post.status) && (await badge()) === ''
    }, 'mark all as read did not clear unread posts and the badge')
    console.log('   mark all as read cleared the list and the badge')

    console.log('3c. search as you type')
    await evaluate(`(() => {
      const input = document.querySelector('input[aria-label="Search all feeds"]')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, 'New RSS')
      input.dispatchEvent(new Event('input', {bubbles: true}))
      return true
    })()`)
    await waitFor(
      async () =>
        (await bodyText()).includes('Results for “New RSS”') &&
        (await bodyText()).includes('New RSS item 1'),
      'search-as-you-type did not filter results'
    )
    assert(
      !(await bodyText()).includes('RSS One'),
      'search-as-you-type did not hide non-matching posts'
    )
    await evaluate(`document.querySelector('button[aria-label="Clear search"]')?.click()`)
    await waitFor(
      async () =>
        (await bodyText()).includes('All posts') &&
        !(await bodyText()).includes('Results for'),
      'clearing search did not restore the previous view'
    )
    console.log('   typing filtered results after debounce; clearing restored All posts')

    console.log('4. import OPML')
    const opml = await (await fetch(`${fixture.url}/opml.xml`)).text()
    const imported = await command({type: 'opml:import', xml: opml})
    assert(
      imported.data?.feeds === 2 && imported.data?.folders === 1,
      'OPML import counts are wrong'
    )
    const folders = await dbAll('folders')
    assert(folders.length === 1 && folders[0].name === 'Tech / Nested', 'folder missing')
    console.log('   OPML imported 2 feeds into 1 folder')

    console.log('5. enforce retention')
    await command({type: 'feed:add', url: `${fixture.url}/retention.xml`})
    await waitFor(async () => {
      const feeds = await dbAll('feeds')
      const retention = feeds.find((feed) => feed.url.endsWith('/retention.xml'))
      if (!retention) return false
      const posts = (await dbAll('posts')).filter((post) => post.feedId === retention.id)
      return posts.length === 50 && posts.every((post) => post.status)
    }, 'retention did not keep 50 read posts')
    console.log('   retention kept the newest 50 posts')

    console.log('6. detect feeds from page markup and probing')
    const article = await discoverPage('/article.html', '/article.rss')
    const probe = await discoverPage('/probe', '/probe.rss')
    const redditLike = await discoverPage('/reddit-like/news/', '/reddit-like/news.rss')
    const redditDirect = await discoverPage(
      '/reddit-like/news.rss',
      '/reddit-like/news.rss'
    )

    assert(article.feeds.length === 1, 'article link feed was not found')
    assert(probe.feeds.length === 1, 'probe feed was not found')
    assert(redditLike.feeds.length === 1, 'reddit-like page feed was not found')
    assert(
      redditDirect.feeds.some((feed) => feed.source === 'page'),
      'direct reddit-like feed URL was not recognized'
    )
    console.log('   link, probe, reddit-like and direct-feed detection passed')

    const addButtonState = () =>
      evaluate(
        `(() => {
          const button = document.querySelector('button[aria-label="Add feed"]')
          return button ? {exists: true, disabled: button.disabled} : {exists: false}
        })()`
      )

    console.log('7. open Settings > Feeds from the toolbar button')
    await popup.send('Page.reload', {ignoreCache: true})
    await waitFor(
      async () => (await addButtonState())?.disabled === false,
      'add-feed toolbar button was not enabled'
    )
    assert(
      !(await bodyText()).includes('Settings'),
      'Settings opened automatically'
    )
    await evaluate(
      `document.querySelector('button[aria-label="Add feed"]')?.click()`
    )
    await waitFor(
      async () =>
        (await bodyText()).includes('Settings') &&
        (await evaluate(`Boolean(document.querySelector('input[aria-label="Feed URL"]'))`)),
      'add-feed toolbar button did not open Settings > Feeds'
    )
    const detectedUrl = await evaluate(
      `document.querySelector('input[aria-label="Feed URL"]')?.value ?? ''`
    )
    assert(
      detectedUrl.includes('/reddit-like/news.rss'),
      'detected URL was not prefilled'
    )
    await evaluate(`document.querySelector('button[aria-label="Back to reader"]')?.click()`)
    await waitFor(
      async () => !(await bodyText()).includes('Settings'),
      'back did not return to the reader'
    )
    console.log('   the + button opened Settings > Feeds and prefilled the URL')

    await evaluate(
      `document.querySelector('button[aria-label="Add feed"]')?.click()`
    )
    await waitFor(
      async () => (await bodyText()).includes('Settings'),
      'Settings did not reopen'
    )
    await evaluate(`(() => {
      const input = document.querySelector('input[aria-label="Match words"]')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, 'reddit')
      input.dispatchEvent(new Event('input', {bubbles: true}))
      return true
    })()`)
    await evaluate(`(() => {
      const input = document.querySelector('input[aria-label="New feed post limit"]')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '10')
      input.dispatchEvent(new Event('input', {bubbles: true}))
      return true
    })()`)
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.trim() === 'Add feed'
      )
      button?.click()
    })()`)
    await waitFor(
      async () =>
        (await bodyText()).includes('Settings') &&
        (await bodyText()).includes('reddit-like/news.rss'),
      'adding the detected feed did not refresh the feed list'
    )
    await waitFor(async () => {
      const feeds = await dbAll('feeds')
      return feeds.some(
        (feed) =>
          feed.url.includes('/reddit-like/news.rss') && feed.retentionPerFeed === 10
      )
    }, 'per-feed post limit was not stored')
    await evaluate(`document.querySelector('button[aria-label="Back to reader"]')?.click()`)
    await waitFor(
      async () => !(await bodyText()).includes('Settings'),
      'did not return to the reader after adding'
    )
    await waitFor(
      async () => (await bodyText()).includes('Matches: reddit'),
      'watch-word indicator did not appear on the feed row'
    )
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('aside button')].find((candidate) =>
        candidate.textContent?.includes('Fixture Reddit')
      )
      button?.click()
    })()`)
    await waitFor(
      async () =>
        (await evaluate(`document.querySelectorAll('mark.match-highlight').length`)) > 0,
      'watch-word highlight did not appear in the post list'
    )
    await waitFor(
      async () =>
        (await evaluate(`document.querySelectorAll('[data-slot="post-match-dot"]').length`)) > 0,
      'watch-word dot did not appear on matching post rows'
    )
    const matchDotPoint = await evaluate(`(() => {
      const dot = document.querySelector('[data-slot="post-match-dot"]')
      if (!dot) return null
      const rect = dot.getBoundingClientRect()
      return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2}
    })()`)
    assert(matchDotPoint, 'match dot was not positioned for the hover check')
    await popup.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: matchDotPoint.x,
      y: matchDotPoint.y
    })
    await waitFor(
      () =>
        evaluate(
          `[...document.querySelectorAll('[data-slot="tooltip-content"]')].some((element) => element.textContent === 'Matched: reddit')`
        ),
      'post match tooltip did not appear after hovering the yellow dot',
      3_000
    )
    console.log('   submitting the form added the feed, stayed in Settings and stored its post limit')
    console.log('   the watch word appeared as a feed indicator, post dot and hover tooltip')

    await popup.send('Page.reload', {ignoreCache: true})
    const activeDiscovery = await waitFor(async () => {
      const result = await evaluate(
        `chrome.runtime.sendMessage({type: 'discovery:active'})`
      )
      return result?.ok && result.data.feeds.every((feed) => feed.subscribed)
        ? result
        : false
    }, 'subscribed feed was still reported as unsubscribed')
    assert(activeDiscovery.data.feeds.length > 0, 'no feeds were detected on reload')
    await waitFor(
      async () => (await addButtonState())?.disabled === false,
      'add-feed button should stay available for manual adds'
    )
    await evaluate(
      `document.querySelector('button[aria-label="Add feed"]')?.click()`
    )
    await waitFor(
      async () => (await bodyText()).includes('Settings'),
      'manual add did not open Settings > Feeds'
    )
    assert(
      (await evaluate(
        `document.querySelector('input[aria-label="Feed URL"]')?.value ?? null`
      )) === '',
      'subscribed-only page should open an empty add form'
    )
    await evaluate(`document.querySelector('button[aria-label="Back to reader"]')?.click()`)
    await waitFor(
      async () => !(await bodyText()).includes('Settings'),
      'did not return to the reader from the empty add form'
    )

    await openPage('/multi.html')
    await popup.send('Page.reload', {ignoreCache: true})
    await waitFor(
      async () => (await addButtonState())?.disabled === false,
      'multiple-feed page did not keep the add button enabled'
    )
    await evaluate(
      `document.querySelector('button[aria-label="Add feed"]')?.click()`
    )
    await waitFor(
      async () => (await bodyText()).includes('Settings'),
      'multiple-feed page did not open Settings > Feeds'
    )
    const multiUrl = await evaluate(
      `document.querySelector('input[aria-label="Feed URL"]')?.value ?? ''`
    )
    assert(multiUrl.length > 0, 'multiple-feed page did not prefill a URL')
    await evaluate(`document.querySelector('button[aria-label="Back to reader"]')?.click()`)
    await waitFor(
      async () => !(await bodyText()).includes('Settings'),
      'did not return to the reader from the multiple-feed add form'
    )
    const multiTabId = await pageTabId('/multi.html')
    if (multiTabId) await evaluate(`chrome.tabs.remove(${multiTabId})`)
    console.log('   subscribed-only pages open an empty form; multiple feeds prefill a URL')

    console.log('8. add a cookie-protected feed through the page context')
    const cookie = await discoverPage('/cookie-page', '/cookie-page.rss')
    const cookieFeedUrl = cookie.feeds.find((feed) => feed.url.endsWith('/cookie-page.rss'))?.url
    assert(cookieFeedUrl, 'cookie feed was not detected')
    const cookieAdd = await command({
      type: 'feed:add',
      url: cookieFeedUrl,
      sourceTabId: cookie.tabId
    })
    assert(cookieAdd.ok, 'cookie feed add failed')

    const cookieFeed = await waitFor(async () => {
      const feeds = await dbAll('feeds')
      return feeds.find((feed) => feed.url.endsWith('/cookie-page.rss')) ?? false
    }, 'cookie feed was not stored')
    assert(cookieFeed.fetchMode === 'page', 'cookie feed did not use page mode')
    assert(
      (await dbAll('posts')).filter((post) => post.feedId === cookieFeed.id).length === 2,
      'cookie feed posts were not imported'
    )

    await fetch(`${fixture.url}/add-cookie-item`)
    await command({type: 'feed:refresh', id: cookieFeed.id})
    await waitFor(async () => {
      const posts = (await dbAll('posts')).filter((post) => post.feedId === cookieFeed.id)
      return posts.length === 3
    }, 'page-mode refresh did not add the new post')

    for (const tabId of [
      cookie.tabId,
      article.tabId,
      probe.tabId,
      redditLike.tabId,
      redditDirect.tabId
    ]) {
      await evaluate(`chrome.tabs.remove(${tabId})`).catch(() => {})
    }
    const failedRefresh = await evaluate(
      `chrome.runtime.sendMessage(${JSON.stringify({type: 'feed:refresh', id: cookieFeed.id})})`
    )
    assert(
      failedRefresh?.ok === false &&
        failedRefresh.error.includes('Open a tab on this site'),
      'missing-tab refresh did not report the page-mode error'
    )
    assert(
      (await dbAll('posts')).filter((post) => post.feedId === cookieFeed.id).length === 3,
      'missing-tab refresh deleted existing posts'
    )
    console.log('   page-mode add and refresh worked; missing-tab error kept posts')

    console.log('9. change theme and interval')
    await evaluate(
      `document.querySelector('button[aria-label="Open settings"]')?.click()`
    )
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('select[aria-label="Theme"]'))`),
      'settings view did not open'
    )
    await evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Theme"]')
      select.value = 'dark'
      select.dispatchEvent(new Event('change', {bubbles: true}))
    })()`)
    await waitFor(
      () => evaluate(`document.documentElement.classList.contains('dark')`),
      'dark theme was not applied'
    )
    await evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Refresh interval"]')
      select.value = '300'
      select.dispatchEvent(new Event('change', {bubbles: true}))
    })()`)
    await evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Start view"]')
      select.value = 'starred'
      select.dispatchEvent(new Event('change', {bubbles: true}))
    })()`)
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('input[aria-label="Remember app state"]'))`),
      'remember app state setting did not render'
    )
    assert(
      await evaluate(`document.querySelector('input[aria-label="Remember app state"]')?.checked === true`),
      'remember app state should default on'
    )
    await waitFor(async () => {
      const settings = await dbAll('settings')
      return (
        settings.find((row) => row.key === 'theme')?.value === 'dark' &&
        settings.find((row) => row.key === 'refreshInterval')?.value === 300 &&
        settings.find((row) => row.key === 'startView')?.value === 'starred'
      )
    }, 'settings did not persist')

    console.log('9b. inspect the Storage table')
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.trim() === 'Storage'
      )
      button?.click()
    })()`)
    await waitFor(
      async () =>
        (await bodyText()).includes('IndexedDB') &&
        (await bodyText()).includes('Statistics') &&
        (await bodyText()).includes('Clear all data'),
      'Storage section did not render'
    )
    await waitFor(
      async () =>
        (await evaluate(`document.querySelectorAll('table tbody tr').length`)) === 4,
      'Storage table did not show all four Dexie stores'
    )
    const storeLabels = await evaluate(
      `[...document.querySelectorAll('table tbody tr')].map((row) => row.textContent ?? '')`
    )
    assert(
      ['Feeds', 'Folders', 'Posts', 'Settings'].every((label) =>
        storeLabels.some((row) => row.includes(label))
      ),
      'Storage table is missing a store'
    )
    console.log('   storage table and statistics rendered')

    await evaluate(`document.querySelector('button[aria-label="Back to reader"]')?.click()`)
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('select[aria-label="Theme"]')) === false`),
      'did not return to the reader'
    )
    await evaluate(`(() => {
      const view = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('All posts')
      )
      view?.click()
    })()`)

    console.log('9c. restore app state')
    await evaluate(`(() => {
      const folder = [...document.querySelectorAll('aside button')].find((candidate) =>
        candidate.textContent?.includes('Tech / Nested')
      )
      folder?.click()
    })()`)
    await waitFor(
      () => evaluate(`!document.querySelector('aside')?.innerText.includes('Fixture Atom')`),
      'folder did not collapse'
    )
    await evaluate(`(() => {
      const feed = [...document.querySelectorAll('aside button')].find((candidate) =>
        candidate.textContent?.includes('Fixture RSS')
      )
      feed?.click()
    })()`)
    await waitFor(
      () => evaluate(`[...document.querySelectorAll('button[aria-current="page"]')].some((button) => button.textContent?.includes('Fixture RSS'))`),
      'feed was not selected'
    )
    await waitFor(
      () => evaluate(`[...document.querySelectorAll('button')].some((candidate) => candidate.textContent?.includes('RSS One'))`),
      'feed posts did not render'
    )
    await evaluate(`(() => {
      const post = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('RSS One')
      )
      post?.click()
    })()`)
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('button[aria-label="Back to posts"]'))`),
      'post reader did not open'
    )
    await waitFor(async () => {
      const saved = (await dbAll('settings')).find((row) => row.key === 'uiState')?.value
      return (
        saved?.selection?.kind === 'feed' &&
        Boolean(saved.selection.feedId) &&
        saved.collapsedFolderIds?.length === 1 &&
        Boolean(saved.openPostId)
      )
    }, 'app state was not saved')

    await popup.send('Page.reload', {ignoreCache: true})
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('button[aria-label="Back to posts"]'))`),
      'open post was not restored'
    )
    await waitFor(
      () => evaluate(`[...document.querySelectorAll('button[aria-current="page"]')].some((button) => button.textContent?.includes('Fixture RSS'))`),
      'selected feed was not restored'
    )
    assert(
      await evaluate(`!document.querySelector('aside')?.innerText.includes('Fixture Atom')`),
      'collapsed folder was not restored'
    )
    assert(
      (await evaluate(`document.querySelector('article h1')?.textContent`)) === 'RSS One',
      'restored post is not the one that was open'
    )
    console.log('   view, collapsed folder and open post survived reload')

    await evaluate(`document.querySelector('button[aria-label="Open settings"]')?.click()`)
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('input[aria-label="Remember app state"]'))`),
      'remember app state setting did not render'
    )
    await evaluate(`document.querySelector('input[aria-label="Remember app state"]')?.click()`)
    await waitFor(async () => {
      const settings = await dbAll('settings')
      return (
        settings.find((row) => row.key === 'persistUiState')?.value === false &&
        !settings.some((row) => row.key === 'uiState')
      )
    }, 'disabling restore did not clear saved state')
    await evaluate(`document.querySelector('button[aria-label="Back to reader"]')?.click()`)
    await waitFor(
      () => evaluate(`Boolean(document.querySelector('select[aria-label="Theme"]')) === false`),
      'did not return to the reader after disabling restore'
    )

    console.log('10. reload offline')
    await fixture.close()
    await popup.send('Page.reload', {ignoreCache: true})
    await waitFor(
      () => evaluate(`document.documentElement.classList.contains('dark')`),
      'theme did not survive reload'
    )
    await waitFor(
      () => evaluate(`[...document.querySelectorAll('button[aria-current="page"]')].some((button) => button.textContent?.includes('Starred'))`),
      'start view did not apply on reload'
    )
    await waitFor(
      async () => (await bodyText()).includes('New RSS item 1'),
      'stored posts did not render offline'
    )
    console.log('   stored posts, theme and start view survived an offline reload')

    console.log('\nE2E smoke passed')
  } finally {
    popup?.close()
    chrome.kill('SIGTERM')
    await sleep(500)
    await rm(profile, {recursive: true, force: true})
    await fixture.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(`\nE2E smoke failed: ${error.message}`)
  process.exitCode = 1
})
