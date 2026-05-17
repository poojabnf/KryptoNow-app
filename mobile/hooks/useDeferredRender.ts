import { useState, useEffect } from "react"
import { InteractionManager } from "react-native"

/**
 * Performance optimization hook that defers rendering heavy UI until all
 * navigation/layout transitions have completed, ensuring a solid 60fps/120fps.
 *
 * Includes a fallback timeout to guarantee rendering under busy interaction conditions.
 */
export function useDeferredRender(timeoutMs = 300) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (active) {
        setIsReady(true)
      }
    })

    const fallbackTimer = setTimeout(() => {
      if (active) {
        setIsReady(true)
      }
    }, timeoutMs)

    return () => {
      active = false
      interactionTask.cancel()
      clearTimeout(fallbackTimer)
    }
  }, [timeoutMs])

  return isReady
}
