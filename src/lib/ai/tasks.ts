import type { AITask } from './type.js'
export class TaskManager {
  private tasks = new Map<string, { task: AITask; controller: AbortController; owner: number }>()
  constructor(private publish: (task: AITask, owner: number) => void) {}
  list(owner: number) {
    return [...this.tasks.values()].filter((t) => t.owner === owner).map((t) => t.task)
  }
  update(id: string, patch: Partial<AITask>) {
    const entry = this.tasks.get(id)
    if (!entry) return
    entry.task = { ...entry.task, ...patch, id }
    this.publish(entry.task, entry.owner)
  }
  async run<T>(
    task: Omit<AITask, 'status'>,
    owner: number,
    work: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (
      typeof task.id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(task.id) ||
      this.tasks.has(task.id)
    )
      throw new Error('Invalid or duplicate task ID')
    // Bound retained terminal tasks, preserving running tasks.
    if (this.tasks.size > 100)
      for (const [id, entry] of this.tasks) {
        if (entry.task.status !== 'running') this.tasks.delete(id)
        if (this.tasks.size <= 100) break
      }
    const controller = new AbortController()
    this.tasks.set(task.id, { task: { ...task, status: 'running' }, controller, owner })
    this.update(task.id, {})
    try {
      const value = await work(controller.signal)
      controller.signal.throwIfAborted()
      this.update(task.id, { status: 'completed' })
      return value
    } catch (error) {
      this.update(task.id, {
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        error: controller.signal.aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : String(error)
      })
      throw error
    }
  }
  cancel(id: string, owner: number) {
    const entry = this.tasks.get(id)
    if (entry?.owner === owner && entry.task.status === 'running') entry.controller.abort()
  }
  cancelOwner(owner: number) {
    for (const [id] of this.tasks) this.cancel(id, owner)
  }
  stop() {
    for (const entry of this.tasks.values()) entry.controller.abort()
  }
}
