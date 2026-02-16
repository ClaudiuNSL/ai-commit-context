import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

const log = logger.child({ route: 'health' })

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy'
  version: string
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      latencyMs?: number
      error?: string
    }
  }
}

export async function GET() {
  const startTime = Date.now()
  const health: HealthStatus = {
    status: 'ok',
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: 'ok',
      },
    },
  }

  // Check database connectivity
  try {
    const supabase = getSupabaseAdmin()
    const dbStart = Date.now()

    // Simple query to check connectivity
    const { error } = await supabase.from('sessions').select('id').limit(1)

    health.checks.database.latencyMs = Date.now() - dbStart

    if (error) {
      health.checks.database.status = 'error'
      health.checks.database.error = 'Query failed'
      health.status = 'degraded'
      log.warn('Health check: database query failed', { error: error.message })
    }
  } catch (error) {
    health.checks.database.status = 'error'
    health.checks.database.error = 'Connection failed'
    health.status = 'unhealthy'
    log.error('Health check: database connection failed', error)
  }

  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
