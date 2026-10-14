import BasicLayout from '@/renderer/components/layouts/basic-layout.js'
import MainPage from '@/renderer/pages/main/index.js'
import SpeakPage from '@/renderer/pages/speak/index.js'
import ConfigsPage from '@/renderer/pages/configs/index.js'
import LogsPage from '@/renderer/pages/logs/index.js'
import LoginPage from '@/renderer/pages/login/index.js'
import TestPage from '@/renderer/pages/test/index.js'
import AiModelPage from '@/renderer/pages/ai-model/index.js'
import SettingsPage from '@/renderer/pages/settings/index.js'
import GlobalError from '@/renderer/pages/global-error.js'
import { LocalRoute } from '@/renderer/components/router/type.js'
import { LayoutGrid, AudioLines, Sparkles, Settings } from 'lucide-react'

const routes = {
  main: [
    {
      path: '/',
      title: 'Home',
      component: () => <BasicLayout id={'main'} />,
      errorComponent: GlobalError,
      routes: [
        {
          title: 'nav.home',
          path: '/',
          icon: <LayoutGrid size={16} />,
          component: MainPage
        },
        {
          title: 'nav.speak',
          path: '/speak',
          icon: <AudioLines size={16} />,
          component: SpeakPage
        },
        {
          title: 'nav.aiModel',
          path: '/ai-model',
          icon: <Sparkles size={16} />,
          component: AiModelPage
        },
        {
          title: 'nav.settings',
          path: '/settings',
          icon: <Settings size={16} />,
          component: SettingsPage
        },
        // {
        //   title: '参数配置',
        //   path: '/configs',
        //   icon: <LayoutGrid size={16} />,
        //   component: ConfigsPage
        // },
        // {
        //   title: '日志',
        //   path: '/logs',
        //   icon: <LayoutGrid size={16} />,
        //   component: LogsPage
        // },
      ]
    },
    {
      title: 'nav.login',
      path: '/login',
      component: LoginPage
    }
  ] as LocalRoute[]
} as Record<string, LocalRoute[]>
export default routes
