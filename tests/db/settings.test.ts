import {afterEach, describe, expect, it} from 'vitest'
import {db} from '../../src/db/db'
import {DEFAULT_SETTINGS, getSettings, setSetting} from '../../src/db/settings'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('settings repository', () => {
  it('returns defaults when no settings are stored', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('updates one key without touching the others', async () => {
    await setSetting('theme', 'dark')

    const settings = await getSettings()
    expect(settings.theme).toBe('dark')
    expect(settings.refreshInterval).toBe(DEFAULT_SETTINGS.refreshInterval)
    expect(settings.retentionPerFeed).toBe(DEFAULT_SETTINGS.retentionPerFeed)
    expect(settings.persistUiState).toBe(false)
  })

  it('persists settings across a fresh read', async () => {
    await setSetting('retentionPerFeed', 50)
    await setSetting('notifications', true)
    await setSetting('persistUiState', true)

    const settings = await getSettings()
    expect(settings.retentionPerFeed).toBe(50)
    expect(settings.notifications).toBe(true)
    expect(settings.persistUiState).toBe(true)
  })
})
