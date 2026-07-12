import { StyleSheet, Text, View } from 'react-native'
import { AppIcon } from '@/components/summon/app-icon'
import { theme } from '@/constants/theme'
import type { SFSymbol } from 'expo-symbols'

export function EmptyState({ icon = 'tray', title, copy }: { icon?: SFSymbol; title: string; copy: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <AppIcon name={icon} size={28} color={theme.colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  copy: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
})
