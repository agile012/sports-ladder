import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UserProfile from '@/components/profile/UserProfile'
import { getProfilePageData } from '@/lib/actions/profile'
import { PlayerProfileExtended } from '@/lib/types'



export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Please sign in</h2>
        <p className="mb-4">You must sign in with Google to view your profile.</p>
        <Link href="/login" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">
          Sign in
        </Link>
      </div>
    )
  }

  const { profiles, isAdmin } = await getProfilePageData(user.id)

  // Fetch global profile data (cohort, contact)
  const { data: profile } = await supabase.from('profiles').select('contact_number, cohort_id').eq('id', user.id).single()
  const { data: cohorts } = await supabase.from('cohorts').select('*').order('name')

  const userInfo = {
    id: user.id,
    email: user.email,
    avatar_url: user.user_metadata.avatar_url,
    contact_number: profile?.contact_number,
    cohort_id: profile?.cohort_id
  }

  return <UserProfile
    key={user.id}
    userInfo={userInfo}
    myPlayers={profiles as PlayerProfileExtended[]}
    isAdmin={isAdmin}
    cohorts={cohorts || []}
  />
}
