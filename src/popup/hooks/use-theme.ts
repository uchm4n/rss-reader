import {useEffect} from 'react'
import type {AppSettings} from '@/db/types'
import {useSettings} from './use-settings'

export function resolveTheme(
    theme: AppSettings['theme'],
    systemDark: boolean
): 'light' | 'dark' {
    if (theme === 'system') return systemDark ? 'dark' : 'light'
    return theme
}

export function useTheme(): void {
    const settings = useSettings()
    const theme = settings?.theme ?? 'system'

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return

        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const apply = () => {
            document.documentElement.classList.toggle(
                'dark',
                resolveTheme(theme, media.matches) === 'dark'
            )
        }

        apply()

        if (theme !== 'system') return
        media.addEventListener('change', apply)
        return () => media.removeEventListener('change', apply)
    }, [theme])
}
