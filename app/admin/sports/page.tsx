'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addSport, updateSport } from '@/lib/actions/admin'
import { supabase } from '@/lib/supabase/client'
import { Loader2, Plus, Pencil, Save, X } from 'lucide-react'
import { Sport } from '@/lib/types'

type ScoringConfig = {
    type: 'simple' | 'sets'
    total_sets?: number
    win_by?: number
    cap?: number
}

export default function AdminSportsPage() {
    const [sports, setSports] = useState<Sport[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form State
    const [name, setName] = useState('')
    const [scoringType, setScoringType] = useState<'simple' | 'sets'>('simple')
    const [totalSets, setTotalSets] = useState(3)
    const [winBy, setWinBy] = useState(2)
    const [cap, setCap] = useState(30)

    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState('')

    // const supabase = createClient() - removed, use imported 'supabase' directly

    useEffect(() => {
        fetchSports()
    }, [])

    async function fetchSports() {
        setLoading(true)
        const { data } = await supabase.from('sports').select('*').order('name')
        if (data) setSports(data)
        setLoading(false)
    }

    function resetForm() {
        setEditingId(null)
        setName('')
        setScoringType('simple')
        setTotalSets(3)
        setWinBy(2)
        setCap(30)
        setMessage('')
    }

    function handleEdit(sport: Sport) {
        setEditingId(sport.id)
        setName(sport.name)
        const config = sport.scoring_config || { type: 'simple' }
        setScoringType(config.type || 'simple')
        setTotalSets(config.total_sets || 3)
        setWinBy(config.win_by || 2)
        setCap(config.cap || 30)
        setMessage('')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return

        setSubmitting(true)
        setMessage('')

        const config: ScoringConfig = {
            type: scoringType,
        }
        if (scoringType === 'sets') {
            config.total_sets = Number(totalSets)
            config.win_by = Number(winBy)
            config.cap = Number(cap)
        }

        try {
            if (editingId) {
                await updateSport(editingId, { name, scoring_config: config })
                setMessage('Sport updated successfully!')
            } else {
                await addSport(name, config)
                setMessage('Sport added successfully!')
            }
            fetchSports()
            if (!editingId) resetForm() // Only reset if adding
        } catch (e: any) {
            setMessage('Error: ' + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Manage Sports</h1>
                {editingId && (
                    <Button variant="outline" onClick={resetForm} className="gap-2">
                        <Plus className="w-4 h-4" /> Add New
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Form Section */}
                <Card className="md:sticky md:top-24 h-fit">
                    <CardHeader>
                        <CardTitle>{editingId ? 'Edit Sport' : 'Add New Sport'}</CardTitle>
                        <CardDescription>Configure scoring rules and details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Sport Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Badminton"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Scoring Type</Label>
                                <Select value={scoringType} onValueChange={(v: 'simple' | 'sets') => setScoringType(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="simple">Simple (Win/Loss only)</SelectItem>
                                        <SelectItem value="sets">Sets & Points (e.g. 21-19, 21-15)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {scoringType === 'sets' && (
                                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border border-border/50">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Max Sets</Label>
                                        <Input type="number" value={totalSets} onChange={e => setTotalSets(Number(e.target.value))} min={1} max={9} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Win By</Label>
                                        <Input type="number" value={winBy} onChange={e => setWinBy(Number(e.target.value))} min={1} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Cap (Max)</Label>
                                        <Input type="number" value={cap} onChange={e => setCap(Number(e.target.value))} min={1} />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button type="submit" className="w-full" disabled={submitting || !name.trim()}>
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    {editingId ? 'Update Sport' : 'Create Sport'}
                                </Button>
                                {editingId && (
                                    <Button type="button" variant="ghost" onClick={resetForm} disabled={submitting}>
                                        Cancel
                                    </Button>
                                )}
                            </div>

                            {message && (
                                <div className={`p-3 rounded text-sm ${message.startsWith('Error') ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                    {message}
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>

                {/* List Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold px-1">Existing Sports</h2>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : (
                        sports.map(sport => (
                            <Card
                                key={sport.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${editingId === sport.id ? 'border-primary ring-1 ring-primary' : ''}`}
                                onClick={() => handleEdit(sport)}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold">{sport.name}</h3>
                                        <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                                            <span className="bg-secondary px-2 py-0.5 rounded">
                                                {sport.scoring_config?.type === 'sets' ? 'Sets & Points' : 'Simple'}
                                            </span>
                                            {sport.scoring_config?.type === 'sets' && (
                                                <span>
                                                    Best of {sport.scoring_config.total_sets} (cap: {sport.scoring_config.cap? sport.scoring_config.cap : 'N/A'})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-primary">
                                        <Pencil className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                    {sports.length === 0 && !loading && (
                        <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
                            No sports found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
