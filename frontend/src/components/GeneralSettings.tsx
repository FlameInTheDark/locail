import React from 'react'

type ThemePref = 'system' | 'light' | 'dark'

type Props = {
  theme: ThemePref
  onChangeTheme: (value: ThemePref) => void
}

export default function GeneralSettings({ theme, onChangeTheme }: Props) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-sm font-medium mb-1">Appearance</div>
        <div className="text-xs text-muted-foreground mb-2">Choose color scheme for the app</div>
        <div className="inline-flex items-center rounded-md border overflow-hidden" role="group" aria-label="Color scheme">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm ${theme === 'system' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-slate-200 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            onClick={() => onChangeTheme('system')}
          >
            System
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm border-l ${theme === 'light' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-slate-200 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            onClick={() => onChangeTheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm border-l ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-slate-200 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            onClick={() => onChangeTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>
    </div>
  )
}
