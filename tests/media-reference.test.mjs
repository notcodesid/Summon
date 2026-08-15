import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCutoutMediaReference,
  normalizePhotoMediaReference,
  refreshRemoteCutoutUri,
  refreshRemotePhotoUri,
  resolvePhotoMediaUri,
} from '../lib/media-reference.ts'

test('migrates a legacy local creature photo into localPhotoUri', () => {
  assert.deepEqual(
    normalizePhotoMediaReference({
      photoUri: 'file:///app/Documents/captures/cat.jpg',
    }),
    {
      photoUri: 'file:///app/Documents/captures/cat.jpg',
      localPhotoUri: 'file:///app/Documents/captures/cat.jpg',
    },
  )
})

test('migrates a legacy signed URL into remotePhotoUri', () => {
  const signed = 'https://example.test/storage/v1/object/sign/creature-photos/cat.jpg?token=short-lived'
  assert.deepEqual(normalizePhotoMediaReference({ photoUri: signed }), {
    photoUri: signed,
    remotePhotoUri: signed,
  })
})

test('refreshes a signed URL without overwriting the durable local reference', () => {
  const refreshed = refreshRemotePhotoUri(
    {
      photoUri: 'file:///app/Documents/captures/cat.jpg',
      localPhotoUri: 'file:///app/Documents/captures/cat.jpg',
      remotePhotoUri: 'https://example.test/cat.jpg?token=old',
    },
    'https://example.test/cat.jpg?token=new',
  )

  assert.deepEqual(refreshed, {
    photoUri: 'file:///app/Documents/captures/cat.jpg',
    localPhotoUri: 'file:///app/Documents/captures/cat.jpg',
    remotePhotoUri: 'https://example.test/cat.jpg?token=new',
  })
})

test('offline rendering prefers the durable local file', () => {
  assert.equal(
    resolvePhotoMediaUri({
      photoUri: '',
      localPhotoUri: 'file:///app/Documents/captures/owl.jpg',
      remotePhotoUri: 'https://example.test/owl.jpg?token=expired',
    }),
    'file:///app/Documents/captures/owl.jpg',
  )
})

test('a new device renders the refreshed remote URL without a local copy', () => {
  const remotePhotoUri = 'https://example.test/fox.jpg?token=fresh'
  assert.equal(
    resolvePhotoMediaUri({
      photoUri: remotePhotoUri,
      remotePhotoUri,
    }),
    remotePhotoUri,
  )
})

test('avatar v1 string caches migrate and later retain local media on refresh', () => {
  const legacy = normalizePhotoMediaReference('https://example.test/profile.jpg?token=old')
  const withLocal = normalizePhotoMediaReference({
    ...legacy,
    localPhotoUri: 'file:///app/Documents/profile-photos/user.image',
  })
  const refreshed = refreshRemotePhotoUri(withLocal, 'https://example.test/profile.jpg?token=new')

  assert.equal(refreshed.localPhotoUri, 'file:///app/Documents/profile-photos/user.image')
  assert.equal(refreshed.remotePhotoUri, 'https://example.test/profile.jpg?token=new')
  assert.equal(refreshed.photoUri, refreshed.localPhotoUri)
})

test('normalizes and refreshes creature cutout references', () => {
  const localCutout = normalizeCutoutMediaReference({
    cutoutUri: 'file:///app/Documents/cutouts/fox.png',
  })
  assert.deepEqual(localCutout, {
    cutoutUri: 'file:///app/Documents/cutouts/fox.png',
    localCutoutUri: 'file:///app/Documents/cutouts/fox.png',
  })

  const refreshed = refreshRemoteCutoutUri(localCutout, 'https://example.test/fox_cutout.png?token=signed')
  assert.deepEqual(refreshed, {
    cutoutUri: 'file:///app/Documents/cutouts/fox.png',
    localCutoutUri: 'file:///app/Documents/cutouts/fox.png',
    remoteCutoutUri: 'https://example.test/fox_cutout.png?token=signed',
  })
})

