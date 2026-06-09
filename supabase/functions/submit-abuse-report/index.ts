import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// In-memory rate limit: 5 reports / hour / user
const userHits = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const arr = (userHits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    userHits.set(userId, arr)
    return true
  }
  arr.push(now)
  userHits.set(userId, arr)
  return false
}

const ALLOWED_CATEGORIES = new Set(['self_delete', 'dmca', 'other'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const user = userData.user

    if (isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const category = String(body?.category ?? '')
    const memoryId = body?.memory_id ? String(body.memory_id) : null
    const message = body?.message ? String(body.message).slice(0, 500) : null

    if (!ALLOWED_CATEGORIES.has(category)) {
      return new Response(JSON.stringify({ error: 'invalid_category' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('abuse_reports')
      .insert({
        reporter_user_id: user.id,
        memory_id: memoryId,
        category,
        message,
      })
      .select('id, created_at')
      .single()

    if (insErr || !inserted) {
      console.error('abuse_reports insert failed', insErr)
      return new Response(JSON.stringify({ error: 'insert_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fire-and-await internal notification email (template defines fixed `to`)
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'abuse-report',
          idempotencyKey: `abuse-${inserted.id}`,
          templateData: {
            reporterUserId: user.id,
            reporterEmail: user.email,
            memoryId,
            category,
            message,
            reportId: inserted.id,
            createdAt: inserted.created_at,
          },
        },
      })
    } catch (e) {
      console.error('abuse notification email failed', e)
      // do not fail the user-facing request — row is already stored
    }

    return new Response(JSON.stringify({ success: true, id: inserted.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('submit-abuse-report error', e)
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
