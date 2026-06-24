import { useState, useEffect } from 'react'
import { fetchCommits } from '../api'

export default function CommitList({ onSelect, selectedHash }) {
  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCommits(50)
      .then((data) => setCommits(data.commits))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = commits.filter(
    (c) =>
      c.message.toLowerCase().includes(search.toLowerCase()) ||
      c.author.toLowerCase().includes(search.toLowerCase()) ||
      c.hash.includes(search)
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-gray-500">Reading git history…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 max-w-sm text-center">
          <p className="font-medium mb-1">Could not read commits</p>
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-surface-border px-6 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commits…"
          className="w-full rounded-lg border border-surface-border bg-surface-raised px-4 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-accent"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-600">
            No commits match "{search}"
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.full_hash}
              onClick={() => onSelect(c)}
              className={`w-full border-b border-surface-border px-6 py-4 text-left transition-colors hover:bg-surface-raised ${
                selectedHash === c.hash ? 'bg-accent-muted border-l-2 border-l-accent' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-200">{c.message}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-gray-400">{c.author}</span>
                    <span>·</span>
                    <span>{c.date}</span>
                  </div>
                </div>
                <span className="flex-shrink-0 rounded bg-surface px-2 py-0.5 font-mono text-xs text-blue-300">
                  {c.hash}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
