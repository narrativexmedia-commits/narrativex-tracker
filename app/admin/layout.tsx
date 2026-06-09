'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Employees', href: '/admin/employees', icon: 'ti-users' },
  { label: 'Attendance', href: '/admin/attendance', icon: 'ti-clock' },
  { label: 'Holidays', href: '/admin/holidays', icon: 'ti-calendar-event' },
  { label: 'Payroll', href: '/admin/payroll', icon: 'ti-currency-rupee' },
  { label: 'Reports', href: '/admin/reports', icon: 'ti-file-analytics' },
  { label: 'Screenshots', href: '/admin/screenshots', icon: 'ti-screenshot' },
  { label: 'Settings', href: '/admin/settings', icon: 'ti-settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const d = theme === 'dark'

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const NavLinks = () => (
    <>
      <div style={{ fontSize: 10, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8', letterSpacing: '0.8px', padding: '8px 10px 4px', textTransform: 'uppercase' as const }}>
        Main
      </div>
      {navItems.slice(0, 4).map(item => (
        <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 6, fontSize: 13,
            marginBottom: 2, cursor: 'pointer',
            background: pathname === item.href
              ? d ? 'rgba(139,92,246,0.25)' : '#eeecff'
              : 'transparent',
            color: pathname === item.href
              ? d ? '#c4b5fd' : '#4c3d9e'
              : d ? 'rgba(255,255,255,0.5)' : '#6b648a',
          }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 16 }} />
            {item.label}
          </div>
        </Link>
      ))}

      <div style={{ fontSize: 10, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8', letterSpacing: '0.8px', padding: '8px 10px 4px', textTransform: 'uppercase' as const, marginTop: 4 }}>
        Reports
      </div>
      {navItems.slice(4).map(item => (
        <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 6, fontSize: 13,
            marginBottom: 2, cursor: 'pointer',
            background: pathname === item.href
              ? d ? 'rgba(139,92,246,0.25)' : '#eeecff'
              : 'transparent',
            color: pathname === item.href
              ? d ? '#c4b5fd' : '#4c3d9e'
              : d ? 'rgba(255,255,255,0.5)' : '#6b648a',
          }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 16 }} />
            {item.label}
          </div>
        </Link>
      ))}

      <div style={{ marginTop: 'auto', padding: '10px 0 0', borderTop: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0' }}>
        <div
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 6, fontSize: 13,
            cursor: 'pointer',
            color: d ? 'rgba(255,255,255,0.5)' : '#6b648a',
          }}
        >
          <i className="ti ti-logout" aria-hidden="true" style={{ fontSize: 16 }} />
          Logout
        </div>
      </div>
    </>
  )

  const sidebarStyle: React.CSSProperties = {
    width: 210,
    display: 'flex',
    flexDirection: 'column',
    background: d ? '#12122a' : '#ffffff',
    borderRight: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
    transition: 'background 0.25s',
    padding: '0 8px',
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: d ? '#1a1a2e' : '#f8f7ff',
      transition: 'background 0.25s',
      fontFamily: 'sans-serif',
    }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar desktop */}
      <div className="nx-sidebar-desktop" style={{ ...sidebarStyle, height: '100vh', position: 'sticky', top: 0 }}>
        {/* Logo */}
        <div style={{
          padding: '18px 10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
          marginBottom: 4,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: d ? '#c8b8ff' : '#4c3d9e' }}>NarrativeX</div>
            <div style={{ fontSize: 11, color: d ? 'rgba(200,184,255,0.45)' : '#a09bc4', marginTop: 2 }}>Tracker</div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              width: 36, height: 20, borderRadius: 10,
              border: d ? 'none' : '0.5px solid #d8d4f5',
              background: d ? 'rgba(139,92,246,0.4)' : '#eeecff',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute', top: 3,
              left: d ? 19 : 3,
              width: 14, height: 14, borderRadius: '50%',
              background: d ? '#c4b5fd' : '#7c6fcf',
              transition: 'left 0.2s',
              display: 'block',
            }} />
          </button>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <NavLinks />
        </nav>
      </div>

      {/* Sidebar mobile */}
      <div
        className="nx-sidebar-mobile"
        style={{
          ...sidebarStyle,
          position: 'fixed', top: 0, left: 0,
          height: '100vh', zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s, background 0.25s',
        }}
      >
        <div style={{
          padding: '18px 10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
          marginBottom: 4,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: d ? '#c8b8ff' : '#4c3d9e' }}>NarrativeX</div>
            <div style={{ fontSize: 11, color: d ? 'rgba(200,184,255,0.45)' : '#a09bc4', marginTop: 2 }}>Tracker</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: d ? '#c4b5fd' : '#4c3d9e', fontSize: 20 }}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <NavLinks />
        </nav>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          padding: '13px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: d ? '#1a1a2e' : '#ffffff',
          borderBottom: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          {/* Hamburger mobile */}
          <button
            className="nx-hamburger"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Open menu"
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', padding: 4,
              color: d ? '#c4b5fd' : '#4c3d9e',
              fontSize: 22, display: 'none',
            }}
          >
            <i className="ti ti-menu-2" aria-hidden="true" />
          </button>

          <div style={{ fontSize: 15, fontWeight: 500, color: d ? '#e2d9ff' : '#2d2354' }}>
            {navItems.find(n => n.href === pathname)?.label ?? 'Dashboard'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: d ? 'rgba(139,92,246,0.35)' : '#eeecff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 500,
              color: d ? '#c4b5fd' : '#4c3d9e',
            }}>A</div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: 20 }}>
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .nx-sidebar-desktop { display: none !important; }
          .nx-hamburger { display: flex !important; }
        }
        @media (min-width: 768px) {
          .nx-sidebar-mobile { display: none !important; }
          .nx-hamburger { display: none !important; }
        }
      `}</style>
    </div>
  )
}