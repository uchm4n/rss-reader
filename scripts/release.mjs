import {execFileSync, spawnSync} from 'node:child_process'
import {existsSync, readFileSync, rmSync, statSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = path.join(root, 'package.json')
const lockPath = path.join(root, 'package-lock.json')
const manifestPath = path.join(root, 'src/manifest.json')
const chromeDir = path.join(root, 'dist', 'chrome')
const versionFiles = ['package.json', 'package-lock.json', 'src/manifest.json']
const bumpTypes = new Set(['patch', 'minor', 'major'])

function run(command, args, options = {}) {
    return execFileSync(command, args, {
        cwd: root,
        stdio: 'inherit',
        ...options
    })
}

function capture(command, args) {
    return execFileSync(command, args, {
        cwd: root,
        encoding: 'utf8'
    }).trim()
}

function readJson(file) {
    return JSON.parse(readFileSync(file, 'utf8'))
}

function fail(message) {
    throw new Error(message)
}

function bumpVersion(version, type) {
    const parts = version.split('.').map(Number)
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
        fail(`Unsupported version: ${version}`)
    }

    const [major, minor, patch] = parts
    if (type === 'major') return `${major + 1}.0.0`
    if (type === 'minor') return `${major}.${minor + 1}.0`
    return `${major}.${minor}.${patch + 1}`
}

function assertCleanTree() {
    if (capture('git', ['status', '--porcelain'])) {
        fail('Working tree is not clean. Commit or stash changes before releasing.')
    }
}

function assertVersionsInSync() {
    const pkg = readJson(packagePath)
    const lock = readJson(lockPath)
    const manifest = readJson(manifestPath)
    const versions = [pkg.version, lock.version, lock.packages?.['']?.version, manifest.version]

    if (!versions.every((version) => version === pkg.version)) {
        fail('package.json, package-lock.json and src/manifest.json versions differ.')
    }

    return pkg.version
}

function assertTagMissing(tag) {
    const result = spawnSync(
        'git',
        ['rev-parse', '--quiet', '--verify', `refs/tags/${tag}`],
        {cwd: root}
    )
    if (result.status === 0) fail(`Tag ${tag} already exists.`)
}

function assertZipAvailable() {
    const result = spawnSync('zip', ['-v'], {stdio: 'ignore'})
    if (result.status !== 0) fail('The `zip` command is required.')
}

function rollbackVersionFiles() {
    try {
        run('git', ['checkout', 'HEAD', '--', ...versionFiles], {stdio: 'ignore'})
    } catch {
        // Best effort: the original error is more useful.
    }
}

async function main() {
    const type = process.argv[2] ?? 'patch'
    if (!bumpTypes.has(type)) {
        fail('Usage: npm run release [-- patch|minor|major]')
    }

    assertCleanTree()
    const currentVersion = assertVersionsInSync()
    const nextVersion = bumpVersion(currentVersion, type)
    assertTagMissing(nextVersion)
    assertZipAvailable()

    console.log(`Releasing ${currentVersion} -> ${nextVersion}`)

    console.log('\nRunning tests...')
    run('npm', ['test'])

    console.log('\nRunning typecheck...')
    run('npm', ['run', 'typecheck'])

    const zipPath = path.join(root, 'dist', `rss-reader-${nextVersion}.zip`)
    let releaseStarted = false
    let committed = false

    try {
        console.log(`\nBumping to ${nextVersion}...`)
        releaseStarted = true
        run('npm', [
            'version',
            type,
            '--no-git-tag-version',
            '--ignore-scripts'
        ])

        const bumped = readJson(packagePath).version
        if (bumped !== nextVersion) {
            fail(`Expected version ${nextVersion}, got ${bumped}.`)
        }

        console.log('\nSyncing manifest version...')
        run(process.execPath, [path.join(root, 'scripts', 'sync-version.mjs')])

        const synced = assertVersionsInSync()
        if (synced !== nextVersion) {
            fail(`Expected synced version ${nextVersion}, got ${synced}.`)
        }

        console.log('\nBuilding Chrome extension...')
        run('npm', ['run', 'build:chrome'])

        const builtManifest = readJson(path.join(chromeDir, 'manifest.json'))
        if (builtManifest.version !== nextVersion) {
            fail(`Build manifest version is ${builtManifest.version}, expected ${nextVersion}.`)
        }

        console.log('\nCreating release zip...')
        rmSync(zipPath, {force: true})
        run('zip', ['-rX', zipPath, '.', '-x', '.*', '-x', '*/.*'], {
            cwd: chromeDir
        })
        if (!existsSync(zipPath) || statSync(zipPath).size === 0) {
            fail(`Release zip was not created: ${zipPath}`)
        }

        console.log('\nCommitting version bump...')
        run('git', ['add', ...versionFiles])
        run('git', ['commit', '-m', nextVersion])
        committed = true

        console.log('\nTagging release...')
        run('git', ['tag', nextVersion])

        const commit = capture('git', ['rev-parse', '--short', 'HEAD'])
        const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
        console.log(`\nReleased ${nextVersion}`)
        console.log(`  zip:    ${path.relative(root, zipPath)}`)
        console.log(`  commit: ${commit}`)
        console.log(`  tag:    ${nextVersion}`)
        console.log(`\nPush with: git push origin ${branch} --tags`)
    } catch (error) {
        if (releaseStarted && !committed) {
            rollbackVersionFiles()
            rmSync(zipPath, {force: true})
            console.error(`\nRelease failed; rolled back version files.`)
        }
        throw error
    }
}

main().catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
})
