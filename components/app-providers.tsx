import { PropsWithChildren } from 'react'

/** Root providers — keep thin until auth / data layers are reintroduced. */
export function AppProviders({ children }: PropsWithChildren) {
  return children
}
