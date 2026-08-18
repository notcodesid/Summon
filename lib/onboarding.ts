import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Whether this device has seen the intro flow.
 *
 * Device-scoped, not player-scoped: onboarding runs before sign-in, so there is
 * no Privy user id to key it by yet.
 */
const STORAGE_KEY = 'summon.onboarding.v1'

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'seen'
  } catch {
    // A storage failure should not trap the player in the intro forever.
    return true
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, 'seen')
  } catch {
    // Worst case the intro shows again next launch.
  }
}
