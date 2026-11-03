import type {DiscoveryResult} from '@/background/discovery'

export function firstAddableFeedUrl(discovery: DiscoveryResult | null): string {
    return discovery?.feeds.find((feed) => !feed.subscribed)?.url ?? ''
}
