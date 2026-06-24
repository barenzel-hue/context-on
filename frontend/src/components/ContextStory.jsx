import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-0"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

export default function ContextStory({ story, loading, error }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center border-b border-surface-border px-6 py-3">
        <span className="text-sm text-gray-500">AI explanation of the logic behind this code</span>
        <CopyButton text={story} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-gray-400">
              Reading the commit, task, requirement, and team note…
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
    </div>
  )
}
