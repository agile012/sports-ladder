'use client'

import React, { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw } from 'lucide-react'

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
    return centerCrop(
        makeAspectCrop(
            { unit: '%', width: 90 },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    // Output at max 512x512 for avatars
    const outputSize = Math.min(crop.width * scaleX, 512)
    canvas.width = outputSize
    canvas.height = outputSize

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        outputSize,
        outputSize,
    )

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'))
                    return
                }
                resolve(blob)
            },
            'image/webp',
            0.85,
        )
    })
}

interface AvatarCropDialogProps {
    open: boolean
    onClose: () => void
    imageSrc: string
    onCropComplete: (croppedBlob: Blob) => void
    uploading: boolean
}

export function AvatarCropDialog({ open, onClose, imageSrc, onCropComplete, uploading }: AvatarCropDialogProps) {
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const imgRef = useRef<HTMLImageElement>(null)

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget
        setCrop(centerAspectCrop(width, height, 1))
    }, [])

    const handleSave = async () => {
        if (!completedCrop || !imgRef.current) return
        try {
            const croppedBlob = await getCroppedImg(imgRef.current, completedCrop)
            onCropComplete(croppedBlob)
        } catch (err) {
            console.error('Crop failed:', err)
        }
    }

    const handleReset = () => {
        if (!imgRef.current) return
        const { width, height } = imgRef.current
        setCrop(centerAspectCrop(width, height, 1))
    }

    return (
        <Dialog open={open} onOpenChange={(open) => !open && !uploading && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Crop Profile Photo</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4">
                    <div className="max-h-[60vh] overflow-auto rounded-lg">
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={1}
                            circularCrop
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                ref={imgRef}
                                alt="Crop preview"
                                src={imageSrc}
                                onLoad={onImageLoad}
                                className="max-w-full"
                                style={{ maxHeight: '50vh' }}
                            />
                        </ReactCrop>
                    </div>
                </div>
                <DialogFooter className="flex gap-2 sm:justify-between">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={uploading}
                    >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={uploading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={uploading || !completedCrop}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                'Save Photo'
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
