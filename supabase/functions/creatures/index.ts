import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { AuthError, requirePrivyUserId } from '../_shared/privy.ts'
import { serviceClient } from '../_shared/supabase.ts'

/**
 * Authenticated creature API (service role + Privy).
 *
 * POST body:
 *   { action: "list" }
 *   { action: "save", creature: CreaturePayload, imageBase64?: string }
 *   { action: "clear" }
 *   { action: "upsert_player", walletAddress?: string, email?: string }
 */
type CreaturePayload = {
  id: string
  species: string
  commonName: string
  rarity: string
  stats: Record<string, number>
  note?: string
  photoUri?: string
  capturedAt?: number
}

function stripBase64Prefix(data: string): string {
  const marker = 'base64,'
  const idx = data.indexOf(marker)
  return idx >= 0 ? data.slice(idx + marker.length) : data
}

function publicPhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/creature-photos/${path}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const privyUserId = await requirePrivyUserId(req)
    const supabase = serviceClient()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const body = (await req.json()) as {
      action?: string
      creature?: CreaturePayload
      imageBase64?: string
      walletAddress?: string
      email?: string
    }

    const action = body.action ?? 'list'

    if (action === 'upsert_player') {
      const { error } = await supabase.from('players').upsert(
        {
          privy_user_id: privyUserId,
          wallet_address: body.walletAddress ?? null,
          email: body.email ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )
      if (error) {
        console.error(error)
        return errorResponse('Could not save player', 500)
      }
      return jsonResponse({ ok: true })
    }

    if (action === 'get_player') {
      const { data, error } = await supabase
        .from('players')
        .select('photo_url, photo_source, wallet_address, email')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      if (error) {
        console.error(error)
        return errorResponse('Could not load player', 500)
      }
      return jsonResponse({ player: data })
    }

    if (action === 'save_player_photo') {
      const photoUrl = (body as { photoUrl?: string }).photoUrl
      const photoSource = (body as { photoSource?: 'google' | 'upload' }).photoSource
      if (!photoUrl || !photoSource) {
        return errorResponse('Missing photoUrl or photoSource', 400)
      }

      if (photoSource === 'google') {
        const { data } = await supabase
          .from('players')
          .select('photo_source')
          .eq('privy_user_id', privyUserId)
          .maybeSingle()
        if (data?.photo_source === 'upload') {
          return jsonResponse({ ok: true, skipped: true })
        }
      }

      const { error } = await supabase.from('players').upsert(
        {
          privy_user_id: privyUserId,
          photo_url: photoUrl,
          photo_source: photoSource,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )
      if (error) {
        console.error(error)
        return errorResponse('Could not save photo', 500)
      }
      return jsonResponse({ ok: true })
    }

    if (action === 'list') {
      const { data, error } = await supabase
        .from('creatures')
        .select('*')
        .eq('privy_user_id', privyUserId)
        .order('captured_at', { ascending: false })

      if (error) {
        console.error(error)
        return errorResponse('Could not load collection', 500)
      }
      return jsonResponse({ creatures: data ?? [] })
    }

    if (action === 'clear') {
      const { error } = await supabase
        .from('creatures')
        .delete()
        .eq('privy_user_id', privyUserId)
      if (error) {
        console.error(error)
        return errorResponse('Could not clear collection', 500)
      }
      return jsonResponse({ ok: true })
    }

    if (action === 'save') {
      const creature = body.creature
      if (!creature?.id || !creature.species || !creature.commonName) {
        return errorResponse('Invalid creature payload', 400)
      }

      // Ensure player row exists (FK on creatures).
      await supabase.from('players').upsert(
        {
          privy_user_id: privyUserId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )

      let photoUri = creature.photoUri ?? null
      const pure = stripBase64Prefix(body.imageBase64 ?? '')

      if (pure) {
        const path = `${privyUserId}/${creature.id}.jpg`
        const bytes = Uint8Array.from(atob(pure), (c) => c.charCodeAt(0))
        const { error: uploadError } = await supabase.storage
          .from('creature-photos')
          .upload(path, bytes, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (uploadError) {
          console.error('upload', uploadError)
          return errorResponse('Could not store photo', 500)
        }
        photoUri = publicPhotoUrl(supabaseUrl, path)
      }

      const row = {
        id: creature.id,
        privy_user_id: privyUserId,
        species: creature.species,
        common_name: creature.commonName,
        rarity: creature.rarity || 'common',
        stats: creature.stats ?? {},
        note: creature.note ?? '',
        photo_uri: photoUri,
        captured_at: creature.capturedAt
          ? new Date(creature.capturedAt).toISOString()
          : new Date().toISOString(),
      }

      const { error } = await supabase.from('creatures').upsert(row, {
        onConflict: 'id',
      })
      if (error) {
        console.error(error)
        return errorResponse('Could not save creature', 500)
      }

      return jsonResponse({
        ok: true,
        creature: {
          id: row.id,
          species: row.species,
          commonName: row.common_name,
          rarity: row.rarity,
          stats: row.stats,
          note: row.note,
          photoUri: row.photo_uri,
          capturedAt: Date.parse(row.captured_at),
        },
      })
    }

    return errorResponse(`Unknown action: ${action}`, 400)
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.message, 401)
    }
    console.error(err)
    return errorResponse('Request failed', 500)
  }
})
