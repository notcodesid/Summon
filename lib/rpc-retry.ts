export type RpcRetryOptions = {
  attempts?: number
  wait?: (milliseconds: number) => Promise<void>
}

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

/** Retry an RPC operation with bounded, increasing backoff. */
export async function withRpcRetry<T>(
  label: string,
  work: () => Promise<T>,
  options: RpcRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 4))
  const wait = options.wait ?? sleep
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) await wait(1000 * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`RPC busy (${label})`)
}
