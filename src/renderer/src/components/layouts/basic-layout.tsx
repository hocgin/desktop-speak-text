import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import Metrics from '@/renderer/components/metrics/index.js'
import React, { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useMenuData } from '@/renderer/components/router/menu.js'
import { Toolbar } from '@/renderer/components/toolbar/index.js'
import { Footer } from '@/renderer/components/footer/index.js'
import PopOver from '@/renderer/components/popover/index.js'
import { Tooltip } from '@/renderer/components/ui/tooltip.js'
import { cn } from '@/renderer/lib/utils.js'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import styles from './index.module.css'

export default function BasicLayout({ id = 'main', isMenubar = false }) {
  const [collapsed, setCollapsed] = useState(true)
  const menuData = useMenuData(id)
  const isMacOs = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <div className="flex h-full w-full max-h-screen max-w-[100vw] flex-col bg-background">
      <Metrics />
      {isMenubar && (
        <div className={clsx(styles.popover, { [styles.topPopover]: isMacOs })}>
          <PopOver position="top" height={12} />
        </div>
      )}
      <main className="flex h-full w-full flex-col overflow-hidden">
        <Toolbar />
        <div className="flex min-h-0 flex-1 gap-2 px-2 pt-2">
          <nav
            className={cn(
              'flex shrink-0 flex-col gap-1 rounded-xl border bg-card p-1.5 transition-[width] duration-200',
              collapsed ? 'w-[52px]' : 'w-40'
            )}
          >
            <div className="flex flex-1 flex-col gap-1">
              {menuData.map((item) => {
                const active = pathname === item.key
                const button = (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={cn(
                      'flex h-9 items-center gap-3 overflow-hidden rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{t(String(item.label))}</span>}
                  </button>
                )
                return collapsed ? (
                  <Tooltip key={item.key} title={t(String(item.label))}>
                    {button}
                  </Tooltip>
                ) : (
                  button
                )
              })}
            </div>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex h-9 items-center gap-3 rounded-md px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={collapsed ? t('nav.expandAria') : t('nav.collapseAria')}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              {!collapsed && <span className="text-sm">{t('nav.collapse')}</span>}
            </button>
          </nav>
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl">
            <Outlet />
          </div>
        </div>
        <Footer />
      </main>
      {isMenubar && (
        <div className={clsx(styles.popover, { [styles.bottomPopover]: !isMacOs })}>
          <PopOver position="bottom" height={12} />
        </div>
      )}
    </div>
  )
}
