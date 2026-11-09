import {type ClipboardEvent, type KeyboardEvent, useState} from 'react'
import {X} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {
    MAX_MATCH_WORD_LENGTH,
    sanitizeMatchWords
} from '@/shared/model/match-words'

interface MatchWordsInputProps {
    value: string[]
    onChange: (words: string[]) => void
    className?: string
}

export function MatchWordsInput({value, onChange, className}: MatchWordsInputProps) {
    const [draft, setDraft] = useState('')

    const commit = (raw: string) => {
        const entries = raw.split(/[,\n]+/)
        const next = sanitizeMatchWords([...value, ...entries])
        if (next.length !== value.length) onChange(next)
        setDraft('')
    }

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            if (draft.trim()) commit(draft)
            return
        }

        if (event.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
        }
    }

    const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const text = event.clipboardData.getData('text')
        if (!/[,\n]/.test(text)) return
        event.preventDefault()
        commit(text)
    }

    return (
        <div
            className={cn(
                'flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 text-xs focus-within:ring-1 focus-within:ring-ring',
                className
            )}
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
                        onClick={() => onChange(value.filter((item) => item !== word))}
                        className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    >
                        <X className="size-2.5"/>
                    </button>
                </Badge>
            ))}
            <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => {
                    if (draft.trim()) commit(draft)
                }}
                aria-label="Match words"
                placeholder={value.length ? '' : 'Match words…'}
                maxLength={MAX_MATCH_WORD_LENGTH}
                className="h-5 min-w-20 flex-1 bg-transparent px-0.5 text-xs outline-none placeholder:text-muted-foreground"
            />
        </div>
    )
}
