import ReactDom from 'react-dom/client'
import React from 'react'

import { Routes } from '@/renderer/components/router/routes.js'
import { Provider } from '@/renderer/components/provider/index.js'
import './styles/tailwind.css'
import './global.css'

ReactDom.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider>
      <Routes />
    </Provider>
  </React.StrictMode>
)
