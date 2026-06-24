import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { sendChatMessage } from '../api'

const SUGGESTIONS = [
  'Why didn\'t Yossi use a try-catch block here?',
  'What security risks does skipStateCheck introduce?',
  'When is this tech debt scheduled to be fixed?',
]

export default function ChatPanel({ disabled }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text) {
    const question = (text ?? input).trim()
    if (!question || sending || disabled) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setSending(true)

    try {
      const { reply } = await sendChatMessage(question)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section className="flex flex-[2] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised">
      <div className="flex items-center gap-2 border-b border-surface-border px-5 py-3">
        <span className="text-lg">🤖</span>
        <h2 className="text-sm font-semibold text-white">Ask Follow-ups</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !disabled && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Ask anything about this change — the coach has full context.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent hover:text-blue-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
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
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-surface-border p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            placeholder={
              disabled
                ? 'Waiting for context story…'
                : 'Ask a follow-up question…'
            }
            rows={2}
            className="flex-1 resize-none rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-accent disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={disabled || sending || !input.trim()}
            className="self-end rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  )
}
