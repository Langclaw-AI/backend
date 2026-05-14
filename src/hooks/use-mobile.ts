import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const getSnapshot = () => window.matchMedia(MOBILE_MEDIA_QUERY).matches
const getServerSnapshot = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
      mql.addEventListener("change", onStoreChange)

      return () => mql.removeEventListener("change", onStoreChange)
    },
    getSnapshot,
    getServerSnapshot
  )
}
