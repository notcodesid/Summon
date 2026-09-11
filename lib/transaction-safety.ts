export type TransactionSimulation = {
  value: { err: unknown; logs?: string[] | null }
}

export class TransactionSimulationError extends Error {
  readonly simulationError: unknown
  readonly logs: string[]

  constructor(simulationError: unknown, logs: string[] = []) {
    super(`Transaction simulation failed: ${JSON.stringify(simulationError)}`)
    this.name = 'TransactionSimulationError'
    this.simulationError = simulationError
    this.logs = logs
  }
}

/** Enforces simulation before any wallet/provider signing request. */
export async function simulateBeforeSend<T>(options: {
  simulate: () => Promise<TransactionSimulation>
  send: () => Promise<T>
}): Promise<T> {
  const simulation = await options.simulate()
  if (simulation.value.err) {
    throw new TransactionSimulationError(simulation.value.err, simulation.value.logs ?? [])
  }
  return options.send()
}
