import { useSyncExternalStore } from 'react'

function subscribeToClock(onChange) {
  const intervalId = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(intervalId)
}

export function useNow() {
  return useSyncExternalStore(subscribeToClock, Date.now, Date.now)
}
