'use client'

import { useState, useTransition } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { Ban, Loader2, Pencil, Users } from 'lucide-react'
import AdminUserActions from '@/components/admin/AdminUserActions'
import { bulkDeactivatePlayers, adminUpdateUserProfile, bulkAssignCohort } from '@/lib/actions/admin'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Profile = {
    id: string
    full_name: string
    user_email: string
    sport_id: string
    is_admin: boolean
    user_id: string // Needed for global updates
    contact_number?: string
    cohort_id?: string
}

type Props = {
    profiles: Profile[]
    sportsMap: Record<string, string>
    cohorts: { id: string, name: string }[]
}

export default function UserManagementTable({ profiles, sportsMap, cohorts }: Props) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isPending, startTransition] = useTransition()
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [editForm, setEditForm] = useState({ contact_number: '', cohort_id: '' })

    // Bulk Assign Cohort State
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
    const [bulkAssignCohortId, setBulkAssignCohortId] = useState<string>('')

    const toggleSelectAll = () => {
        if (selectedIds.size === profiles.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(profiles.map(p => p.id)))
        }
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const handleBulkDeactivate = () => {
        if (!window.confirm(`Are you sure you want to deactivate ${selectedIds.size} users?`)) return

        const targets = profiles
            .filter(p => selectedIds.has(p.id))
            .map(p => ({ sportId: p.sport_id, profileId: p.id }))

        startTransition(async () => {
            try {
                await bulkDeactivatePlayers(targets)
                toast.success('Users deactivated')
                setSelectedIds(new Set())
            } catch (e: any) {
                toast.error(e.message)
            }
        })
    }

    const handleBulkAssignCohort = () => {
        if (selectedIds.size === 0) return
        startTransition(async () => {
            try {
                // We need the *user_id* for global updates, not profile id.
                // Assuming all selected profiles map to unique users or we update based on unique user_ids found.
                // We'll iterate over selected profiles to find unique user_ids
                const userIds = new Set<string>()
                profiles.forEach(p => {
                    if (selectedIds.has(p.id)) userIds.add(p.user_id)
                })

                await bulkAssignCohort(Array.from(userIds), bulkAssignCohortId === 'null' ? null : bulkAssignCohortId)
                toast.success('Cohorts updated')
                setBulkAssignOpen(false)
                setSelectedIds(new Set())
                setBulkAssignCohortId('')
            } catch (e: any) {
                toast.error(e.message)
            }
        })
    }

    const openEdit = (profile: Profile) => {
        setEditingUser(profile)
        setEditForm({
            contact_number: profile.contact_number || '',
            cohort_id: profile.cohort_id || 'null' // use 'null' string for select value if empty
        })
    }

    const handleUpdateUser = async () => {
        if (!editingUser) return
        startTransition(async () => {
            try {
                const cohortId = editForm.cohort_id === 'null' ? null : editForm.cohort_id

                await adminUpdateUserProfile(editingUser.user_id, {
                    contact_number: editForm.contact_number,
                    cohort_id: cohortId as string
                })
                toast.success('User updated')
                setEditingUser(null)
            } catch (e: any) {
                toast.error(e.message)
            }
        })
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border flex-wrap">
                    <span className="text-sm font-medium">{selectedIds.size} selected</span>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDeactivate}
                        disabled={isPending}
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                        Deactivate Selected
                    </Button>

                    <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isPending}>
                                <Users className="w-4 h-4 mr-2" />
                                Assign Cohort
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Bulk Assign Cohort</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <Label>Select Cohort</Label>
                                <Select
                                    value={bulkAssignCohortId}
                                    onValueChange={setBulkAssignCohortId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Cohort" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="null">No Cohort</SelectItem>
                                        {cohorts.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
                                <Button onClick={handleBulkAssignCohort} disabled={isPending || !bulkAssignCohortId}>
                                    {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Apply
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={profiles.length > 0 && selectedIds.size === profiles.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>User Name</TableHead>
                            <TableHead>Cohort</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Sport</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {profiles.map((p) => {
                            const cohortName = cohorts.find(c => c.id === p.cohort_id)?.name || '-'
                            return (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(p.id)}
                                            onCheckedChange={() => toggleSelect(p.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link href={`/player/${p.id}`} className="hover:underline text-blue-600">
                                            {p.full_name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{cohortName}</TableCell>
                                    <TableCell>{p.contact_number || '-'}</TableCell>
                                    <TableCell>{p.user_email}</TableCell>
                                    <TableCell>{sportsMap[p.sport_id] || p.sport_id}</TableCell>
                                    <TableCell>
                                        {p.is_admin ? (
                                            <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Admin</span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Player</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                                            <Pencil className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                        <AdminUserActions profileId={p.id} isAdmin={p.is_admin || false} sportId={p.sport_id} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {profiles.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Cohort</Label>
                            <Select
                                value={editForm.cohort_id}
                                onValueChange={(val) => setEditForm(prev => ({ ...prev, cohort_id: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Cohort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">No Cohort</SelectItem>
                                    {cohorts.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input
                                value={editForm.contact_number}
                                onChange={e => setEditForm(prev => ({ ...prev, contact_number: e.target.value }))}
                                placeholder="+1234567890"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                        <Button onClick={handleUpdateUser} disabled={isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
