const CONTEXT_SOURCES = [
  { label: 'Codebase', icon: '⎇' },
  { label: 'Git commits & diffs', icon: '📝' },
  { label: 'Feature tasks', icon: '📋' },
  { label: 'Developer notes', icon: '💬' },
]

const EXAMPLES = [
  'Why does AuthService exist?',
  'Why was this feature added?',
  'Is this implementation temporary or permanent?',
  'What problem does this module solve?',
  'Why is this done this way instead of the obvious approach?',
]

export default function HelpPanel({ onAsk }) {
  return (
    <div className="border-b border-surface-border bg-surface px-6 py-5">
      <div className="max-w-2xl space-y-5">

        <div>
          <h2 className="mb-1 text-sm font-semibold text-white">How to use ContextOn</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Ask questions in plain English about any part of the codebase.
            ContextOn explains <span className="text-white font-medium">why</span> code exists —
            the product reason, the constraints, the tradeoffs — not just what it does.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Answers combine context from
          </p>
          <div className="flex flex-wrap gap-2">
            {CONTEXT_SOURCES.map((s) => (
              <span
                key={s.label}
                className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-raised px-3 py-1 text-xs text-gray-300"
              >
                <span>{s.icon}</span>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="rounded-full border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent hover:text-blue-300"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
