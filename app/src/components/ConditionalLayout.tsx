'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import ChatAsistente from './ChatAsistente'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      <ChatAsistente />
    </div>
  )
}
