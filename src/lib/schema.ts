import { int, sqliteTable, text, real } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable('posts', {
  id: int('id').primaryKey().default(0),
  title: text('title').notNull().default('')
})

export const speakRecords = sqliteTable('speak_records', {
  engine: text('engine').notNull().default('edge'),
  modelId: text('model_id'),
  generationParams: text('generation_params'),
  id: int('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  voiceName: text('voice_name').notNull(),
  rate: real('rate').notNull().default(1.0),
  volume: real('volume').notNull().default(1.0),
  pitch: real('pitch').notNull().default(0.0),
  language: text('language').notNull().default('zh-CN'),
  audioPath: text('audio_path'),
  duration: int('duration'),
  wordCount: int('word_count').notNull(),
  createdAt: int('created_at').notNull(),
  updatedAt: int('updated_at').notNull()
})
