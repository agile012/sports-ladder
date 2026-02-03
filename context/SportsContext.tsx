'use client'

import { createContext, useContext, ReactNode } from 'react'
import { Sport } from '@/lib/types'

type SportsContextType = {
    sports: Sport[]
}

const SportsContext = createContext<SportsContextType | undefined>(undefined)

export function SportsProvider({
    children,
    initialSports
}: {
    children: ReactNode
    initialSports: Sport[]
}) {
    return (
        <SportsContext.Provider value={{ sports: initialSports }}>
            {children}
        </SportsContext.Provider>
    )
}

export function useSports() {
    const context = useContext(SportsContext)
    if (context === undefined) {
        throw new Error('useSports must be used within a SportsProvider')
    }
    return context
}
