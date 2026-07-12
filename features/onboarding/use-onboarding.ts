import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'summon.onboarding.completed.v1'

export function useOnboarding() {
  const [ready, setReady] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => setCompleted(value === '1'))
      .finally(() => setReady(true))
  }, [])

  const complete = useCallback(async () => {
    await AsyncStorage.setItem(KEY, '1')
    setCompleted(true)
  }, [])

  const reset = useCallback(async () => {
    await AsyncStorage.removeItem(KEY)
    setCompleted(false)
  }, [])

  return { ready, completed, complete, reset }
}
