import { useSyncExternalStore } from 'react'

function subscribeToClock(onChange) {
  const intervalId = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(intervalId)
}

/**
 * Returns the current timestamp and refreshes subscribers once per minute.
 * Use this when render logic needs time without calling Date.now() during render.
 */
export function useNow() {
  return useSyncExternalStore(subscribeToClock, Date.now, Date.now)
}
