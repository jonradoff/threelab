import { createContext, useContext } from 'react'

export interface InteractionState {
  mouse: { x: number; y: number }
  mouseVelocity: { x: number; y: number }
  scrollY: number
}

export const InteractionContext = createContext<InteractionState>({
  mouse: { x: 0, y: 0 },
  mouseVelocity: { x: 0, y: 0 },
  scrollY: 0,
})

export function useInteraction(): InteractionState {
  return useContext(InteractionContext)
}
