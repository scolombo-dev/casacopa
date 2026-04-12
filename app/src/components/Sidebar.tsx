'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, Package, BookOpen,
  ShoppingCart, Archive, DollarSign, Menu, X,
  ClipboardList, LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/eventos',     label: 'Eventos',      icon: CalendarDays },
  { href: '/checklists',  label: 'Checklists',   icon: ClipboardList },
  { href: '/proveedores', label: 'Proveedores',  icon: Package },
  { href: '/recetas',     label: 'Recetas',      icon: BookOpen },
  { href: '/compras',     label: 'Compras',      icon: ShoppingCart },
  { href: '/stock',       label: 'Stock',        icon: Archive },
  { href: '/finanzas',    label: 'Finanzas',     icon: DollarSign },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Botón hamburguesa — solo mobile */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow rounded p-2"
        onClick={() => setOpen(!open)}
        aria-label="Menú"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay oscuro — solo mobile cuando está abierto */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-200 z-40 flex flex-col transition-transform duration-200',
          'md:relative md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="font-bold text-lg tracking-tight">🍹 Casa Copa</p>
          <p className="text-xs text-gray-400 mt-0.5">Gestión de Barra</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer con logout */}
        <div className="border-t border-gray-100 px-3 py-3">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors disabled:opacity-50"
          >
            <LogOut size={16} />
            {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}
