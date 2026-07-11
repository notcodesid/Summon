import { ActivityIndicator, Text, View } from 'react-native'
import { ellipsify } from '@/utils/ellipsify'
import React from 'react'
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo'
import { appStyles } from '@/constants/app-styles'
import { AccountFeatureGetBalance } from '@/features/account/account-feature-get-balance'
import { AccountFeatureSignMessage } from '@/features/account/account-feature-sign-message'
import { AccountFeatureSignTransaction } from '@/features/account/account-feature-sign-transaction'
import { AccountFeatureCreateWallet } from '@/features/account/account-feature-create-wallet'
import { AccountFeatureLogout } from '@/features/account/account-feature-logout'
import { AccountFeatureLogin } from '@/features/account/account-feature-login'

export function AccountFeatureIndex() {
  const { isReady, user } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const wallet = solana.wallets?.[0]
  const address = wallet?.address

  if (!isReady) {
    return (
      <View style={appStyles.stack}>
        <Text style={appStyles.title}>Account</Text>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={appStyles.stack}>
      <Text style={appStyles.title}>Account</Text>
      {user ? (
        <View style={appStyles.stack}>
          <View style={appStyles.card}>
            {address ? (
              <>
                <Text>Privy Solana wallet {ellipsify(address, 8)}</Text>
                <AccountFeatureGetBalance address={address} />
              </>
            ) : (
              <Text>Logged in — no Solana wallet yet</Text>
            )}
          </View>
          {!address ? <AccountFeatureCreateWallet /> : null}
          {address ? (
            <>
              <AccountFeatureSignMessage address={address} />
              <AccountFeatureSignTransaction address={address} />
            </>
          ) : null}
          <AccountFeatureLogout />
        </View>
      ) : (
        <AccountFeatureLogin />
      )}
    </View>
  )
}
