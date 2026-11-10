import {
    forwardRef,
    type ClipboardEvent,
    type KeyboardEvent,
    useImperativeHandle,
    useRef,
    useState
} from 'react'
import {X} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {
    MAX_MATCH_WORDS,
    MAX_MATCH_WORD_LENGTH,
    sanitizeMatchWords
} from '@/shared/model/match-words'

export type MatchWordRejection = 'duplicate' | 'limit' | 'invalid'

interface MatchWordsInputProps {
    value: string[]
    onChange: (words: string[]) => void
    className?: string
}

export interface MatchWordsInputHandle {
    commit: () => string[]
}

const NOTICE: Record<MatchWordRejection, string> = {
    duplicate: 'Already added',
    limit: 'Limit reached',
    invalid: "Couldn't add that word"
}

export function appendMatchWords(
    current: readonly string[],
    raw: string
): {words: string[]; rejection: MatchWordRejection | null} {
    const entries = raw
        .split(/[,\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    const next = sanitizeMatchWords([...current, ...entries])

    if (next.length > current.length) {
        return {words: next, rejection: null}
    }
    if (current.length >= MAX_MATCH_WORDS) {
        return {words: [...current], rejection: 'limit'}
    }
    if (!entries.some((entry) => sanitizeMatchWords([entry]).length > 0)) {
        return {words: [...current], rejection: 'invalid'}
    }
    return {words: [...current], rejection: 'duplicate'}
}

export const MatchWordsInput = forwardRef<MatchWordsInputHandle, MatchWordsInputProps>(
    function MatchWordsInput({value, onChange, className}, ref) {
        const [draft, setDraft] = useState('')
        const [notice, setNotice] = useState<string | null>(null)
        const inputRef = useRef<HTMLInputElement>(null)
        const valueRef = useRef(value)
        valueRef.current = value
        const atLimit = value.length >= MAX_MATCH_WORDS

        const commit = (raw: string) => {
            const result = appendMatchWords(valueRef.current, raw)
            if (!result.rejection) {
                onChange(result.words)
                setDraft('')
                setNotice(null)
            } else {
                setNotice(NOTICE[result.rejection])
            }
            return result.words
        }

        useImperativeHandle(ref, () => ({
            commit: () => {
                const raw = inputRef.current?.value ?? ''
                return raw.trim() ? commit(raw) : valueRef.current
            }
        }))

        const updateDraft = (value: string) => {
            setDraft(value)
            if (notice) setNotice(null)
        }

        const remove = (word: string) => {
            onChange(value.filter((item) => item !== word))
            setNotice(null)
        }

        const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                if (draft.trim()) commit(draft)
                return
            }

            if (event.key === 'Backspace' && !draft && value.length) {
                onChange(value.slice(0, -1))
                setNotice(null)
            }
        }

        const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
            const text = event.clipboardData.getData('text')
            if (!/[,\n]/.test(text)) return
            event.preventDefault()
            commit(text)
        }

        return (
            <div className={cn('min-w-0 flex-1', className)}>
                <div
                    className="flex max-h-32 min-h-8 flex-wrap items-center gap-1 overflow-y-auto rounded-md border border-input bg-background px-1.5 py-1 text-xs focus-within:ring-1 focus-within:ring-ring"
                >
                    {value.map((word) => (
                        <Badge
                            key={word}
                            variant="secondary"
                            className="h-5 max-w-48 gap-0.5 rounded px-1.5 text-[10px] font-normal"
                        >
                            <span className="truncate">{word}</span>
                            <button
                                type="button"
                                aria-label={`Remove match word ${word}`}
                                onClick={() => remove(word)}
                                className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                            >
                                <X className="size-2.5"/>
                            </button>
                        </Badge>
                    ))}
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={(event) => updateDraft(event.target.value)}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        onBlur={() => {
                            if (draft.trim()) commit(draft)
                        }}
                        aria-label="Match words"
                        placeholder={
                            atLimit ? 'Limit reached' : value.length ? '' : 'Match words…'
                        }
                        maxLength={MAX_MATCH_WORD_LENGTH}
                        disabled={atLimit}
                        className="h-5 min-w-20 flex-1 bg-transparent px-0.5 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                    />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span role="status" aria-live="polite" className="min-w-0 truncate">
                        {notice ?? (atLimit ? 'Limit reached' : '')}
                    </span>
                    <span
                        className={cn(
                            'shrink-0 tabular-nums',
                            atLimit && 'font-medium text-star'
                        )}
                    >
                        {value.length} / {MAX_MATCH_WORDS}
                    </span>
                </div>
            </div>
        )
    }
)
