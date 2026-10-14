import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2, Pause, Play, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TTSRecord } from '@/lib/tts/type.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Tooltip } from '@/renderer/components/ui/tooltip.js'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/renderer/components/ui/alert-dialog.js'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/renderer/components/ui/table.js'

interface HistoryListProps {
  records: TTSRecord[]
  onPlay?: (record: TTSRecord) => void
  onStop?: () => void
  onDelete?: (id: number) => void
  onDownload?: (record: TTSRecord) => void
  loading?: boolean
  currentPlayingId?: number | null
  downloadingId?: number | null
}

const PAGE_SIZE = 10

const formatTimestamp = (timestamp: number, locale: string): string =>
  new Date(timestamp * 1000).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-'
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

export const HistoryList: React.FC<HistoryListProps> = ({
  records,
  onPlay,
  onStop,
  onDelete,
  onDownload,
  loading = false,
  currentPlayingId = null,
  downloadingId = null
}) => {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<number | null>(null)
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = records.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <div className={loading ? 'opacity-60' : undefined}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('ai.historyEngine')}</TableHead>
            <TableHead>{t('history.time')}</TableHead>
            <TableHead className="w-full">{t('history.text')}</TableHead>
            <TableHead>{t('history.voice')}</TableHead>
            <TableHead>{t('history.params')}</TableHead>
            <TableHead className="text-center">{t('history.duration')}</TableHead>
            <TableHead className="text-center">{t('history.words')}</TableHead>
            <TableHead className="text-right">{t('history.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                {t('history.empty')}
              </TableCell>
            </TableRow>
          )}
          {rows.map((record) => {
            const isPlaying = currentPlayingId === record.id
            const isDownloading = downloadingId === record.id
            return (
              <TableRow key={record.id}>
                <TableCell className="text-xs">
                  <Tooltip title={record.generationParams || 'Edge TTS'}>
                    <span>{record.engine === 'local' ? record.modelId : 'Edge TTS'}</span>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatTimestamp(record.createdAt, i18n.language)}
                </TableCell>
                <TableCell className="max-w-0 truncate" title={record.text}>
                  {record.text}
                </TableCell>
                <TableCell className="max-w-32 truncate text-xs" title={record.voiceName}>
                  {record.voiceName.replace('Neural', '').trim()}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                  {record.rate.toFixed(1)}x · {Math.round(record.volume * 100)}%
                </TableCell>
                <TableCell className="text-center text-xs">{formatDuration(record.duration)}</TableCell>
                <TableCell className="text-center text-xs">{record.wordCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={isPlaying ? 'text-primary' : undefined}
                      disabled={!record.audioPath}
                      title={isPlaying ? t('history.stop') : t('history.play')}
                      onClick={() => (isPlaying ? onStop?.() : onPlay?.(record))}
                    >
                      {isPlaying ? <Pause /> : <Play />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={t('history.download')}
                      disabled={!record.audioPath || isDownloading}
                      onClick={() => onDownload?.(record)}
                    >
                      {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={t('history.delete')}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(record.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
        <span>{t('history.total', { count: records.length })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            {current + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('history.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('history.confirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('history.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                if (deleting !== null) onDelete?.(deleting)
                setDeleting(null)
              }}
            >
              {t('history.ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
