export type DownloadSource = 'modelscope' | 'huggingface'
export type ModelMode = 'speaker' | 'design' | 'clone'
export interface ModelDefinition {
  id: string
  name: string
  family: string
  task?: string
  variant?: string
  precision: string
  remotePath: string
  size: number
  sha256: string
  revision?: string
  voices?: string[]
  mode: ModelMode
  languages: string[]
  licenseURL: string
}
export interface InstalledModel {
  id: string
  path: string
  managed: boolean
}
export interface ProviderConfig {
  id: string
  name: string
  preset: string
  baseURL: string
  model: string
  hasKey: boolean
  sessionOnly: boolean
}
export type ProviderInput = Omit<ProviderConfig, 'hasKey' | 'sessionOnly'> & {
  apiKey?: string
  clearKey?: boolean
}
export interface RuntimeInstallation {
  root: string
  executable: string
  tools: string
  files: Record<string, string>
}
export interface AIState {
  models: (ModelDefinition & { installed?: InstalledModel })[]
  providers: ProviderConfig[]
  defaultModel?: string
  defaultProvider?: string
  source: DownloadSource
  modelDirectory: string
  supported: boolean
  backend: string
  totalMemory: number
  localBusy: boolean
  runtimeReady: boolean
  runtimeVersion: string
  engineStatus: 'stopped' | 'starting' | 'ready'
  tasks: AITask[]
}
export interface AITask {
  id: string
  kind: 'download' | 'install' | 'import' | 'generate' | 'text'
  target?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  stage?: string
  completed?: number
  total?: number
  text?: string
  error?: string
}
export interface LocalTTSInput {
  modelId: string
  speaker?: string
  description?: string
  referenceId?: string
  language?: string
  speed?: number
  emotion?: string
}
export interface TextRequest {
  taskId: string
  providerId?: string
  text: string
  action: 'polish' | 'translate' | 'summarize' | 'custom'
  instruction?: string
  targetLanguage?: string
}
export interface AIAPI {
  getState(): Promise<AIState>
  installRuntime(taskId: string): Promise<void>
  downloadModel(id: string, taskId: string): Promise<void>
  importModel(taskId: string): Promise<void>
  removeModel(id: string): Promise<void>
  setDefaultModel(id: string): Promise<void>
  setSource(source: DownloadSource): Promise<void>
  openModelDirectory(): Promise<void>
  saveProvider(input: ProviderInput): Promise<void>
  removeProvider(id: string): Promise<void>
  setDefaultProvider(id: string): Promise<void>
  listProviderModels(id: string): Promise<string[]>
  testProvider(id: string): Promise<void>
  selectReference(): Promise<{ id: string; name: string; duration: number } | null>
  processText(request: TextRequest): Promise<void>
  cancelTask(id: string): Promise<void>
  onTask(callback: (task: AITask) => void): () => void
  onStateChanged(callback: () => void): () => void
}
