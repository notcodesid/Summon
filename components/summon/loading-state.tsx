import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { theme } from '@/constants/theme'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={theme.colors.text} />
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
})
