import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PropsWithChildren } from 'react'
import { Text, View } from 'react-native'
import { PrivyProvider } from '@privy-io/expo'
import { NetworkProvider } from '@/features/network/network-provider'
import { AppConfig } from '@/constants/app-config'
import { appStyles } from '@/constants/app-styles'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  const { appId, clientId } = AppConfig.privy

  if (!appId || !clientId) {
    return (
      <View style={[appStyles.screen, { justifyContent: 'center', padding: 16 }]}>
        <Text style={appStyles.title}>Privy not configured</Text>
        <Text style={{ marginTop: 8 }}>
          Set EXPO_PUBLIC_PRIVY_APP_ID and EXPO_PUBLIC_PRIVY_CLIENT_ID in .env.
        </Text>
        <Text style={{ marginTop: 8, color: '#666' }}>
          Create a mobile app client in the Privy Dashboard (Configuration → App settings →
          Clients). Register package/bundle {AppConfig.bundleId} and URL scheme {AppConfig.scheme}.
        </Text>
        <Text style={{ marginTop: 8, color: '#666' }}>
          Never put PRIVY_APP_SECRET in the mobile app — server only.
        </Text>
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={appId}
        clientId={clientId}
        config={{
          embedded: {
            solana: {
              // Auto-create a Solana embedded wallet on login if the user has none
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <NetworkProvider>{children}</NetworkProvider>
      </PrivyProvider>
    </QueryClientProvider>
  )
}
