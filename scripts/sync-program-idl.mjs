import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'target/idl/summon.json')
const destination = resolve(root, 'features/summon/idl/summon.json')

await mkdir(dirname(destination), { recursive: true })
const idl = JSON.parse(await readFile(source, 'utf8'))
const prettierConfig = (await resolveConfig(destination)) ?? {}
await writeFile(destination, await format(JSON.stringify(idl), { ...prettierConfig, filepath: destination }))
console.log(`Synced ${source} -> ${destination}`)
