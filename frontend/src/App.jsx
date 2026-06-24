import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ContextStory from './components/ContextStory'
import ChatPanel from './components/ChatPanel'
import { fetchContextStory } from './api'

const TABS = [
  { id: 'git_diff', label: 'Git Diff', icon: '⎇' },
  { id: 'monday_task', label: 'Monday', icon: '📋' },
  { id: 'prd_section', label: 'PRD', icon: '📄' },
  { id: 'human_note', label: 'Human Note', icon: '💬' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('git_diff')
  const [sources, setSources] = useState(null)
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchContextStory()
      .then((data) => {
        setSources(data.raw_sources)
        setStory(data.story)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sources={sources}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-surface-border bg-surface-raised px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Context<span className="text-accent">On</span>
            </h1>
            <p className="text-sm text-gray-400">
              Developer onboarding — understand the <em>why</em> behind the code
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent-muted px-3 py-1 text-xs text-blue-300">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            auth.js · a3f8c21
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
          <ContextStory story={story} loading={loading} error={error} />
          <ChatPanel disabled={loading || !!error} />
        </div>
      </main>
    </div>
  )
}
