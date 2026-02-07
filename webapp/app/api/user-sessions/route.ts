import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { userIdQuerySchema, parseQuery } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const parsed = parseQuery(userIdQuerySchema, request.nextUrl.searchParams)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error }, { status: 400 })
    }

    const { userId } = parsed.data

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('sessions')
      .select('id, short_code, project_name, message_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map to expected format
    const sessions = data?.map(s => ({
      id: s.id,
      short_code: s.short_code,
      title: s.project_name,
      message_count: s.message_count,
      created_at: s.created_at
    })) || []

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error loading sessions:', error)
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
  }
}
