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
import { ChevronDown, Trophy, Users } from "lucide-react"

type Sport = {
    id: string
    name: string
}

export function LaddersNav({ sports }: { sports: Sport[] }) {
    const pathname = usePathname()
    const isActive = pathname?.startsWith('/ladder')

    if (!sports || sports.length === 0) {
        return (
            <Link
                href="/ladder"
                className={cn(
                    "text-sm font-medium transition-colors hover:text-primary relative group py-2",
                    isActive ? "text-primary" : "text-muted-foreground"
                )}
            >
                Ladders
            </Link>
        )
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
                    Ladders
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                    <Link
                        href="/ladder"
                        className="flex items-center gap-2 cursor-pointer w-full font-medium"
                    >
                        <Users className="h-4 w-4 text-primary" />
                        View All Ladders
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
                    Jump to Sport
                </DropdownMenuLabel>
                {sports.map((sport) => (
                    <DropdownMenuItem key={sport.id} asChild>
                        <Link
                            href={`/ladder?sport=${sport.id}`}
                            className="flex items-center gap-2 cursor-pointer w-full"
                        >
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            {sport.name}
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
