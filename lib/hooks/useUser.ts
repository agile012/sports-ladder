import { useAuth } from '@/context/AuthContext'
import { User } from '@supabase/supabase-js'

export default function useUser(initialUser: User | null = null) {
  // We ignore initialUser here because AuthProvider handles it globally now.
  // We keep the signature to avoid breaking existing usages.
  const { user, loading } = useAuth()
  return { user, loading }
}
