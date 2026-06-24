import ReactMarkdown from 'react-markdown'

export default function ContextStory({ story, loading, error }) {
  return (
    <section className="flex flex-[3] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised">
      <div className="flex items-center gap-2 border-b border-surface-border px-5 py-3">
        <span className="text-lg">✨</span>
        <h2 className="text-sm font-semibold text-white">AI Context Story</h2>
        <span className="ml-auto text-xs text-gray-500">
          Unified narrative from all sources
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-gray-400">
              Synthesizing context from Git, Monday, PRD &amp; team notes…
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <p className="font-medium">Failed to generate context story</p>
            <p className="mt-1 text-red-400">{error}</p>
            <p className="mt-2 text-xs text-gray-400">
              Make sure the backend is running on port 8000.
            </p>
          </div>
        )}

        {!loading && !error && story && (
          <div className="markdown-body prose-invert max-w-none">
            <ReactMarkdown>{story}</ReactMarkdown>
          </div>
        )}
      </div>
    </section>
  )
}
