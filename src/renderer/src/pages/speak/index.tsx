import React, { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { AudioLines, History } from 'lucide-react'
import { Card } from '@/renderer/components/ui/card.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select.js'
import { useTranslation } from 'react-i18next'
import { useAIState } from '@/lib/ai/renderer.js'
import type { LocalTTSInput } from '@/lib/ai/type.js'
import { LocalVoicePanel } from './components/LocalVoicePanel.js'
import { TextAssistant } from './components/TextAssistant.js'
import { useTTS } from '@/lib/tts/renderer.js'
import type { TTSOptions, TTSRecord } from '@/lib/tts/type.js'
import { TextEditor } from './components/TextEditor.jsx'
import { VoiceSelector } from './components/VoiceSelector.jsx'
import { ParameterPanel } from './components/ParameterPanel.jsx'
import { AudioPlayer } from './components/AudioPlayer.jsx'
import { HistoryList } from './components/HistoryList.jsx'

const SETTINGS_KEY = 'speakSettings'

interface SpeakSettings {
  engine?: 'edge' | 'local'
  local?: LocalTTSInput
  referenceName?: string
  voiceName?: string
  options?: TTSOptions
}

// 读取上次保存的配置（读取失败时回退为默认值）
function loadSettings(): SpeakSettings {
  try {
    return window.electron.store.get<SpeakSettings>(SETTINGS_KEY) ?? {}
  } catch {
    return {}
  }
}

function SpeakPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [saved] = useState(loadSettings)
  const { state: aiState } = useAIState()
  const [engine, setEngine] = useState<'edge' | 'local'>(saved.engine ?? 'edge')
  const [local, setLocal] = useState<LocalTTSInput>(
    saved.local ?? { modelId: '', language: 'zh', speed: 1 }
  )
  const [referenceName, setReferenceName] = useState(saved.referenceName ?? '')
  const [generationTask, setGenerationTask] = useState<string>()
  const [text, setText] = useState('')
  useEffect(() => {
    if (!local.modelId && aiState?.defaultModel) {
      const model = aiState.models.find((m) => m.id === aiState.defaultModel && m.installed)
      if (model)
        setLocal({
          modelId: model.id,
          speaker: model.family === 'kokoro_tts' ? 'zf_xiaobei' : model.voices?.[0],
          language: 'zh',
          speed: 1
        })
    }
  }, [aiState, local.modelId])
  useEffect(() => {
    if (
      aiState &&
      local.modelId &&
      !aiState.models.some((model) => model.id === local.modelId && model.installed)
    ) {
      setLocal({ modelId: '', language: 'zh', speed: 1 })
      setReferenceName('')
    }
  }, [aiState, local.modelId])
  const [voiceName, setVoiceName] = useState<string>(saved.voiceName ?? '')
  const [options, setOptions] = useState<TTSOptions>(
    saved.options ?? { rate: 1.0, volume: 1.0, pitch: 0.0 }
  )

  // 配置变更后持久化，下次打开自动恢复
  useEffect(() => {
    try {
      window.electron.store.set(SETTINGS_KEY, { engine, local, referenceName, voiceName, options })
    } catch (error) {
      console.error('保存语音配置失败:', error)
    }
  }, [engine, local, referenceName, voiceName, options])
  const [language] = useState('zh-CN')
  const [activeTab, setActiveTab] = useState('generate')
  const [previewingVoice, setPreviewingVoice] = useState<string | undefined>(undefined)
  const [currentPlayingRecordId, setCurrentPlayingRecordId] = useState<number | null>(null) // 当前播放的历史记录ID
  // 历史记录使用页面级独立的 audio 元素：切到「历史」Tab 时生成页会被卸载，不能依赖 AudioPlayer
  const historyAudioRef = useRef<HTMLAudioElement | null>(null)
  const historyPlaySeqRef = useRef(0)
  const [downloadingHistoryId, setDownloadingHistoryId] = useState<number | null>(null) // 正在下载的历史记录ID

  const {
    isGenerating,
    isPlaying,
    voices,
    history,
    currentAudio,
    generate,
    deleteRecord,
    getVoicesByLanguage,
    previewVoice
  } = useTTS()

  // 初始化默认语音
  useEffect(() => {
    const chineseVoices = getVoicesByLanguage('zh')
    if (chineseVoices.length > 0 && !voiceName) {
      setVoiceName(chineseVoices[0].name)
    }
  }, [voices, voiceName, getVoicesByLanguage])

  // 语言切换时更新默认语音
  useEffect(() => {
    const langVoices = getVoicesByLanguage(language)
    if (langVoices.length > 0) {
      const currentVoiceExists = langVoices.some((v) => v.name === voiceName)
      if (!currentVoiceExists) {
        setVoiceName(langVoices[0].name)
      }
    }
  }, [language, voiceName, getVoicesByLanguage])

  // 生成音频
  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      toast.warning(t('speak.enterText'))
      return
    }

    if (engine === 'edge' && !voiceName) {
      toast.warning(t('speak.selectVoice'))
      return
    }

    const taskId = crypto.randomUUID()
    setGenerationTask(engine === 'local' ? taskId : undefined)
    const result = await generate(
      engine === 'local' ? { engine: 'local', text, local, taskId } : { text, voiceName, options }
    )
    setGenerationTask(undefined)

    if (result.success) {
      toast.success(t('speak.generated'))
    } else {
      toast.error(t('speak.generateFailed', { error: result.error }))
    }
  }, [text, voiceName, options, generate, engine, local, t])

  // 初始化历史记录播放用的 audio 元素
  useEffect(() => {
    const audio = new Audio()
    const reset = () => setCurrentPlayingRecordId(null)
    audio.addEventListener('ended', reset)
    audio.addEventListener('error', reset)
    historyAudioRef.current = audio
    return () => {
      audio.removeEventListener('ended', reset)
      audio.removeEventListener('error', reset)
      audio.pause()
      historyAudioRef.current = null
    }
  }, [])

  // 历史记录操作
  const handlePlayHistory = useCallback(
    async (record: TTSRecord) => {
      const audio = historyAudioRef.current
      if (!record.audioPath || !audio) return
      const seq = ++historyPlaySeqRef.current
      audio.pause()
      setCurrentPlayingRecordId(record.id)
      try {
        const dataUrl = await window.electron.tts.loadAudio(record.audioPath)
        // 期间用户点了其他记录或停止，丢弃本次结果
        if (seq !== historyPlaySeqRef.current) return
        audio.src = dataUrl
        audio.currentTime = 0
        await audio.play()
      } catch (error) {
        if (seq !== historyPlaySeqRef.current) return
        console.error('播放历史记录失败:', error)
        setCurrentPlayingRecordId(null)
        toast.error(t('speak.noAudioFile'))
      }
    },
    [t]
  )

  // 停止历史记录播放
  const handleStopHistory = useCallback(() => {
    historyPlaySeqRef.current++
    const audio = historyAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setCurrentPlayingRecordId(null)
  }, [])

  const handleDeleteRecord = useCallback(
    async (id: number) => {
      const result = await deleteRecord(id)
      if (result.success) {
        toast.success(t('speak.deleteOk'))
      } else {
        toast.error(t('speak.deleteFailed'))
      }
    },
    [deleteRecord, t]
  )

  // 下载历史记录音频
  const handleDownloadHistory = useCallback(async (record: TTSRecord) => {
    if (!record.audioPath) {
      toast.warning(t('speak.noAudioFile'))
      return
    }

    try {
      setDownloadingHistoryId(record.id)
      // 通过 IPC 读取音频文件，直接作为 Uint8Array 传递
      const buffer = await window.electron.tts.readAudioFile(record.audioPath)
      const uint8Array = new Uint8Array(buffer)
      const result = await window.electron.tts.saveAudio(uint8Array)

      if (result.success) {
        toast.success(t('speak.downloadOk'))
      } else {
        toast.error(t('speak.downloadFailed'))
      }
    } catch (error) {
      console.error('下载音频失败:', error)
      toast.error(t('speak.downloadFailed'))
    } finally {
      setDownloadingHistoryId(null)
    }
  }, [t])

  // 下载音频
  const handleDownload = useCallback(async () => {
    if (!currentAudio) {
      toast.warning(t('speak.noAudioToDownload'))
      return
    }

    try {
      // 通过 IPC 读取音频文件，直接作为 Uint8Array 传递
      const buffer = await window.electron.tts.readAudioFile(currentAudio)
      const uint8Array = new Uint8Array(buffer)
      const result = await window.electron.tts.saveAudio(uint8Array)

      if (result.success) {
        toast.success(t('speak.downloadOk'))
      } else {
        toast.error(t('speak.downloadFailed'))
      }
    } catch (error) {
      console.error('下载音频失败:', error)
      toast.error(t('speak.downloadFailed'))
    }
  }, [currentAudio, t])

  // 试听语音
  const handlePreviewVoice = useCallback(
    async (voiceName: string): Promise<{ success: boolean; error?: string }> => {
      try {
        setPreviewingVoice(voiceName)
        const result = await previewVoice(voiceName)
        if (!result || !result.success) {
          toast.error(
            t('speak.previewFailed', { error: result?.error || t('common.unknownError') })
          )
          return { success: false, error: result?.error || t('common.unknownError') }
        }
        return { success: true }
      } catch (error) {
        console.error('试听失败:', error)
        toast.error(t('speak.previewFailedShort'))
        return { success: false, error: t('speak.previewFailedShort') }
      } finally {
        setPreviewingVoice(undefined)
      }
    },
    [previewVoice, t]
  )

  const hasAudio = !!currentAudio

  // 处理音频播放结束（包括停止）
  const handleAudioEnd = useCallback(() => {
    setCurrentPlayingRecordId(null)
  }, [])

  return (
    <div className="h-full overflow-y-auto px-4 pb-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-full flex-col">
        <div className="sticky top-0 z-10 -mx-4 bg-background px-4 py-3">
          <TabsList>
            <TabsTrigger value="generate">
              <AudioLines />
              {t('speak.tabGenerate')}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History />
              {t('speak.tabHistory')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="generate" className="mt-1 min-h-0 flex-1">
          {/* 大屏下两列等高并撑满可视区域：左侧文本区自适应高度，右侧音色列表自适应并内部滚动 */}
          <div className="grid gap-4 md:h-full md:min-h-[34rem] md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="flex min-h-0 min-w-0 flex-col gap-4">
              <Card className="min-h-0 flex-1 gap-3 p-5">
                <TextEditor
                  value={text}
                  onChange={setText}
                  maxLength={5000}
                  actions={<TextAssistant text={text} onChange={setText} state={aiState} />}
                />
                {generationTask && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {t('ai.localGenerating')}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.electron.ai.cancelTask(generationTask)}
                      >
                        {t('ai.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
              <Card className="shrink-0 bg-gradient-to-b from-card to-accent/40 p-5">
                <AudioPlayer
                  isGenerating={isGenerating}
                  isPlaying={isPlaying}
                  hasAudio={hasAudio}
                  currentAudioPath={currentAudio}
                  onGenerate={handleGenerate}
                  onDownload={handleDownload}
                  onStop={handleAudioEnd}
                  disabled={isGenerating}
                />
              </Card>
            </section>

            <aside className="min-h-0">
              <Card className="gap-5 overflow-y-auto p-5 md:h-full">
                <div className="shrink-0">
                  <div className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground">
                    {t('speak.engine')}
                  </div>
                  <Select
                    value={engine}
                    disabled={isGenerating || !!previewingVoice}
                    onValueChange={(v) => setEngine(v as 'edge' | 'local')}
                  >
                    <SelectTrigger aria-label={t('ai.engine')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="edge">Edge TTS</SelectItem>
                      <SelectItem value="local" disabled={!aiState?.supported}>
                        {t('ai.localModels')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {engine === 'local' ? (
                  <LocalVoicePanel
                    state={aiState}
                    value={local}
                    onChange={setLocal}
                    disabled={isGenerating}
                    referenceName={referenceName}
                    onReferenceName={setReferenceName}
                  />
                ) : (
                  <>
                    <VoiceSelector
                      voices={voices}
                      value={voiceName}
                      onChange={setVoiceName}
                      disabled={isGenerating || !!previewingVoice}
                      onPreview={handlePreviewVoice}
                      previewing={previewingVoice}
                    />
                    <div className="shrink-0">
                      <div className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground">
                        {t('speak.params')}
                      </div>
                      <ParameterPanel value={options} onChange={setOptions} disabled={isGenerating} />
                    </div>
                  </>
                )}
              </Card>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-1 flex-1">
          <Card className="p-2">
            <HistoryList
              records={history}
              onPlay={handlePlayHistory}
              onStop={handleStopHistory}
              onDelete={handleDeleteRecord}
              onDownload={handleDownloadHistory}
              loading={false}
              currentPlayingId={currentPlayingRecordId}
              downloadingId={downloadingHistoryId}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SpeakPage
