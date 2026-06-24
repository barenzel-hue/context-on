const API_BASE = '/api'

export async function fetchContextStory() {
  const res = await fetch(`${API_BASE}/context-story`)
  if (!res.ok) throw new Error(`Failed to load context story (${res.status})`)
  return res.json()
}

export async function sendChatMessage(message, history = []) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })
  if (!res.ok) throw new Error(`Chat request failed (${res.status})`)
  return res.json()
}

export async function fetchSources() {
  const res = await fetch(`${API_BASE}/sources`)
  if (!res.ok) throw new Error(`Failed to load sources (${res.status})`)
  return res.json()
}

export async function fetchRepoStatus() {
  const res = await fetch(`${API_BASE}/repo/status`)
  if (!res.ok) throw new Error(`Failed to check repo status (${res.status})`)
  return res.json()
}

export async function fetchCommits(limit = 30) {
  const res = await fetch(`${API_BASE}/repo/commits?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to load commits (${res.status})`)
  return res.json()
}

export async function explainCommit(hash) {
  const res = await fetch(`${API_BASE}/repo/commits/${hash}`)
  if (!res.ok) throw new Error(`Failed to explain commit (${res.status})`)
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

export async function saveConfig({ monday_api_key = '', repo_path = '', gemini_api_key = '' }) {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monday_api_key, repo_path, gemini_api_key }),
  })
  if (!res.ok) throw new Error(`Config save failed (${res.status})`)
  return res.json()
}

export async function getConfigStatus() {
  const res = await fetch(`${API_BASE}/config/status`)
  if (!res.ok) throw new Error(`Config status failed (${res.status})`)
  return res.json()
}

export async function testMondayConnection() {
  const res = await fetch(`${API_BASE}/monday/test`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Monday test failed (${res.status})`)
  }
  return res.json()
}

export async function fetchMondayBoards() {
  const res = await fetch(`${API_BASE}/monday/boards`)
  if (!res.ok) throw new Error(`Failed to fetch boards (${res.status})`)
  return res.json()
}
