// Polyfills must load before app code (Privy + @solana/web3.js)
import 'fast-text-encoding'
import 'react-native-get-random-values'
import { Buffer } from 'buffer'
global.Buffer = Buffer

import './polyfill'
import '@ethersproject/shims'
import 'expo-router/entry'
