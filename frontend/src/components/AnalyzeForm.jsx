import { useState } from 'react'
import { analyzeCustom } from '../api'

export default function AnalyzeForm({ onResult }) {
  const [diff, setDiff] = useState('')
  const [task, setTask] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!diff.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeCustom({ git_diff: diff, task, notes })
      onResult(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-surface-border bg-surface px-6 py-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Code change <span className="text-gray-600">(paste a git diff, or just the code you want to understand)</span> <span className="text-red-400">*</span>
          </label>
          <textarea
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            placeholder="Paste a git diff, a snippet, or any code you want to understand..."
            rows={6}
            className="w-full resize-y rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 font-mono text-xs text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Why was this written?{' '}
              <span className="text-gray-600">(optional — paste the ticket, task, or just describe it)</span>
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. 'Users were getting logged out on Android' or paste the Jira ticket..."
              rows={3}
              className="w-full resize-none rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Any extra context?{' '}
              <span className="text-gray-600">(optional — team notes, Slack messages, caveats)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 'This was a quick fix before the demo, needs cleanup in Q3'..."
              rows={3}
              className="w-full resize-none rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!diff.trim() || loading}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Analyzing…' : 'Explain This Code'}
          </button>
        </div>
      </form>
    </div>
  )
}
