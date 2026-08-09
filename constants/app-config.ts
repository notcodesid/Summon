export class AppConfig {
  static name = 'Summon'
  static uri = 'https://summon.app'
  static privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL ?? `${AppConfig.uri}/privacy`
  static termsUrl = process.env.EXPO_PUBLIC_TERMS_URL ?? `${AppConfig.uri}/terms`
  static supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? ''
  /** iOS bundle id / Android package */
  static bundleId = 'com.notcodesid.summon'
  static scheme = 'summon'
}
