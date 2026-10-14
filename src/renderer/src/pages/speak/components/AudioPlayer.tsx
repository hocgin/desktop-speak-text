import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Pause, Play, SkipBack, SkipForward, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button.js'
import { cn } from '@/renderer/lib/utils.js'
import { Slider } from '@/renderer/components/ui/slider.js'

interface AudioPlayerProps {
  isGenerating?: boolean
  isPlaying?: boolean
  hasAudio?: boolean
  currentAudioPath?: string | null
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onGenerate?: () => void
  onDownload?: () => void
  disabled?: boolean
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isGenerating = false,
  hasAudio = false,
  currentAudioPath,
  onPlay,
  onPause,
  onStop,
  onGenerate,
  onDownload,
  disabled = false
}) => {
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [internalPlaying, setInternalPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  // 当前 audio 元素已加载的音频路径，用于避免续播上一次生成的旧音频
  const loadedPathRef = useRef<string | null>(null)
  // 加载请求序号，丢弃过期（被新请求取代）的异步结果
  const loadSeqRef = useRef(0)

  // 加载并播放音频
  const loadAndPlayAudio = useCallback(async () => {
    if (!currentAudioPath || !audioRef.current) return

    const seq = ++loadSeqRef.current
    try {
      const dataUrl = await window.electron.tts.loadAudio(currentAudioPath)
      if (seq !== loadSeqRef.current || !audioRef.current) return
      audioRef.current.src = dataUrl
      loadedPathRef.current = currentAudioPath
      audioRef.current.currentTime = 0
      await audioRef.current.play()
      setInternalPlaying(true)
      onPlay?.()
    } catch (error) {
      console.error('播放音频失败:', error)
      throw error
    }
  }, [currentAudioPath, onPlay])

  // 处理播放按钮点击
  const handlePlayClick = useCallback(() => {
    if (internalPlaying) {
      // 已经在播放，不做任何事
      return
    }

    // 如果音频元素已经加载了当前音频但暂停了，直接继续播放
    if (
      audioRef.current &&
      audioRef.current.src &&
      audioRef.current.paused &&
      loadedPathRef.current === currentAudioPath
    ) {
      audioRef.current.play()
      setInternalPlaying(true)
      onPlay?.()
      return
    }

    // 否则加载并播放主音频
    loadAndPlayAudio()
  }, [internalPlaying, loadAndPlayAudio, onPlay, currentAudioPath])

  // 处理暂停按钮点击
  const handlePauseClick = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setInternalPlaying(false)
      onPause?.()
    }
  }, [onPause])

  // 处理停止按钮点击
  const handleStopClick = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setInternalPlaying(false)
      onStop?.()
    }
  }, [onStop])

  // 创建 audio 元素
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
    }

    const handleEnded = () => {
      setCurrentTime(0)
      setInternalPlaying(false)
      onStop?.()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [onStop])

  // 当 currentAudioPath 改变时（含重新生成），重置旧音频并自动加载播放新音频
  useEffect(() => {
    const audio = audioRef.current
    if (!currentAudioPath || !audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    loadedPathRef.current = null
    setCurrentTime(0)
    setDuration(0)
    setInternalPlaying(false)
    loadAndPlayAudio().catch(() => {
      // 自动播放被拒绝时保留已就绪状态，由用户点击播放
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAudioPath])

  const handleSeek = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value
      setCurrentTime(value)
    }
  }

  const handleVolumeChange = (value: number) => {
    setVolume(value)
    if (audioRef.current) {
      audioRef.current.volume = value
    }
  }

  const handleForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, duration)
    }
  }

  const handleBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0)
    }
  }

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const statusText = isGenerating
    ? t('player.generating')
    : internalPlaying
      ? t('player.playing')
      : hasAudio
        ? t('player.ready')
        : t('player.waiting')

  // 均衡器：播放中跳动，生成中呼吸，其余静止
  const eqDelays = ['0ms', '180ms', '90ms', '270ms', '45ms']
  const playing = internalPlaying && !isGenerating

  return (
    <div className="flex flex-col gap-3">
      {/* 头部：左 状态指示，右 生成按钮 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-5 items-end gap-[3px]" aria-hidden>
            {eqDelays.map((delay, i) => (
              <span
                key={i}
                className={cn(
                  'h-full w-[3px] origin-bottom rounded-full bg-primary transition-opacity duration-300',
                  playing ? 'opacity-100' : 'opacity-40',
                  isGenerating && 'bg-primary/70'
                )}
                style={{
                  transform: playing || isGenerating ? undefined : 'scaleY(0.25)',
                  animation: playing
                    ? `eq-bounce ${700 + i * 90}ms ease-in-out ${delay} infinite`
                    : isGenerating
                      ? `soft-pulse 1.2s ease-in-out ${delay} infinite`
                      : undefined
                }}
              />
            ))}
          </div>
          <span
            key={statusText}
            className="animate-in fade-in slide-in-from-bottom-1 truncate text-sm text-muted-foreground duration-300"
          >
            {statusText}
          </span>
        </div>

        <Button
          variant={hasAudio ? 'outline' : 'default'}
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          loading={isGenerating}
          className="shrink-0 active:scale-95"
        >
          {!isGenerating && <Sparkles />}
          {isGenerating
            ? t('player.generatingBtn')
            : hasAudio
              ? t('player.regenerate')
              : t('player.generate')}
        </Button>
      </div>

      {/* 播放条：有音频时平滑展开 */}
      <div
        className={cn(
          'grid transition-all duration-500 ease-out',
          hasAudio ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
        aria-hidden={!hasAudio}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-background/60 p-3">
            {/* 传输控制 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackward}
                disabled={disabled || !hasAudio}
                title={t('player.back10')}
                className="active:scale-90"
              >
                <SkipBack />
              </Button>
              <Button
                size="icon"
                onClick={internalPlaying ? handlePauseClick : handlePlayClick}
                disabled={disabled || !hasAudio}
                title={internalPlaying ? t('player.pause') : t('player.play')}
                className={cn(
                  'size-11 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95',
                  playing && 'ring-4 ring-primary/20'
                )}
              >
                {internalPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleForward}
                disabled={disabled || !hasAudio}
                title={t('player.forward10')}
                className="active:scale-90"
              >
                <SkipForward />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStopClick}
                disabled={disabled || !internalPlaying}
                title={t('player.stop')}
                className="active:scale-90"
              >
                <Square />
              </Button>
            </div>

            {/* 进度：时间 + 滑块同一行 */}
            <div className="flex min-w-[10rem] flex-1 items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
              <span className="w-9 text-right">{formatTime(currentTime)}</span>
              <Slider
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onValueChange={([v]) => handleSeek(v)}
              />
              <span className="w-9">{formatTime(duration)}</span>
            </div>

            {/* 音量与下载 */}
            <div className="flex items-center gap-1">
              <div className="flex w-24 items-center gap-2 text-muted-foreground">
                {volume === 0 ? (
                  <VolumeX className="size-4 shrink-0" />
                ) : (
                  <Volume2 className="size-4 shrink-0" />
                )}
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onValueChange={([v]) => handleVolumeChange(v)}
                  aria-label={t('player.volume')}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDownload}
                disabled={disabled || !hasAudio}
                title={t('player.download')}
                className="active:scale-90"
              >
                <Download />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
