'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { createAdminMatch } from '@/lib/actions/admin'
import { Plus } from 'lucide-react'

type Props = {
    sports: { id: string, name: string }[]
    players: { id: string, full_name: string, sport_id: string }[]
    currentSportId: string // 'all' or specific ID
}

export default function CreateMatchButton({ sports, players, currentSportId }: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Form state
    const [selectedSportId, setSelectedSportId] = useState<string>(currentSportId !== 'all' ? currentSportId : '')
    const [p1Id, setP1Id] = useState('')
    const [p2Id, setP2Id] = useState('')

    // Update sport if prop changes (e.g. navigation)
    if (currentSportId !== 'all' && selectedSportId !== currentSportId) {
        setSelectedSportId(currentSportId)
    }

    // Filter players based on selected sport
    const filteredPlayers = selectedSportId
        ? players.filter(p => p.sport_id === selectedSportId)
        : []

    async function handleCreate() {
        if (!selectedSportId || !p1Id || !p2Id) return
        if (p1Id === p2Id) {
            alert('Players must be different')
            return
        }

        startTransition(async () => {
            try {
                await createAdminMatch(selectedSportId, p1Id, p2Id)
                setOpen(false)
                setP1Id('')
                setP2Id('')
                alert('Match created successfully')
            } catch (e: any) {
                alert('Error: ' + e.message)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Create Match</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Manual Match</DialogTitle>
                    <DialogDescription>
                        Manually create a pending match between two players.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                    {/* Sport Select */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Sport</label>
                        <Select
                            value={selectedSportId}
                            onValueChange={(val) => {
                                setSelectedSportId(val);
                                setP1Id('');
                                setP2Id('');
                            }}
                            disabled={currentSportId !== 'all'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Sport" />
                            </SelectTrigger>
                            <SelectContent>
                                {sports.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Player 1 Select */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Player 1</label>
                        <SearchableSelect
                            items={filteredPlayers.map(p => ({ label: p.full_name, value: p.id }))}
                            value={p1Id}
                            onValueChange={setP1Id}
                            placeholder="Select Player 1"
                            disabled={!selectedSportId}
                        />
                    </div>

                    {/* Player 2 Select */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Player 2</label>
                        <SearchableSelect
                            items={filteredPlayers.map(p => ({ label: p.full_name, value: p.id }))}
                            value={p2Id}
                            onValueChange={setP2Id}
                            placeholder="Select Player 2"
                            disabled={!selectedSportId}
                        />
                    </div>

                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isPending || !selectedSportId || !p1Id || !p2Id}>
                        {isPending ? 'Creating...' : 'Create Match'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
