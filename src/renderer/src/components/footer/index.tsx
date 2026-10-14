import { Github, Grid3x3, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/renderer/lib/utils.js'

const links = [
  {
    key: 'donate',
    href: 'https://logspot.hocgin.top/donate',
    icon: Heart,
    accent: true
  },
  { key: 'github', href: 'https://github.com/hocgin', icon: Github },
  { key: 'more', href: 'https://logspot.hocgin.top', icon: Grid3x3 }
] as const

/** 底部状态栏：左侧版权信息，右侧外链 */
export function Footer() {
  const { t } = useTranslation()
  const label = (key: string) => (key === 'github' ? 'GitHub' : t(`footer.${key}`))

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-3 px-3 text-[11px] text-muted-foreground">
      <span className="truncate select-none">© {new Date().getFullYear()} hocgin</span>
      <nav className="flex items-center gap-1">
        {links.map(({ key, href, icon: Icon, ...rest }) => {
          const accent = 'accent' in rest && rest.accent
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex h-6 items-center gap-1.5 rounded-md px-2 transition-colors',
                accent
                  ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                  : 'hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={12} className={accent ? 'fill-current' : undefined} />
              {label(key)}
            </a>
          )
        })}
      </nav>
    </footer>
  )
}
