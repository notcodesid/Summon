import { clearLocalCollection } from '@/lib/collection'
import { callEdgeFunction, isEdgeConfigured } from '@/lib/edge'
import { clearPlayerPhotoCache } from '@/lib/player-photo'

/**
 * Permanently removes Summon-held data for the signed-in player. Privy
 * identity management remains with Privy; this deletes the Summon player row,
 * collection rows, and all private media before the app signs the user out.
 */
export async function deleteAccountData(privyUserId?: string): Promise<boolean> {
  if (!isEdgeConfigured() || !privyUserId) return false

  try {
    await callEdgeFunction('creatures', { action: 'delete_account' })
    await Promise.all([clearLocalCollection(privyUserId), clearPlayerPhotoCache(privyUserId)])
    return true
  } catch {
    return false
  }
}
