import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Pause, Play, SkipBack, SkipForward, Sparkles, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button.js'
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
  triggerPlay?: string  // 要播放的音频路径
  triggerPlayTimestamp?: number  // 播放触发的时间戳，用于确保每次点击都能触发
  triggerStop?: number  // 触发停止的计数器
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isGenerating = false,
  hasAudio = false,
  currentAudioPath,
  triggerPlay,
  triggerPlayTimestamp,
  triggerStop,
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

  // 加载并播放音频
  const loadAndPlayAudio = useCallback(async () => {
    if (!currentAudioPath || !audioRef.current) return

    try {
      const dataUrl = await window.electron.tts.loadAudio(currentAudioPath)
      audioRef.current.src = dataUrl
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

    // 如果音频元素已经加载了音频但暂停了，直接继续播放
    if (audioRef.current && audioRef.current.src && audioRef.current.paused) {
      audioRef.current.play()
      setInternalPlaying(true)
      onPlay?.()
      return
    }

    // 否则加载并播放主音频
    loadAndPlayAudio()
  }, [internalPlaying, loadAndPlayAudio, onPlay])

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

  // 当 currentAudioPath 改变时，自动加载并播放
  useEffect(() => {
    if (currentAudioPath && audioRef.current && onPlay) {
      loadAndPlayAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAudioPath])

  // 当 triggerPlay 改变时，播放指定的音频（用于历史记录播放）
  useEffect(() => {
    if (triggerPlay && audioRef.current) {
      const playAudio = async () => {
        const audio = audioRef.current
        if (!audio) return

        try {
          // 如果已经在播放这个音频，先暂停
          if (internalPlaying && audio.src) {
            audio.pause()
          }

          const dataUrl = await window.electron.tts.loadAudio(triggerPlay)
          audio.src = dataUrl
          audio.currentTime = 0
          await audio.play()
          setInternalPlaying(true)
          onPlay?.()
        } catch (error) {
          console.error('播放历史记录失败:', error)
        }
      }
      playAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerPlay, triggerPlayTimestamp])

  // 当 triggerStop 改变时，停止播放（用于历史记录停止）
  useEffect(() => {
    if (triggerStop && triggerStop > 0 && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setInternalPlaying(false)
      onStop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerStop, onStop])

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

  return (
    <div className="flex flex-col gap-4">
      {hasAudio && (
        <>
          <div className="space-y-1.5">
            <Slider
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onValueChange={([v]) => handleSeek(v)}
            />
            <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBackward}
                disabled={disabled || !audioRef.current}
                title={t('player.back10')}
              >
                <SkipBack />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleForward}
                disabled={disabled || !audioRef.current}
                title={t('player.forward10')}
              >
                <SkipForward />
              </Button>
            </div>
            <div className="flex w-44 items-center gap-2 text-xs text-muted-foreground">
              {t('player.volume')}
              <Slider min={0} max={1} step={0.1} value={volume} onValueChange={([v]) => handleVolumeChange(v)} />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onGenerate} disabled={disabled || isGenerating} loading={isGenerating}>
          {!isGenerating && <Sparkles />}
          {isGenerating
            ? t('player.generatingBtn')
            : hasAudio
              ? t('player.regenerate')
              : t('player.generate')}
        </Button>

        {hasAudio && (
          <>
            {internalPlaying ? (
              <Button variant="outline" onClick={handlePauseClick} disabled={disabled}>
                <Pause /> {t('player.pause')}
              </Button>
            ) : (
              <Button variant="outline" onClick={handlePlayClick} disabled={disabled || !hasAudio}>
                <Play /> {t('player.play')}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleStopClick}
              disabled={disabled || !internalPlaying}
            >
              <Square /> {t('player.stop')}
            </Button>
            <Button variant="outline" onClick={onDownload} disabled={disabled}>
              <Download /> {t('player.download')}
            </Button>
          </>
        )}
      </div>

      <div className="text-center text-xs text-muted-foreground">{statusText}</div>
    </div>
  )
}
