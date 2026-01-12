import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from '@/lib/actions/dashboard'
import DashboardClient from './DashboardClient'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const dashboardData = await getDashboardData(user?.id)

  return (
    <DashboardClient
      initialData={dashboardData}
      initialUser={user}
    />
  )
}
