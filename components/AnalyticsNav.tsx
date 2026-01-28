'use client'

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, BarChart2 } from "lucide-react"

type Sport = {
    id: string
    name: string
}

export function AnalyticsNav({ sports }: { sports: Sport[] }) {
    const pathname = usePathname()
    const isActive = pathname?.startsWith('/analytics')

    if (!sports || sports.length === 0) {
        return null
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary outline-none",
                        isActive ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    Analytics
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
                    Select Sport
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sports.map((sport) => (
                    <DropdownMenuItem key={sport.id} asChild>
                        <Link
                            href={`/analytics/${sport.id}`}
                            className="flex items-center gap-2 cursor-pointer w-full"
                        >
                            <BarChart2 className="h-4 w-4 text-muted-foreground" />
                            {sport.name}
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
