export type DurableSaveResult<T, R> =
  | { status: 'saved'; entity: T; remote: R }
  | { status: 'pending'; entity: T; message: string }
  | { status: 'failed'; message: string }

type DurableSaveOptions<T, R> = {
  entity: T
  persistLocal: () => Promise<boolean>
  enqueue: () => Promise<boolean>
  upload: () => Promise<R>
  onRemoteSaved: (remote: R) => Promise<void>
  dequeue: () => Promise<void>
  pendingMessage: string
  localFailureMessage: string
  queueFailureMessage: string
}

/**
 * Saves locally before touching the network, then records a retry item before
 * upload. A network failure can therefore only result in an explicit pending
 * state, never a false "saved" result.
 */
export async function saveWithDurableRetry<T, R>(options: DurableSaveOptions<T, R>): Promise<DurableSaveResult<T, R>> {
  const {
    entity,
    persistLocal,
    enqueue,
    upload,
    onRemoteSaved,
    dequeue,
    pendingMessage,
    localFailureMessage,
    queueFailureMessage,
  } = options

  if (!(await persistLocal())) {
    return { status: 'failed', message: localFailureMessage }
  }

  if (!(await enqueue())) {
    return { status: 'failed', message: queueFailureMessage }
  }

  try {
    const remote = await upload()

    // A confirmed server write is success even if refreshing the local mirror
    // or clearing the now-idempotent retry record happens to fail.
    try {
      await onRemoteSaved(remote)
      await dequeue()
    } catch {
      // The next sync can safely upsert this same item again.
    }

    return { status: 'saved', entity, remote }
  } catch {
    return { status: 'pending', entity, message: pendingMessage }
  }
}
