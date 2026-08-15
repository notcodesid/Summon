import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { imageDataFromBase64, ImageValidationError, MAX_IMAGE_BYTES } from '../_shared/image.ts'
import { AuthError, requirePrivyUserId } from '../_shared/privy.ts'
import { serviceClient } from '../_shared/supabase.ts'

const CREATURE_BUCKET = 'creature-photos'
const PROFILE_BUCKET = 'profile-photos'
const SIGNED_URL_SECONDS = 10 * 60

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

type CreatureRow = {
  id: string
  species: string
  common_name: string
  rarity: string
  stats: Record<string, number>
  note: string
  photo_uri: string | null
  cutout_uri?: string | null
  captured_at: string
}

function storagePath(value: string | null | undefined, bucket: string): string | null {
  if (!value || value.startsWith('data:') || value.startsWith('file:')) return null
  if (!value.includes('://')) return value.replace(/^\/+/, '')

  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ]
  for (const marker of markers) {
    const index = value.indexOf(marker)
    if (index >= 0) {
      return decodeURIComponent(value.slice(index + marker.length).split('?')[0])
    }
  }
  return null
}

async function signedUrl(
  supabase: ReturnType<typeof serviceClient>,
  bucket: string,
  storedValue: string | null | undefined,
): Promise<string | null> {
  const path = storagePath(storedValue, bucket)
  if (!path) return null

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('sign url', error)
    throw new Error('Could not prepare private media')
  }
  return data.signedUrl
}

async function deleteStoredObjects(
  supabase: ReturnType<typeof serviceClient>,
  bucket: string,
  values: (string | null | undefined)[],
): Promise<void> {
  const paths = [
    ...new Set(values.map((value) => storagePath(value, bucket)).filter((path): path is string => Boolean(path))),
  ]
  if (paths.length === 0) return

  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) {
    console.error('storage delete', bucket, error)
    throw new Error('Could not remove private media')
  }
}

function isGoogleProfileUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'lh3.googleusercontent.com' ||
        url.hostname.endsWith('.googleusercontent.com') ||
        url.hostname.endsWith('.ggpht.com'))
    )
  } catch {
    return false
  }
}

function extensionFor(contentType: string | null): string {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  return 'jpg'
}

