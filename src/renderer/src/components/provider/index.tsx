'use client'

import React from 'react'

import i18n from '@/lib/i18n/renderer.js'
import { I18nextProvider } from 'react-i18next'
import { UIProvider } from '@/lib/uikit/provider.js'
import { TooltipProvider } from '@/renderer/components/ui/tooltip.js'
import { Toaster } from '@/renderer/components/ui/sonner.js'

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <UIProvider>{children}</UIProvider>
        <Toaster />
      </TooltipProvider>
    </I18nextProvider>
  )
}
