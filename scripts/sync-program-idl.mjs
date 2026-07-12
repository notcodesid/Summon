import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'target/idl/summon.json')
const destination = resolve(root, 'features/summon/idl/summon.json')

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)
console.log(`Synced ${source} -> ${destination}`)
