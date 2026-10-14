import { useCallback, useEffect, useRef, useState } from 'react'
import type { AIState } from './type.js'
export function useAIState() {
  const [state, setState] = useState<AIState>()
  const [error, setError] = useState<string>()
  const mounted = useRef(false)
  const revision = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++revision.current
    try {
      const state = await window.electron.ai.getState()
      if (mounted.current && request === revision.current) {
        setState(state)
        setError(undefined)
      }
    } catch (error) {
      if (mounted.current) setError(String(error))
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    const unsubscribe = window.electron.ai.onStateChanged(() => {
      void refresh()
    })
    const untask = window.electron.ai.onTask((task) => {
      setState(
        (previous) =>
          previous && {
            ...previous,
            tasks: [...previous.tasks.filter((t) => t.id !== task.id), task].slice(-100)
          }
      )
      if (task.status !== 'running') void refresh()
    })
    void refresh()
    return () => {
      mounted.current = false
      unsubscribe()
      untask()
    }
  }, [refresh])
  return { state, error, refresh }
}
