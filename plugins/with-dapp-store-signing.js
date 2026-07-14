const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins')

const MARKER = '// Summon dApp Store signing'

function withDappStoreSigning(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') {
      throw new Error('Summon dApp Store signing requires a Groovy app/build.gradle')
    }

    let source = result.modResults.contents
    if (source.includes(MARKER)) return result

    const signingValues = `${MARKER}
def dappStoreSigning = [
    storeFile: System.getenv('SUMMON_DAPPSTORE_STORE_FILE'),
    storePassword: System.getenv('SUMMON_DAPPSTORE_STORE_PASSWORD'),
    keyAlias: System.getenv('SUMMON_DAPPSTORE_KEY_ALIAS'),
    keyPassword: System.getenv('SUMMON_DAPPSTORE_KEY_PASSWORD'),
]
`
    source = source.replace(/^(def jscFlavor = .*\n)/m, `$1\n${signingValues}`)

    source = source.replace(
      /    signingConfigs \{\n        debug \{([\s\S]*?)        \}\n    \}/,
      `    signingConfigs {
        debug {$1        }
        dappStoreRelease {
            if (dappStoreSigning.storeFile) {
                storeFile file(dappStoreSigning.storeFile)
            }
            storePassword dappStoreSigning.storePassword ?: ''
            keyAlias dappStoreSigning.keyAlias ?: ''
            keyPassword dappStoreSigning.keyPassword ?: ''
        }
    }
    flavorDimensions "distribution"
    productFlavors {
        standard { dimension "distribution" }
        dappStore {
            dimension "distribution"
            if (System.getenv('EAS_BUILD') != 'true') {
                signingConfig signingConfigs.dappStoreRelease
            }
            ndk { abiFilters "arm64-v8a" }
        }
    }`,
    )

    source = source.replace(
      /            signingConfig signingConfigs\.debug\n(?=            def enableShrinkResources)/,
      '',
    )

    source += `
tasks.configureEach { task ->
    if (task.name.toLowerCase().contains('dappstorerelease')) {
        task.doFirst {
            def missing = dappStoreSigning.findAll { key, value -> !value }.keySet()
            def easBuild = System.getenv('EAS_BUILD') == 'true'
            if (!easBuild && !missing.isEmpty()) {
                throw new GradleException("Missing dApp Store signing environment variables: \${missing.join(', ')}")
            }
            if (!easBuild && !file(dappStoreSigning.storeFile).exists()) {
                throw new GradleException("dApp Store keystore not found: \${dappStoreSigning.storeFile}")
            }
        }
    }
}
`

    result.modResults.contents = source
    return result
  })
}

module.exports = createRunOncePlugin(withDappStoreSigning, 'with-dapp-store-signing', '1.0.0')
