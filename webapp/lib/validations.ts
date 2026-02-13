import { z } from 'zod'

// Git commit SHA validation (7-40 hex characters)
const commitShaRegex = /^[a-f0-9]{7,40}$/i
const commitShaValidator = z.string()
  .min(7, 'SHA must be at least 7 characters')
  .max(40, 'SHA must be at most 40 characters')
  .regex(commitShaRegex, 'SHA must be a valid hexadecimal string')

// Session upload schema
export const uploadSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  projectName: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional().nullable(),
  messages: z.array(z.object({
    role: z.string().optional(),
    type: z.string().optional(),
    content: z.union([z.string(), z.array(z.any())]).optional(),
    message: z.object({
      role: z.string().optional(),
      content: z.union([z.string(), z.array(z.any())]).optional()
    }).optional(),
    timestamp: z.string().optional()
  })).min(1, 'messages array cannot be empty'),
  filesModified: z.array(z.string()).optional(),
  repos: z.array(z.any()).optional().nullable()
})

// Commit link schema
export const linkCommitSchema = z.object({
  sha: commitShaValidator,
  repoUrl: z.string().url().optional().or(z.literal('')),
  repoOwner: z.string().max(100).optional(),
  repoName: z.string().max(100).optional(),
  message: z.string().max(500).optional()
})

// API key schemas
export const createApiKeySchema = z.object({
  name: z.string().max(100).optional().default('Default')
})

export const deleteApiKeySchema = z.object({
  id: z.string().uuid('Invalid key id')
})

// Query parameter schemas
export const userIdQuerySchema = z.object({
  userId: z.string().min(1, 'userId is required')
})

export const codeQuerySchema = z.object({
  code: z.string().min(1, 'code is required')
})

export const deviceCodeQuerySchema = z.object({
  device_code: z.string().min(1, 'device_code is required')
})

// Route parameter schemas
export const sessionCodeParamSchema = z.object({
  code: z.string().min(1, 'Session code is required')
})

export const commitShaParamSchema = z.object({
  sha: commitShaValidator
})

// Helper to parse and return validation errors
export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return { success: false, error: errors }
  }
  return { success: true, data: result.data }
}

export function parseQuery<T>(schema: z.ZodSchema<T>, params: URLSearchParams):
  { success: true; data: T } | { success: false; error: string } {
  const obj: Record<string, string> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })
  return parseBody(schema, obj)
}
