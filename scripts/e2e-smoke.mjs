import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {existsSync, readdirSync} from 'node:fs'
import {homedir, tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {startFixtureServer} from '../tests/e2e/fixture-server.mjs'

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
    assert((await badge()) === '', 'badge should be clear after the first fetch')
    console.log('   first fetch imported 3 posts as read')

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
      return posts.length === 200 && posts.every((post) => post.status)
    }, 'retention did not keep 200 read posts')
    console.log('   retention kept the newest 200 posts')

    console.log('6. change theme and interval')
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
    await waitFor(async () => {
      const settings = await dbAll('settings')
      return (
        settings.find((row) => row.key === 'theme')?.value === 'dark' &&
        settings.find((row) => row.key === 'refreshInterval')?.value === 300 &&
        settings.find((row) => row.key === 'startView')?.value === 'starred'
      )
    }, 'settings did not persist')

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

    console.log('7. reload offline')
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
