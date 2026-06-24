import { useState, useEffect } from 'react'
import ContextStory from './components/ContextStory'
import ChatPanel from './components/ChatPanel'
import AnalyzeForm from './components/AnalyzeForm'
import { fetchContextStory } from './api'

const TABS = [
  { id: 'story', label: 'Explanation', icon: '✨' },
  { id: 'chat', label: 'Ask About This Code', icon: '🤖' },
  { id: 'git_diff', label: 'Code Change', icon: '⎇' },
  { id: 'monday_task', label: 'Related Task', icon: '📋' },
  { id: 'human_note', label: 'Team Note', icon: '💬' },
]

const SOURCE_TABS = ['git_diff', 'monday_task', 'human_note']

function SourcePanel({ tabId, data }) {
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  switch (tabId) {
    case 'git_diff':
      return (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            <span className="text-gray-300">{data.file}</span>
            <span className="mx-2">·</span>
            <span>{data.commit}</span>
            <span className="mx-2">·</span>
            <span>{data.author}</span>
          </div>
          <p className="text-sm text-gray-300 italic">{data.message}</p>
          <pre className="overflow-x-auto rounded-lg bg-surface p-4 font-mono text-xs leading-relaxed text-green-300/90">
            {data.diff}
          </pre>
        </div>
      )

    case 'monday_task':
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
              {data.priority}
            </span>
            <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
              {data.status}
            </span>
          </div>
          <h3 className="font-semibold text-white">
            Task #{data.task_id}: {data.title}
          </h3>
          <p className="text-gray-400">
            Assigned to <span className="text-gray-200">{data.assignee}</span>
            <span className="mx-2">·</span>Due {data.due_date}
          </p>
          <p className="text-gray-300">{data.description}</p>
          {data.comments?.map((c, i) => (
            <div key={i} className="rounded-lg bg-surface p-3">
              <span className="text-xs font-medium text-blue-300">{c.author}</span>
              <p className="mt-1 text-gray-300">{c.text}</p>
            </div>
          ))}
        </div>
      )

    case 'prd_section':
      return (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-gray-400">
            {data.document} · {data.stakeholder}
          </p>
          <h3 className="font-semibold text-white">
            {data.section}: {data.title}
          </h3>
          <p className="text-gray-300">{data.content}</p>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Acceptance Criteria
            </p>
            <ul className="list-inside list-disc space-y-1 text-gray-300">
              {data.acceptance_criteria?.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )

    case 'human_note':
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-medium text-amber-300">{data.author}</span>
            <span>·</span>
            <span>{data.date}</span>
          </div>
          <blockquote className="border-l-2 border-amber-500/50 pl-4 text-gray-300 italic leading-relaxed">
            "{data.note}"
          </blockquote>
          <div className="flex flex-wrap gap-1.5">
            {data.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )

    default:
      return null
  }
}

function ContextStrip({ sources, loading }) {
  const git = sources?.git_diff
  const task = sources?.monday_task
  const note = sources?.human_note

  if (loading || !git) {
    return (
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-surface-border bg-surface px-6 py-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-gray-600" />
        <span className="text-xs text-gray-600">Loading context…</span>
      </div>
    )
  }

  const hasTask = task?.title && task.title !== 'Custom analysis' && task.title !== '—'
  const hasNote = note?.author && note.author !== '—'

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-surface-border bg-surface px-6 py-3 flex-wrap">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Analyzing
      </span>
      <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-gray-200 font-medium">
        {git.file}
      </span>
      {git.message && (
        <>
          <span className="text-gray-600 text-xs">—</span>
          <span className="text-xs text-gray-400 italic truncate max-w-sm">"{git.message}"</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {git.commit && git.commit !== '—' && (
          <span className="rounded bg-accent-muted px-2 py-0.5 font-mono text-xs text-blue-300">
            {git.commit}
          </span>
        )}
        {hasTask && (
          <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-gray-400">
            📋 {task.title}
          </span>
        )}
        {hasNote && (
          <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-gray-400">
            💬 Note from {note.author}
          </span>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('story')
  const [sources, setSources] = useState(null)
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    fetchContextStory()
      .then((data) => {
        setSources(data.raw_sources)
        setStory(data.story)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleAnalysisResult(data) {
    setSources(data.raw_sources)
    setStory(data.story)
    setShowForm(false)
    setResetKey((k) => k + 1)
    setActiveTab('story')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">

      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-surface-border bg-surface-raised px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Context<span className="text-accent">On</span>
          </h1>
          <p className="text-sm text-gray-400">
            Paste code, get the logic — <em>why</em> it was written this way
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-gray-300 transition-colors hover:border-accent hover:text-blue-300"
        >
          {showForm ? '✕ Cancel' : 'Analyze a code change'}
        </button>
      </header>

      {/* Context strip — always visible, shows what's being analyzed */}
      <ContextStrip sources={sources} loading={loading} />

      {/* Analyze form */}
      {showForm && <AnalyzeForm onResult={handleAnalysisResult} />}

      {/* Tab bar */}
      <nav className="flex flex-shrink-0 border-b border-surface-border bg-surface-raised px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-blue-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'story' && (
          <ContextStory story={story} loading={loading} error={error} />
        )}
        {activeTab === 'chat' && (
          <ChatPanel disabled={loading || !!error} resetKey={resetKey} />
        )}
        {SOURCE_TABS.includes(activeTab) && (
          <div className="h-full overflow-y-auto px-6 py-5">
            <SourcePanel tabId={activeTab} data={sources?.[activeTab]} />
          </div>
        )}
      </div>
    </div>
  )
}
