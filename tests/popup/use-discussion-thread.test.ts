// @vitest-environment jsdom
import React from 'react'
import {createRoot} from 'react-dom/client'
import {act} from 'react-dom/test-utils'
import {describe, expect, it} from 'vitest'
import {
  useDiscussionThread,
  type DiscussionState
} from '../../src/popup/hooks/use-discussion-thread'

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return {promise, resolve, reject}
}

describe('useDiscussionThread', () => {
  it('retries after an error, keeps the thread on a failed reload, and aborts on unmount', async () => {
    const requests = [
      deferred<string>(),
      deferred<string>(),
      deferred<string>()
    ]
    let requestIndex = 0
    let latest: DiscussionState<string> | undefined
    let reload: (() => void) | undefined
    const signals: AbortSignal[] = []

    function Probe() {
      const result = useDiscussionThread((signal) => {
        signals.push(signal)
        return requests[requestIndex++].promise
      }, [])
      latest = result.state
      reload = result.reload
      return null
    }

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(React.createElement(Probe))
    })
    expect(latest?.status).toBe('loading')

    await act(async () => {
      requests[0].reject(new Error('no'))
    })
    expect(latest).toEqual({status: 'error'})

    await act(async () => {
      reload?.()
    })
    expect(latest?.status).toBe('loading')

    await act(async () => {
      requests[1].resolve('one')
    })
    expect(latest).toEqual({
      status: 'ready',
      thread: 'one',
      refreshing: false,
      refreshError: false
    })

    await act(async () => {
      reload?.()
    })
    expect(latest).toEqual({
      status: 'ready',
      thread: 'one',
      refreshing: true,
      refreshError: false
    })

    await act(async () => {
      requests[2].reject(new Error('no'))
    })
    expect(latest).toEqual({
      status: 'ready',
      thread: 'one',
      refreshing: false,
      refreshError: true
    })

    const lastSignal = signals.at(-1)
    await act(async () => {
      root.unmount()
    })
    expect(lastSignal?.aborted).toBe(true)
  })
})
