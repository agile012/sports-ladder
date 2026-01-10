'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { addSport } from '@/lib/actions/admin'

export default function AdminSportsPage() {
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        setMessage('')
        try {
            await addSport(name)
            setMessage('Sport added successfully!')
            setName('')
        } catch (e: any) {
            setMessage('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold">Manage Sports</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Add New Sport</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Sport Name</label>
                            <Input
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Table Tennis"
                            />
                        </div>
                        <Button disabled={loading || !name.trim()}>
                            {loading ? 'Adding...' : 'Add Sport'}
                        </Button>
                        {message && <p className="text-sm text-muted-foreground">{message}</p>}
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
