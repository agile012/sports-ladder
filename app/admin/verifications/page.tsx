'use client'

import { useEffect, useState } from 'react'
import { getPendingVerifications, verifyUser, VerificationRequest } from '@/lib/actions/verification'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, X, ShieldAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export default function VerificationsPage() {
    const [requests, setRequests] = useState<VerificationRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchRequests = async () => {
        try {
            const data = await getPendingVerifications()
            setRequests(data)
        } catch (error) {
            toast.error('Failed to load pending verifications')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRequests()
    }, [])

    const handleAction = async (userId: string, action: 'verified' | 'rejected') => {
        setProcessingId(userId)
        try {
            await verifyUser(userId, action)
            toast.success(`User ${action} successfully`)
            // Optimistic update
            setRequests(prev => prev.filter(r => r.id !== userId))
        } catch (error) {
            toast.error('Failed into process request')
        } finally {
            setProcessingId(null)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Verification</h1>
                    <p className="text-muted-foreground">Review and approve access for external users.</p>
                </div>
            </div>

            {requests.length === 0 ? (
                <Card className="border-dashed bg-muted/30">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-medium">No Pending Requests</h3>
                        <p>All clear! There are no users waiting for verification.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                            Pending Approvals ({requests.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Requested</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">{req.email}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-green-500/20 hover:bg-green-500/10 hover:text-green-600 text-green-600"
                                                    disabled={processingId === req.id}
                                                    onClick={() => handleAction(req.id, 'verified')}
                                                >
                                                    {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-red-500/20 hover:bg-red-500/10 hover:text-red-600 text-red-600"
                                                    disabled={processingId === req.id}
                                                    onClick={() => handleAction(req.id, 'rejected')}
                                                >
                                                    {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                                                    Reject
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
