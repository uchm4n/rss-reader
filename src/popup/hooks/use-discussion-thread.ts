import {
    type DependencyList,
    useEffect,
    useRef,
    useState
} from 'react'

export type DiscussionState<T> =
    | { status: 'loading' }
    | { status: 'error' }
    | {
          status: 'ready'
          thread: T
          refreshing: boolean
          refreshError: boolean
      }

export function useDiscussionThread<T>(
    loader: (signal: AbortSignal) => Promise<T>,
    deps: DependencyList
): {
    state: DiscussionState<T>
    reload: () => void
} {
    const [state, setState] = useState<DiscussionState<T>>({status: 'loading'})
    const [request, setRequest] = useState(0)
    const loaderRef = useRef(loader)
    loaderRef.current = loader

    useEffect(() => {
        let active = true
        const controller = new AbortController()

        setState((current) =>
            current.status === 'ready'
                ? {...current, refreshing: true, refreshError: false}
                : {status: 'loading'}
        )

        loaderRef
            .current(controller.signal)
            .then((thread) => {
                if (active) {
                    setState({
                        status: 'ready',
                        thread,
                        refreshing: false,
                        refreshError: false
                    })
                }
            })
            .catch(() => {
                if (!active || controller.signal.aborted) return
                setState((current) =>
                    current.status === 'ready'
                        ? {...current, refreshing: false, refreshError: true}
                        : {status: 'error'}
                )
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [...deps, request])

    return {
        state,
        reload: () => setRequest((value) => value + 1)
    }
}
