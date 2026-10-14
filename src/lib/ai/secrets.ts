import fs from 'node:fs/promises'
export interface SecretCodec {
  available(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
}
export class SecretVault {
  private session = new Map<string, string>()
  private encrypted: Record<string, string> = Object.create(null)
  constructor(
    private file: string,
    private codec: SecretCodec
  ) {}
  async load() {
    try {
      this.encrypted = Object.assign(
        Object.create(null),
        JSON.parse(await fs.readFile(this.file, 'utf8'))
      )
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw new Error('Cannot read AI key vault')
    }
  }
  get(id: string) {
    if (this.session.has(id)) return this.session.get(id)
    if (this.encrypted[id] && this.codec.available()) {
      try {
        return this.codec.decrypt(Buffer.from(this.encrypted[id], 'base64'))
      } catch {
        throw new Error('Cannot decrypt API key; enter it again')
      }
    }
    return undefined
  }
  info(id: string) {
    return {
      hasKey: !!(this.session.get(id) || this.encrypted[id]),
      sessionOnly: this.session.has(id)
    }
  }
  async set(id: string, value?: string) {
    this.session.delete(id)
    delete this.encrypted[id]
    if (value) {
      if (this.codec.available()) this.encrypted[id] = this.codec.encrypt(value).toString('base64')
      else this.session.set(id, value)
    }
    const temporary = `${this.file}.tmp`
    await fs.writeFile(temporary, JSON.stringify(this.encrypted), { mode: 0o600 })
    await fs.rename(temporary, this.file)
  }
}
