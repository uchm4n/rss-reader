export function attachVideoAudio(root: ParentNode): () => void {
    const cleanups: Array<() => void> = []

    for (const video of root.querySelectorAll<HTMLVideoElement>(
        'video[data-audio-src]'
    )) {
        const src = video.dataset.audioSrc
        if (!src) continue

        const audio = new Audio(src)
        audio.preload = 'auto'
        audio.hidden = true
        audio.style.display = 'none'
        audio.dataset.videoAudio = ''
        video.after(audio)

        const sync = () => {
            try {
                audio.currentTime = video.currentTime
            } catch {
                // Media metadata may not be ready yet; the next event resyncs.
            }
        }
        const play = () => {
            sync()
            audio.volume = video.volume
            audio.muted = video.muted
            audio.playbackRate = video.playbackRate
            void audio.play().catch(() => {})
        }
        const pause = () => audio.pause()
        const seek = () => {
            if (Math.abs(audio.currentTime - video.currentTime) > 0.5) sync()
        }
        const volume = () => {
            audio.volume = video.volume
            audio.muted = video.muted
        }
        const rate = () => {
            audio.playbackRate = video.playbackRate
        }
        const ended = () => audio.pause()

        video.addEventListener('play', play)
        video.addEventListener('playing', play)
        video.addEventListener('pause', pause)
        video.addEventListener('waiting', pause)
        video.addEventListener('seeking', sync)
        video.addEventListener('timeupdate', seek)
        video.addEventListener('volumechange', volume)
        video.addEventListener('ratechange', rate)
        video.addEventListener('ended', ended)

        if (!video.paused) play()

        cleanups.push(() => {
            video.removeEventListener('play', play)
            video.removeEventListener('playing', play)
            video.removeEventListener('pause', pause)
            video.removeEventListener('waiting', pause)
            video.removeEventListener('seeking', sync)
            video.removeEventListener('timeupdate', seek)
            video.removeEventListener('volumechange', volume)
            video.removeEventListener('ratechange', rate)
            video.removeEventListener('ended', ended)
            audio.pause()
            audio.remove()
        })
    }

    return () => {
        for (const cleanup of cleanups) cleanup()
    }
}
