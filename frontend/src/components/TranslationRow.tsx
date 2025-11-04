import React, {useRef} from 'react'
import { Languages, Save } from 'lucide-react'

export type Entry = {
  unitId: number
  key: string
  source: string
  translation: string
  draft: string
  status: string
}

type TranslationRowProps = {
  entry: Entry
  targetLang: string
  checked: boolean
  onToggle: (checked: boolean) => void
  onChange: (value: string) => void
  onTranslate: () => void
  onSave: () => void
}

function Row({ entry, targetLang, checked, onToggle, onChange, onTranslate, onSave }: TranslationRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const value = entry.draft

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <tr data-key={entry.key} data-source={entry.source}>
      <td className="px-3 py-2 align-top">
        <input type="checkbox" className="row-check rounded" checked={checked} onChange={event => onToggle(event.target.checked)} />
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs text-slate-700 truncate key">{entry.key}</td>
      <td className="px-3 py-2 align-top text-slate-800 source">{entry.source}</td>
      <td className="px-3 py-2 align-top text-slate-500 old">{entry.translation || '—'}</td>
      <td className="px-3 py-2 align-top">
        <textarea
          ref={textareaRef}
          className="tgt w-full rounded-xl border-slate-300 px-2 py-1 leading-6"
          rows={1}
          placeholder="Type translation…"
          value={value}
          onFocus={adjustHeight}
          onChange={event => { onChange(event.target.value); adjustHeight() }}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="AI translate this row"
            aria-label="AI translate this row"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
            onClick={onTranslate}
          >
            <Languages className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Save this translation"
            aria-label="Save this translation"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
            onClick={onSave}
          >
            <Save className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default React.memo(Row, (prev, next) => {
  return (
    prev.entry.unitId === next.entry.unitId &&
    prev.entry.draft === next.entry.draft &&
    prev.entry.translation === next.entry.translation &&
    prev.entry.source === next.entry.source &&
    prev.checked === next.checked &&
    prev.targetLang === next.targetLang
  )
})
