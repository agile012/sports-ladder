'use client'

import { useState, useEffect } from 'react'

interface LocalDateProps {
    date: string | Date
    showTime?: boolean
    className?: string
    dateClassName?: string
    timeClassName?: string
}

function useLocalDate(date: string | Date) {
    const [formatted, setFormatted] = useState<{ date: string; time: string } | null>(null)

    useEffect(() => {
        const d = new Date(date)
        setFormatted({
            date: d.toLocaleDateString(),
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
    }, [date])

    return formatted
}

export function LocalDate({ date, showTime = false, className, dateClassName, timeClassName }: LocalDateProps) {
    const formatted = useLocalDate(date)

    if (!formatted) return <span className={className} suppressHydrationWarning />

    return (
        <span className={className} suppressHydrationWarning>
            <span className={dateClassName}>{formatted.date}</span>
            {showTime && (
                <>
                    {' '}
                    <span className={timeClassName}>{formatted.time}</span>
                </>
            )}
        </span>
    )
}

export function LocalDateBlock({ date, showTime = false, dateClassName, timeClassName }: LocalDateProps) {
    const formatted = useLocalDate(date)

    if (!formatted) return null

    return (
        <>
            <div className={dateClassName}>{formatted.date}</div>
            {showTime && (
                <div className={timeClassName}>{formatted.time}</div>
            )}
        </>
    )
}
