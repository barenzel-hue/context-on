const API_BASE = '/api'

export async function fetchContextStory() {
  const res = await fetch(`${API_BASE}/context-story`)
  if (!res.ok) throw new Error(`Failed to load context story (${res.status})`)
  return res.json()
}

export async function sendChatMessage(message) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`Chat request failed (${res.status})`)
  return res.json()
}

export async function fetchSources() {
  const res = await fetch(`${API_BASE}/sources`)
  if (!res.ok) throw new Error(`Failed to load sources (${res.status})`)
  return res.json()
}

export async function analyzeCustom({ git_diff, task = '', notes = '' }) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ git_diff, task, notes }),
  })
  if (!res.ok) throw new Error(`Analysis failed (${res.status})`)
  return res.json()
}
