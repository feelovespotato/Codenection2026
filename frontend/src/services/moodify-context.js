import { createContext, useContext } from 'react'
export const MoodifyContext = createContext(null)
export function useMoodify() { return useContext(MoodifyContext) }
