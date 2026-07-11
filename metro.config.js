// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

/**
 * Privy + some web3 packages need package-export tweaks.
 * @see https://docs.privy.io/basics/react-native/installation
 */
const resolveRequestWithPackageExports = (context, moduleName, platform) => {
  if (moduleName === 'isows') {
    const ctx = { ...context, unstable_enablePackageExports: false }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }

  if (moduleName.startsWith('zustand')) {
    const ctx = { ...context, unstable_enablePackageExports: false }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }

  if (moduleName === 'jose') {
    const ctx = { ...context, unstable_conditionNames: ['browser'] }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }

  return context.resolveRequest(context, moduleName, platform)
}

config.resolver.resolveRequest = resolveRequestWithPackageExports

module.exports = config
