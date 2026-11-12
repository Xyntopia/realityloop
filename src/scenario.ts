import { z } from 'zod'

export const scenarioSchema = z.object({
  name: z.string().min(1),
  timestepSeconds: z.number().finite().positive().max(0.1),
  steps: z.number().int().positive().max(100_000),
  seed: z.number().int().nonnegative(),
  impulseNewtonSeconds: z.number().finite().nonnegative(),
  shelfXMetres: z.number().finite().min(1).max(8),
  minimumProgressMetres: z.number().finite().positive(),
}).strict()

export type Scenario = z.infer<typeof scenarioSchema>
export const parseScenario = (value: unknown): Scenario => scenarioSchema.parse(value)
