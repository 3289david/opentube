'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Redirect to shorts feed starting at this video
export default function ShortRedirect() {
  const params = useParams()
  const router = useRouter()
  const shortId = params.shortId as string

  useEffect(() => {
    // Go to shorts page - the feed will start from beginning
    // In a full implementation we'd scroll to this specific short
    router.replace(`/shorts`)
  }, [shortId, router])

  return (
    <div className="flex items-center justify-center h-full bg-black">
      <div className="animate-spin w-10 h-10 border-4 border-[#ff0000] border-t-transparent rounded-full" />
    </div>
  )
}
