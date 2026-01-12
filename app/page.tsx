
import { Suspense } from 'react'
import DashboardClient from './DashboardClient'

export default function Home() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading dashboard...</div>}>
      <DashboardClient />
    </Suspense>
  )
}
