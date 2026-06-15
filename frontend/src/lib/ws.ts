// WebSocket client with auto-reconnect.
//
// In-car networks are flaky, so this transparently reconnects with a capped backoff and
// re-subscribes. Two message kinds arrive from the backend:
//   - { kind: 'snapshot', events: [...] }  on connect (recent history)
//   - { kind: 'advisory', event: {...} }   for each live advisory
//
// The dashboard is only a *view*: if this connection drops, in-vehicle alerts still fire.

import type { AdvisoryEvent } from './types'

type SnapshotMsg = { kind: 'snapshot'; events: AdvisoryEvent[] }
type AdvisoryMsg = { kind: 'advisory'; event: AdvisoryEvent }
type ServerMsg = SnapshotMsg | AdvisoryMsg

export interface LiveHandlers {
  onSnapshot?: (events: AdvisoryEvent[]) => void
  onAdvisory?: (event: AdvisoryEvent) => void
  onStatus?: (connected: boolean) => void
}

export function connectLive(handlers: LiveHandlers): () => void {
  let ws: WebSocket | null = null
  let closedByUs = false
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const url = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    // The backend mounts the realtime socket under the versioned API prefix.
    return `${proto}://${location.host}/api/v1/ws`
  }

  const open = () => {
    ws = new WebSocket(url())

    ws.onopen = () => {
      retry = 0
      handlers.onStatus?.(true)
    }

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMsg
      if (msg.kind === 'snapshot') handlers.onSnapshot?.(msg.events)
      else if (msg.kind === 'advisory') handlers.onAdvisory?.(msg.event)
    }

    ws.onclose = () => {
      handlers.onStatus?.(false)
      if (closedByUs) return
      const delay = Math.min(1000 * 2 ** retry, 15000) // capped exponential backoff
      retry += 1
      timer = setTimeout(open, delay)
    }

    ws.onerror = () => ws?.close()
  }

  open()

  return () => {
    closedByUs = true
    if (timer) clearTimeout(timer)
    ws?.close()
  }
}
