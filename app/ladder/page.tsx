
import { Suspense } from 'react'
import LadderPage from './LadderPage'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LadderPage />
    </Suspense>
  )
}
