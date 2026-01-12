import { Suspense } from 'react'
import LadderPage from './LadderPage'



export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading ladder...</div>}>
      <LadderPage />
    </Suspense>
  )
}
