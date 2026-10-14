import { Button } from '@/renderer/components/ui/button.js'
import { useUpdater } from '@/lib/updater/renderer.js'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './UpdateButton.module.css'
import { UpdateModal } from './UpdateModal.js'

export function UpdateButton() {
  const { hasUpdate } = useUpdater()
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)

  // 开发环境下始终显示按钮（用于调试）
  const isDev = import.meta.env.MODE === 'development'
  if (!isDev && !hasUpdate) return null

  return (
    <>
      <Button
        variant={isDev ? 'outline' : 'destructive'}
        size="sm"
        onClick={() => setModalOpen(true)}
        className={styles.updateButton}
      >
        <Bell size={14} />
        {isDev ? t('update.buttonDebug') : t('update.button')}
      </Button>
      <UpdateModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
