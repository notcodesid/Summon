import { Button } from 'react-native'
import React from 'react'
import { usePrivy } from '@privy-io/expo'

export function AccountFeatureLogout() {
  const { logout, user } = usePrivy()

  return <Button disabled={!user} title="Log out" onPress={() => logout()} />
}
