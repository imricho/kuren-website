import type { MotifSet } from './types'
import { wovenMotifs } from './woven'

/** Motif set used by the Ethnic theme. Regional sets can be registered alongside it later. */
export const motifSets: Record<string, MotifSet> = { [wovenMotifs.id]: wovenMotifs }
export const activeMotifSet: MotifSet = wovenMotifs
