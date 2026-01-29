'use client'

import * as React from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Info, CheckCircle, Loader2 } from "lucide-react"

interface ConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive' | 'warning'
    onConfirm: () => void | Promise<void>
    loading?: boolean
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = 'default',
    onConfirm,
    loading = false
}: ConfirmDialogProps) {
    const [isLoading, setIsLoading] = React.useState(false)

    const handleConfirm = async () => {
        setIsLoading(true)
        try {
            await onConfirm()
        } finally {
            setIsLoading(false)
            onOpenChange(false)
        }
    }

    const Icon = variant === 'destructive' ? AlertTriangle :
        variant === 'warning' ? AlertTriangle :
            CheckCircle

    const iconColor = variant === 'destructive' ? 'text-destructive' :
        variant === 'warning' ? 'text-amber-500' :
            'text-primary'

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${variant === 'destructive' ? 'bg-destructive/10' : variant === 'warning' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                            <Icon className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div className="flex-1">
                            <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
                            <AlertDialogDescription className="mt-2">
                                {description}
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel disabled={isLoading || loading}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            handleConfirm()
                        }}
                        disabled={isLoading || loading}
                        className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                    >
                        {(isLoading || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

// Hook for easy usage
export function useConfirmDialog() {
    const [dialogState, setDialogState] = React.useState<{
        open: boolean
        title: string
        description: string
        confirmLabel?: string
        cancelLabel?: string
        variant?: 'default' | 'destructive' | 'warning'
        onConfirm: () => void | Promise<void>
    }>({
        open: false,
        title: '',
        description: '',
        onConfirm: () => { }
    })

    const confirm = React.useCallback((options: {
        title: string
        description: string
        confirmLabel?: string
        cancelLabel?: string
        variant?: 'default' | 'destructive' | 'warning'
        onConfirm: () => void | Promise<void>
    }) => {
        setDialogState({ ...options, open: true })
    }, [])

    const DialogComponent = React.useMemo(() => (
        <ConfirmDialog
            open={dialogState.open}
            onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}
            title={dialogState.title}
            description={dialogState.description}
            confirmLabel={dialogState.confirmLabel}
            cancelLabel={dialogState.cancelLabel}
            variant={dialogState.variant}
            onConfirm={dialogState.onConfirm}
        />
    ), [dialogState])

    return { confirm, ConfirmDialog: DialogComponent }
}