async function imageFromGoogleProfile(url: string): Promise<{
  bytes: Uint8Array
  contentType: string
}> {
  if (!isGoogleProfileUrl(url)) {
    throw new ImageValidationError('Invalid Google profile image.')
  }

  const response = await fetch(url, { redirect: 'error' })
  if (!response.ok) throw new Error('Could not fetch Google profile image.')

  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('Profile image is too large. Choose another photo.')
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new ImageValidationError('Google profile image is not an image.')
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('Profile image is too large. Choose another photo.')
  }

  return { bytes, contentType }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const privyUserId = await requirePrivyUserId(req)
    const supabase = serviceClient()
    const body = (await req.json()) as {
      action?: string
      creature?: CreaturePayload
      imageBase64?: string
      cutoutBase64?: string
      walletAddress?: string
      email?: string
      photoSource?: 'google' | 'upload'
      sourceUrl?: string
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
      return jsonResponse({
        player: data
          ? {
              ...data,
              photo_url: await signedUrl(supabase, PROFILE_BUCKET, data.photo_url),
            }
          : null,
      })
    }

    if (action === 'save_player_photo') {
      const photoSource = body.photoSource
      if (photoSource !== 'google' && photoSource !== 'upload') {
        return errorResponse('Missing or invalid photo source', 400)
      }

      if (photoSource === 'google') {
        const { data } = await supabase
          .from('players')
          .select('photo_source, photo_url')
          .eq('privy_user_id', privyUserId)
          .maybeSingle()
        if (data?.photo_source === 'upload') {
          return jsonResponse({
            ok: true,
            skipped: true,
            photoUrl: await signedUrl(supabase, PROFILE_BUCKET, data.photo_url),
          })
        }
      }

      const image =
        photoSource === 'upload'
          ? {
              ...imageDataFromBase64(body.imageBase64 ?? ''),
              contentType: 'image/jpeg',
            }
          : await imageFromGoogleProfile(body.sourceUrl ?? '')
      const path = `${privyUserId}/profile.${extensionFor(image.contentType)}`
      const { data: currentProfile } = await supabase
        .from('players')
        .select('photo_url')
        .eq('privy_user_id', privyUserId)
        .maybeSingle()
      const { error: uploadError } = await supabase.storage.from(PROFILE_BUCKET).upload(path, image.bytes, {
        contentType: image.contentType,
        upsert: true,
      })
      if (uploadError) {
        console.error('profile upload', uploadError)
        return errorResponse('Could not store profile photo', 500)
      }

      const { error } = await supabase.from('players').upsert(
        {
          privy_user_id: privyUserId,
          photo_url: path,
          photo_source: photoSource,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )
      if (error) {
        console.error(error)
        return errorResponse('Could not save profile photo', 500)
      }
      const previousPath = storagePath(currentProfile?.photo_url, PROFILE_BUCKET)
      if (previousPath && previousPath !== path) {
        await deleteStoredObjects(supabase, PROFILE_BUCKET, [previousPath])
      }

      return jsonResponse({
        ok: true,
        photoUrl: await signedUrl(supabase, PROFILE_BUCKET, path),
      })
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

      const creatures = await Promise.all(
        ((data ?? []) as CreatureRow[]).map(async (row) => ({
          ...row,
          photo_uri: await signedUrl(supabase, CREATURE_BUCKET, row.photo_uri),
          cutout_uri: await signedUrl(supabase, CREATURE_BUCKET, row.cutout_uri),
        })),
      )
      return jsonResponse({ creatures })
    }

    if (action === 'clear') {
      const { data, error: readError } = await supabase
        .from('creatures')
        .select('photo_uri, cutout_uri')
        .eq('privy_user_id', privyUserId)
      if (readError) {
        console.error(readError)
        return errorResponse('Could not load collection for deletion', 500)
      }

      await deleteStoredObjects(
        supabase,
        CREATURE_BUCKET,
        (data ?? []).flatMap((row) => [row.photo_uri, row.cutout_uri]),
      )
      const { error } = await supabase.from('creatures').delete().eq('privy_user_id', privyUserId)
      if (error) {
        console.error(error)
        return errorResponse('Could not clear collection', 500)
      }
      return jsonResponse({ ok: true })
    }

    if (action === 'delete_account') {
      const [{ data: player, error: playerError }, { data: creatures, error: creatureError }] = await Promise.all([
        supabase.from('players').select('photo_url').eq('privy_user_id', privyUserId).maybeSingle(),
        supabase.from('creatures').select('photo_uri, cutout_uri').eq('privy_user_id', privyUserId),
      ])
      if (playerError || creatureError) {
        console.error(playerError ?? creatureError)
        return errorResponse('Could not load account data for deletion', 500)
      }

      await deleteStoredObjects(
        supabase,
        CREATURE_BUCKET,
        (creatures ?? []).flatMap((row) => [row.photo_uri, row.cutout_uri]),
      )
      await deleteStoredObjects(supabase, PROFILE_BUCKET, [player?.photo_url])

      const { error } = await supabase.from('players').delete().eq('privy_user_id', privyUserId)
      if (error) {
        console.error(error)
        return errorResponse('Could not delete account', 500)
      }
      return jsonResponse({ ok: true })
    }

    if (action === 'save') {
      const creature = body.creature
      if (!creature?.id || !creature.species || !creature.commonName) {
        return errorResponse('Invalid creature payload', 400)
      }

      const { error: playerError } = await supabase.from('players').upsert(
        {
          privy_user_id: privyUserId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'privy_user_id' },
      )
      if (playerError) {
        console.error(playerError)
        return errorResponse('Could not save player', 500)
      }

      const image = imageDataFromBase64(body.imageBase64 ?? '')
      const path = `${privyUserId}/${creature.id}.jpg`
      const { error: uploadError } = await supabase.storage.from(CREATURE_BUCKET).upload(path, image.bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (uploadError) {
        console.error('creature upload', uploadError)
        return errorResponse('Could not store photo', 500)
      }

      let cutoutPath: string | null = null
      if (body.cutoutBase64) {
        try {
          const cutoutImage = imageDataFromBase64(body.cutoutBase64)
          cutoutPath = `${privyUserId}/${creature.id}_cutout.png`
          const { error: cutoutUploadError } = await supabase.storage.from(CREATURE_BUCKET).upload(cutoutPath, cutoutImage.bytes, {
            contentType: 'image/png',
            upsert: true,
          })
          if (cutoutUploadError) {
            console.error('cutout upload', cutoutUploadError)
            cutoutPath = null
          }
        } catch {
          cutoutPath = null
        }
      }

      const row = {
        id: creature.id,
        privy_user_id: privyUserId,
        species: creature.species,
        common_name: creature.commonName,
        rarity: creature.rarity || 'common',
        stats: creature.stats ?? {},
        note: creature.note ?? '',
        photo_uri: path,
        cutout_uri: cutoutPath,
        captured_at: creature.capturedAt ? new Date(creature.capturedAt).toISOString() : new Date().toISOString(),
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
          photoUri: await signedUrl(supabase, CREATURE_BUCKET, row.photo_uri),
          cutoutUri: row.cutout_uri ? await signedUrl(supabase, CREATURE_BUCKET, row.cutout_uri) : null,
          capturedAt: Date.parse(row.captured_at),
        },
      })
    }

    return errorResponse(`Unknown action: ${action}`, 400)
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, 401)
    if (error instanceof ImageValidationError) return errorResponse(error.message, 413)
    console.error(error)
    return errorResponse('Request failed', 500)
  }
})
