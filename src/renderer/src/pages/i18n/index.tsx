import React from 'react'
import styles from './index.module.css'
import { Container } from '@/renderer/components/container/index.js'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import LanguageChanger from '@/lib/i18n/LanguageChanger/index.js'
import { Button } from '@/renderer/components/ui/button.js'

function App(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Container className={clsx(styles.body)}>
      <div className="text-destructive">{t('page.test')}</div>
      <h5>change local</h5>
      <LanguageChanger />
      <Button onClick={() => window.electron.ipcRenderer.send('CurrentLanguage-Request')}>
        get main locale info
      </Button>
    </Container>
  )
}

export default App
