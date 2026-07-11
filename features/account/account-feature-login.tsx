import React, { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { useLoginWithEmail } from '@privy-io/expo'
import { appStyles } from '@/constants/app-styles'

/**
 * Email OTP login via Privy. On success, Privy can auto-create a Solana
 * embedded wallet (see PrivyProvider config.embedded.solana.createOnLogin).
 */
export function AccountFeatureLogin() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const { sendCode, loginWithCode } = useLoginWithEmail()

  async function onSendCode() {
    try {
      setStatus(null)
      await sendCode({ email: email.trim() })
      setCodeSent(true)
      setStatus('Code sent — check your email')
    } catch (e) {
      setStatus(`Send failed: ${e}`)
    }
  }

  async function onLogin() {
    try {
      setStatus(null)
      await loginWithCode({ email: email.trim(), code: code.trim() })
      setStatus('Logged in')
    } catch (e) {
      setStatus(`Login failed: ${e}`)
    }
  }

  return (
    <View style={appStyles.stack}>
      <Text>Sign in with email (Privy embedded wallet)</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: '#d1d1d1',
          borderRadius: 4,
          padding: 10,
          backgroundColor: '#fff',
        }}
      />
      {codeSent ? (
        <>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            placeholder="OTP code"
            value={code}
            onChangeText={setCode}
            style={{
              borderWidth: 1,
              borderColor: '#d1d1d1',
              borderRadius: 4,
              padding: 10,
              backgroundColor: '#fff',
            }}
          />
          <Button title="Verify & log in" onPress={onLogin} />
        </>
      ) : (
        <Button title="Send code" onPress={onSendCode} disabled={!email.trim()} />
      )}
      {status ? <Text>{status}</Text> : null}
    </View>
  )
}
