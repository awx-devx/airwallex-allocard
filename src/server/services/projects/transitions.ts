/**
 * Server re-export of the pure lifecycle graph.
 * Authority lives in `src/shared/projectLifecycle.ts` — do not fork the edges here.
 */
export {
  canTransition,
  type TransitionGuard,
  type TransitionResult,
} from '@/shared/projectLifecycle'
