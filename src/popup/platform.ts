export function openExternal(url: string): void {
    void chrome.tabs.create({url})
}
