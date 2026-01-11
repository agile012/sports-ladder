'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Minus, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ScoringConfig = {
    type?: 'simple' | 'sets' | 'points'
    total_sets?: number
    win_by?: number
    cap?: number
}

// Basic flexible score structure: [{p1: number, p2: number}, ...]
export type ScoreSet = { p1: string; p2: string }

export function ScoreInput({
    config,
    player1Name,
    player2Name,
    initialScores,
    onChange,
}: {
    config?: ScoringConfig
    player1Name: string
    player2Name: string
    initialScores?: ScoreSet[]
    onChange: (scores: ScoreSet[]) => void
}) {
    const [sets, setSets] = useState<ScoreSet[]>(initialScores || [{ p1: '', p2: '' }])

    const type = config?.type || 'simple'
    const maxSets = config?.total_sets || 5

    useEffect(() => {
        onChange(sets)
    }, [sets, onChange])

    const updateSet = (index: number, player: 'p1' | 'p2', value: string) => {
        // allow only numbers
        if (value && !/^\d*$/.test(value)) return

        const newSets = [...sets]
        newSets[index] = { ...newSets[index], [player]: value }
        setSets(newSets)
    }

    const addSet = () => {
        if (sets.length < maxSets) {
            setSets([...sets, { p1: '', p2: '' }])
        }
    }

    const removeSet = (index: number) => {
        if (sets.length > 1) {
            setSets(sets.filter((_, i) => i !== index))
        }
    }

    if (type === 'simple') return null // Simple uses the standard Winner dropdown, no extra score inputs needed (or optional)

    return (
        <div className="space-y-4 w-full">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-2">
                <span className="w-16 text-center">Set</span>
                <span className="flex-1 text-center truncate px-1">{player1Name}</span>
                <span className="w-8 text-center">vs</span>
                <span className="flex-1 text-center truncate px-1">{player2Name}</span>
                <span className="w-8"></span>
            </div>

            {sets.map((set, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="w-16 text-center text-sm font-mono text-muted-foreground">#{i + 1}</span>

                    <Input
                        type="text"
                        inputMode="numeric"
                        value={set.p1}
                        onChange={(e) => updateSet(i, 'p1', e.target.value)}
                        className="flex-1 h-9 text-center"
                        placeholder="0"
                    />

                    <span className="text-muted-foreground w-8 text-center">-</span>

                    <Input
                        type="text"
                        inputMode="numeric"
                        value={set.p2}
                        onChange={(e) => updateSet(i, 'p2', e.target.value)}
                        className="flex-1 h-9 text-center"
                        placeholder="0"
                    />

                    <div className="w-8 flex justify-center">
                        {i > 0 && (
                            <button type="button" onClick={() => removeSet(i)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                                <Minus className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {sets.length < maxSets && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSet}
                    className="w-full text-xs dashed border-dashed"
                >
                    <Plus className="w-3 h-3 mr-1" /> Add Set
                </Button>
            )}
        </div>
    )
}
