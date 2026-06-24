import { useState } from 'react'
import { saveConfig, testMondayConnection } from '../api'

function Field({ label, hint, value, onChange, type = 'text', placeholder, badge }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        {badge && (
          <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs text-gray-500">
            {badge}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-accent"
      />
    </div>
  )
}

export default function EntrancePage({ onEnter }) {
  const [mondayKey, setMondayKey] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [mondayStatus, setMondayStatus] = useState(null) // null | 'testing' | 'ok' | 'error'
  const [mondayUser, setMondayUser] = useState('')
  const [mondayError, setMondayError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleTestMonday() {
    if (!mondayKey.trim()) return
    setMondayStatus('testing')
    setMondayError('')
    // Save key first so backend can use it for the test
    await saveConfig({ monday_api_key: mondayKey, repo_path: repoPath, gemini_api_key: geminiKey }).catch(() => {})
    try {
      const { name } = await testMondayConnection()
      setMondayStatus('ok')
      setMondayUser(name)
    } catch (err) {
      setMondayStatus('error')
      setMondayError(err.message)
    }
  }

  async function handleEnter() {
    setSaving(true)
    try {
      await saveConfig({ monday_api_key: mondayKey, repo_path: repoPath, gemini_api_key: geminiKey })
      // Persist to localStorage so config survives page reload
      localStorage.setItem('contexton-config', JSON.stringify({ monday_api_key: mondayKey, repo_path: repoPath, gemini_api_key: geminiKey }))
    } catch (_) {
      // Non-fatal — user can still use demo mode
    }
    onEnter()
  }

  const anyFilled = mondayKey.trim() || repoPath.trim() || geminiKey.trim()

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Context<span className="text-accent">On</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Understand <em>why</em> code was written this way
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-xl space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Connect your tools</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              All fields are optional — you can skip to use demo mode.
            </p>
          </div>

          {/* Monday */}
          <div className="space-y-2">
            <Field
              label="Monday.com API key"
              hint="Used to pull task context — why each feature was requested."
              value={mondayKey}
              onChange={(v) => { setMondayKey(v); setMondayStatus(null) }}
              type="password"
              placeholder="your Monday API key"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestMonday}
                disabled={!mondayKey.trim() || mondayStatus === 'testing'}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {mondayStatus === 'testing' ? 'Testing…' : 'Test connection'}
              </button>
              {mondayStatus === 'ok' && (
                <span className="text-xs text-green-400">Connected as {mondayUser}</span>
              )}
              {mondayStatus === 'error' && (
                <span className="text-xs text-red-400">{mondayError}</span>
              )}
            </div>
          </div>

          <div className="border-t border-surface-border" />

          {/* Repo */}
          <Field
            label="Repository path"
            badge="optional"
            hint="Local path to your project — enables browsing commits."
            value={repoPath}
            onChange={setRepoPath}
            placeholder="/Users/you/projects/my-app"
          />

          <div className="border-t border-surface-border" />

          {/* Gemini */}
          <Field
            label="Gemini API key"
            badge="optional"
            hint="Without this, demo mode is used for AI explanations."
            value={geminiKey}
            onChange={setGeminiKey}
            type="password"
            placeholder="AIza…"
          />

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onEnter}
              className="text-xs text-gray-600 transition-colors hover:text-gray-400"
            >
              Skip — use demo mode
            </button>
            <button
              onClick={handleEnter}
              disabled={saving}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : anyFilled ? 'Enter ContextOn' : 'Continue in demo mode'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700">
          Keys are stored locally in your browser and sent only to your own backend.
        </p>
      </div>
    </div>
  )
}
