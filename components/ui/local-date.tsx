'use client'

interface LocalDateProps {
    date: string | Date
    showTime?: boolean
    className?: string
    dateClassName?: string
    timeClassName?: string
}

export function LocalDate({ date, showTime = false, className, dateClassName, timeClassName }: LocalDateProps) {
    const d = new Date(date)

    return (
        <span className={className}>
            <span className={dateClassName}>{d.toLocaleDateString()}</span>
            {showTime && (
                <>
                    {' '}
                    <span className={timeClassName}>
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </>
            )}
        </span>
    )
}

export function LocalDateBlock({ date, showTime = false, dateClassName, timeClassName }: LocalDateProps) {
    const d = new Date(date)

    return (
        <>
            <div className={dateClassName}>{d.toLocaleDateString()}</div>
            {showTime && (
                <div className={timeClassName}>
                    {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </>
    )
}
