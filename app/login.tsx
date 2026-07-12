import { Redirect } from 'expo-router'

/**
 * Legacy /login route — auth lives on onboarding now.
 * Keep the path so old links don't 404; always bounce to the gated flow.
 */
export default function LoginScreen() {
  return <Redirect href="/onboarding" />
}
