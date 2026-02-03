import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/actions/dashboard'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    const dashboardData = await getDashboardData(user?.id)

    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading dashboard...</div>}>
        <DashboardClient initialData={dashboardData} initialUser={user} />
      </Suspense>
    )
  } catch (error) {
    console.error("Failed to fetch dashboard data server-side:", error)
    // Fallback to client-side fetching by passing nothing? 
    // Or just let error boundary handle it.
    // If we pass nothing, DashboardClient falls back to client fetching.
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading dashboard...</div>}>
        <DashboardClient initialUser={user} />
      </Suspense>
    )
  }
}
