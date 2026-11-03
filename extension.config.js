import path from 'node:path'

const profile = (name) => `./dist/extension-profile-${name}`

/** @type {import('extension').FileConfig} */
export default {
  browser: {
    chrome: {profile: profile('chrome')},
    chromium: {profile: profile('chromium')}
  },
  commands: {
    build: {polyfill: false},
    dev: {polyfill: false},
    preview: {polyfill: false},
    start: {polyfill: false}
  },
  config: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(process.cwd(), 'src')
    }
    return config
  }
}
