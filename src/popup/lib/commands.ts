import type {Command, CommandResult} from '@/background/messages'

export async function sendCommand<T = unknown>(command: Command): Promise<T> {
    const result = await new Promise<CommandResult | undefined>((resolve, reject) => {
        chrome.runtime.sendMessage(command, (response: CommandResult | undefined) => {
            const error = chrome.runtime.lastError
            if (error) {
                reject(new Error(error.message ?? 'Background worker unavailable'))
                return
            }
            resolve(response)
        })
    })

    if (!result) {
        throw new Error(
            'No response from the background worker. Reload the extension and try again.'
        )
    }
    if (!result.ok) throw new Error(result.error)

    return result.data as T
}
