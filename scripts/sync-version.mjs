import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = path.join(root, 'package.json')
const manifestPath = path.join(root, 'src/manifest.json')

const pkg = JSON.parse(await readFile(packagePath, 'utf8'))
if (!/^\d+(?:\.\d+){0,3}$/.test(pkg.version)) {
  throw new Error(`package.json version is not Chrome-compatible: ${pkg.version}`)
}

const manifest = await readFile(manifestPath, 'utf8')
const next = manifest.replace(
  /(^\s*"version"\s*:\s*")[^"]+(")/m,
  `$1${pkg.version}$2`
)

if (next === manifest && !manifest.includes(`"version": "${pkg.version}"`)) {
  throw new Error('Could not find the top-level version in src/manifest.json')
}

if (next === manifest) {
  console.log(`src/manifest.json already at ${pkg.version}`)
} else {
  await writeFile(manifestPath, next)
  console.log(`Synced src/manifest.json to ${pkg.version}`)
}
