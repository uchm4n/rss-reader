export async function notifyNewPosts(feedTitle: string, count: number): Promise<void> {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('extension-icons/icon-unread-128.png'),
        title: 'RSS Reader',
        message:
            count === 1
                ? `1 new post in ${feedTitle}`
                : `${count} new posts in ${feedTitle}`
    })
}
