function renderSourceContent(tabId, data) {
  if (!data) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-500">
        Loading sources…
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
          <pre className="overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed text-green-300/90">
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
            <span className="mx-2">·</span>
            Due {data.due_date}
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

export default function Sidebar({ tabs, activeTab, onTabChange, sources }) {
  return (
    <aside className="flex w-80 flex-shrink-0 flex-col border-r border-surface-border bg-surface-raised">
      <div className="border-b border-surface-border px-4 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Context Sources
        </h2>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-accent-muted text-blue-300'
                : 'text-gray-400 hover:bg-surface hover:text-gray-200'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto border-t border-surface-border p-4">
        {renderSourceContent(activeTab, sources?.[activeTab])}
      </div>
    </aside>
  )
}
