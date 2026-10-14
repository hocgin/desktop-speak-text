import type { Config } from 'drizzle-kit'

export default {
  dialect: 'sqlite',
  schema: './src/lib/schema.ts'
} satisfies Config
