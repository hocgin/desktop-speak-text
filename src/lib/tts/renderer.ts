import { useEffect, useState, useCallback, useRef } from 'react'
import { useUpdateEffect } from 'ahooks'
import type {
  TTSGenerateParams,
  TTSGenerateResult,
  VoiceInfo,
  TTSRecord,
  TTSOptions
} from './type.js'

export function useTTS() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [history, setHistory] = useState<TTSRecord[]>([])
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 初始化音频元素
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
      })
      audioRef.current.addEventListener('pause', () => {
        setIsPlaying(false)
      })
      audioRef.current.addEventListener('play', () => {
        setIsPlaying(true)
      })
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // 加载语音列表
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const voicesList = await window.electron.tts.getVoices()
        setVoices(voicesList)
      } catch (error) {
        console.error('加载语音列表失败:', error)
      }
    }
    loadVoices()
  }, [])

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const records = await window.electron.tts.getHistory(50)
      setHistory(records)
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 生成音频
  const generate = useCallback(async (params: TTSGenerateParams): Promise<TTSGenerateResult> => {
    setIsGenerating(true)
    try {
      const result = await window.electron.tts.generate(params)
      if (result.success) {
        await loadHistory()
        if (result.data?.audioPath) {
          setCurrentAudio(result.data.audioPath)
        }
      }
      return result
    } catch (error) {
      console.error('生成音频失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    } finally {
      setIsGenerating(false)
    }
  }, [loadHistory])

  // 播放音频
  const play = useCallback(async (audioPath: string) => {
    if (!audioRef.current) return

    try {
      // 通过 IPC 加载音频文件为 data URL
      const dataUrl = await window.electron.tts.loadAudio(audioPath)
      audioRef.current.src = dataUrl
      audioRef.current.currentTime = 0
      await audioRef.current.play()
      setCurrentAudio(audioPath)
    } catch (error) {
      console.error('播放音频失败:', error)
      throw error
    }
  }, [])

  // 暂停音频
  const pause = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
  }, [])

  // 停止音频
  const stop = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
  }, [])

  // 保存音频
  const saveAudio = useCallback(async (audioData: Uint8Array, path?: string) => {
    return await window.electron.tts.saveAudio(audioData, path)
  }, [])

  // 删除记录
  const deleteRecord = useCallback(async (id: number) => {
    const result = await window.electron.tts.deleteRecord(id)
    if (result.success) {
      await loadHistory()
    }
    return result
  }, [loadHistory])

  // 试听语音
  const previewVoice = useCallback(async (voiceName: string) => {
    if (!audioRef.current) return

    try {
      setIsGenerating(true)
      const result = await window.electron.tts.previewVoice(voiceName)
      if (result.success && result.dataUrl) {
        audioRef.current.src = result.dataUrl
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      }
      return result
    } catch (error) {
      console.error('试听语音失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    } finally {
      setIsGenerating(false)
    }
  }, [])

  // 按语言过滤语音
  const getVoicesByLanguage = useCallback((language: string) => {
    return voices.filter(v => v.locale.startsWith(language))
  }, [voices])

  return {
    // 状态
    isGenerating,
    isPlaying,
    voices,
    history,
    currentAudio,

    // 方法
    generate,
    play,
    pause,
    stop,
    saveAudio,
    deleteRecord,
    loadHistory,
    getVoicesByLanguage,
    previewVoice,

    // 音频控制
    audioRef
  }
}

export type UseTTSReturn = ReturnType<typeof useTTS>
