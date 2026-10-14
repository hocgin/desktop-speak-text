import { Download, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdater } from '@/lib/updater/renderer.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Badge } from '@/renderer/components/ui/badge.js'
import { Progress } from '@/renderer/components/ui/progress.js'
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert.js'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/renderer/components/ui/dialog.js'

interface UpdateModalProps {
  open: boolean
  onClose: () => void
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export function UpdateModal({ open, onClose }: UpdateModalProps) {
  const { status, updateInfo, downloadProgress, error, checkUpdate, downloadUpdate, installUpdate } =
    useUpdater()
  const { t } = useTranslation()
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleCheckUpdate = useCallback(async () => {
    setIsChecking(true)
    try {
      await checkUpdate()
    } finally {
      setIsChecking(false)
    }
  }, [checkUpdate])

  const handleDownloadUpdate = useCallback(async () => {
    setIsDownloading(true)
    try {
      await downloadUpdate()
    } finally {
      setIsDownloading(false)
    }
  }, [downloadUpdate])

  const statusContent = (() => {
    const size = 40
    switch (status) {
      case 'checking':
        return { icon: <RefreshCw className="animate-spin" size={size} />, title: t('update.checking'), tone: 'text-primary' }
      case 'update-available':
        return { icon: <Download size={size} />, title: t('update.available'), tone: 'text-emerald-600' }
      case 'update-not-available':
        return { icon: <CheckCircle size={size} />, title: t('update.upToDate'), tone: 'text-emerald-600' }
      case 'downloading':
        return { icon: <Download className="animate-pulse" size={size} />, title: t('update.downloading'), tone: 'text-primary' }
      case 'downloaded':
        return { icon: <CheckCircle size={size} />, title: t('update.downloaded'), tone: 'text-emerald-600' }
      case 'installing':
        return { icon: <RefreshCw className="animate-spin" size={size} />, title: t('update.installing'), tone: 'text-primary' }
      case 'error':
        return { icon: <XCircle size={size} />, title: t('update.failed'), tone: 'text-destructive' }
      default:
        return { icon: <Clock size={size} />, title: t('update.idle'), tone: 'text-muted-foreground' }
    }
  })()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && status !== 'installing' && onClose()}>
      <DialogContent showClose={false} className="sm:max-w-[480px]">
        <DialogTitle className="sr-only">{statusContent.title}</DialogTitle>
        <DialogDescription className="sr-only">{t('update.description')}</DialogDescription>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className={statusContent.tone}>{statusContent.icon}</div>
          <h3 className={`text-lg font-semibold ${statusContent.tone}`}>{statusContent.title}</h3>

          {updateInfo && (
            <div className="flex flex-col items-center gap-2 text-sm">
              <span>
                {t('update.currentVersion')} <Badge variant="secondary">{updateInfo.currentVersion}</Badge>
              </span>
              <span>
                {t('update.latestVersion')} <Badge variant="success">{updateInfo.version}</Badge>
              </span>
            </div>
          )}

          {status === 'downloading' && downloadProgress && (
            <div className="w-full space-y-2 text-left">
              <Progress value={Math.round(downloadProgress.percent)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                </span>
                <span>{formatBytes(downloadProgress.bytesPerSecond)}/s</span>
              </div>
            </div>
          )}

          {updateInfo?.releaseNotes && (
            <div className="w-full rounded-lg bg-muted p-3 text-left text-sm">
              <div className="mb-1 font-medium">{t('update.changelog')}</div>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
                {updateInfo.releaseNotes}
              </p>
            </div>
          )}

          {status === 'error' && error && (
            <Alert variant="destructive" className="text-left">
              <AlertTitle>{t('update.errorTitle')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {status === 'idle' && (
              <Button onClick={handleCheckUpdate} loading={isChecking}>
                <RefreshCw size={16} /> {t('update.check')}
              </Button>
            )}
            {status === 'update-available' && (
              <>
                <Button variant="outline" onClick={onClose}>
                  {t('update.later')}
                </Button>
                <Button onClick={handleDownloadUpdate} loading={isDownloading}>
                  <Download size={16} /> {t('update.downloadNow')}
                </Button>
              </>
            )}
            {status === 'downloading' && (
              <Button disabled loading>
                {t('update.downloadingBtn')}
              </Button>
            )}
            {status === 'downloaded' && (
              <>
                <Button variant="outline" onClick={onClose}>
                  {t('update.installLater')}
                </Button>
                <Button onClick={() => installUpdate()}>
                  <CheckCircle size={16} /> {t('update.installNow')}
                </Button>
              </>
            )}
            {(status === 'update-not-available' || status === 'error') && (
              <>
                <Button variant="outline" onClick={onClose}>
                  {t('update.close')}
                </Button>
                <Button variant="outline" onClick={handleCheckUpdate} loading={isChecking}>
                  <RefreshCw size={16} /> {status === 'error' ? t('update.retry') : t('update.recheck')}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
