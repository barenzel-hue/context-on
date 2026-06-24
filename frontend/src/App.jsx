import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchContextStory, sendChatMessage } from './api'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'explanation', label: 'Explanation', icon: '✨' },
  { id: 'git_diff',    label: 'Code', icon: '⎇' },
  { id: 'monday_task', label: 'Related Task', icon: '📋' },
  { id: 'human_note',  label: 'Team Note',   icon: '💬' },
]

const SUGGESTIONS = [
  'Why does AuthService exist?',
  'Why was this feature added?',
  'Is this implementation temporary or permanent?',
  'What should I be careful about if I change this?',
]

// ── Source tab renderers ──────────────────────────────────────────────────────

function GitDiffPanel({ data }) {
  if (!data) return null
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* File header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-surface-border px-6 py-3">
        <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs text-blue-300">
          {data.file}
        </span>
        {data.commit && data.commit !== '—' && (
          <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs text-gray-500">
            {data.commit}
          </span>
        )}
        <span className="text-xs text-gray-500">{data.author}</span>
        {data.message && (
          <span className="ml-auto max-w-sm truncate text-xs italic text-gray-600">
            {data.message}
          </span>
        )}
      </div>

      {/* Clean code */}
      <div className="flex-1 overflow-y-auto">
        <pre className="min-h-full p-6 font-mono text-xs leading-relaxed text-gray-200">
          <code>{data.code || data.diff}</code>
        </pre>
      </div>
    </div>
  )
}

function MondayTaskPanel({ data }) {
  if (!data) return null
  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-3 text-sm">
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
}

function HumanNotePanel({ data }) {
  if (!data) return null
  const notes = Array.isArray(data) ? data : [data]
  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-3">
      {notes.map((note, i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-amber-300">{note.author}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500">{note.date}</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-300">{note.note}</p>
          {note.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Explanation tab: renders the conversation ─────────────────────────────────

function ExplanationPanel({ messages, sending }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-4">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-accent text-white'
                : 'border border-surface-border bg-surface text-gray-300'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="markdown-body">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}
      {sending && (
        <div className="flex justify-start">
          <div className="rounded-xl border border-surface-border bg-surface px-4 py-3">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

// ── Idle screen ───────────────────────────────────────────────────────────────

function IdleScreen({ onSubmit }) {
  const [input, setInput] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function submit(text) {
    const q = (text ?? input).trim()
    if (q) onSubmit(q)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-6 text-center">
        <div>
          <h2 className="text-xl font-semibold text-white">What would you like to understand?</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ask about any code — get the why, not just the what.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask why this code exists..."
            className="flex-1 rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-accent"
          />
          <button
            onClick={() => submit()}
            disabled={!input.trim()}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="rounded-full border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-accent hover:text-blue-300"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen({ question }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <div>
        <p className="text-sm font-medium text-gray-300">Analyzing context for</p>
        <p className="mt-0.5 text-sm italic text-gray-500">"{question}"</p>
      </div>
      <p className="text-xs text-gray-600">Reading commits, tasks, and team notes…</p>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [phase, setPhase]       = useState('idle')   // 'idle' | 'loading' | 'answered'
  const [firstQ, setFirstQ]     = useState('')
  const [messages, setMessages] = useState([])
  const [sources, setSources]   = useState(null)
  const [activeTab, setActiveTab] = useState('explanation')
  const [sending, setSending]   = useState(false)
  const [input, setInput]       = useState('')
  const inputRef                = useRef(null)

  useEffect(() => {
    if (phase === 'answered') inputRef.current?.focus()
  }, [phase])

  async function handleFirstQuestion(question) {
    setFirstQ(question)
    setPhase('loading')
    setMessages([{ role: 'user', content: question }])

    try {
      const { raw_sources } = await fetchContextStory()
      setSources(raw_sources)
      const { reply } = await sendChatMessage(question)
      setMessages([
        { role: 'user',      content: question },
        { role: 'assistant', content: reply },
      ])
      setPhase('answered')
    } catch (err) {
      setMessages([
        { role: 'user',      content: question },
        { role: 'assistant', content: `Something went wrong: ${err.message}` },
      ])
      setSources(null)
      setPhase('answered')
    }
  }

  async function handleFollowUp() {
    const question = input.trim()
    if (!question || sending) return
    setInput('')
    const history = messages
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setSending(true)
    try {
      const { reply } = await sendChatMessage(question, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setSending(false)
    }
  }

  function handleFollowUpKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFollowUp()
    }
  }

  function handleReset() {
    setPhase('idle')
    setMessages([])
    setSources(null)
    setInput('')
    setFirstQ('')
    setActiveTab('explanation')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">

      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-surface-border bg-surface-raised px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Context<span className="text-accent">On</span>
          </h1>
          <p className="text-xs text-gray-500">Understand why code exists</p>
        </div>
        {phase === 'answered' && (
          <button
            onClick={handleReset}
            className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-xs text-gray-400 transition-colors hover:border-accent hover:text-blue-300"
          >
            New question
          </button>
        )}
      </header>

      {/* Phase: idle */}
      {phase === 'idle' && (
        <IdleScreen onSubmit={handleFirstQuestion} />
      )}

      {/* Phase: loading */}
      {phase === 'loading' && (
        <LoadingScreen question={firstQ} />
      )}

      {/* Phase: answered */}
      {phase === 'answered' && (
        <>
          {/* Tabs */}
          <nav className="flex flex-shrink-0 border-b border-surface-border bg-surface-raised px-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
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

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'explanation' && (
              <ExplanationPanel messages={messages} sending={sending} />
            )}
            {activeTab === 'git_diff' && (
              <GitDiffPanel data={sources?.git_diff} />
            )}
            {activeTab === 'monday_task' && (
              <MondayTaskPanel data={sources?.monday_task} />
            )}
            {activeTab === 'human_note' && (
              <HumanNotePanel data={sources?.human_note} />
            )}
          </div>

          {/* Follow-up input */}
          <div className="flex-shrink-0 border-t border-surface-border bg-surface-raised px-6 py-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleFollowUpKey}
                disabled={sending}
                placeholder="Ask a follow-up question…"
                className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-accent disabled:opacity-50"
              />
              <button
                onClick={handleFollowUp}
                disabled={sending || !input.trim()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
