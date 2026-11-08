import type {SafeEmbed} from './embed'

export function createMediaCard(embed: SafeEmbed): HTMLAnchorElement {
    const card = document.createElement('a')
    card.className = 'media-card'
    card.href = embed.pageUrl ?? embed.url
    card.target = '_blank'
    card.rel = 'noreferrer noopener'
    card.setAttribute('aria-label', `Watch on ${embed.provider}`)

    if (embed.thumbnailUrl) {
        const image = document.createElement('img')
        image.setAttribute('src', embed.thumbnailUrl)
        image.setAttribute('alt', '')
        image.setAttribute('loading', 'lazy')
        image.setAttribute('decoding', 'async')
        image.setAttribute('referrerpolicy', 'no-referrer')
        card.append(image)
    } else {
        card.classList.add('media-card-no-thumb')
    }

    const play = document.createElement('span')
    play.className = 'media-card-play'
    play.setAttribute('aria-hidden', 'true')
    play.textContent = '▶'

    const label = document.createElement('span')
    label.className = 'media-card-label'
    label.textContent = embed.provider

    card.append(play, label)
    return card
}
