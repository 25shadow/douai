import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrack, removeTrack, createPersistentMusicLibrary } from '../musicLibrary.ts';

test('removes a track without mutating the original list', () => {
  const tracks = [
    { id: 'local-1', name: 'one.mp3', url: 'blob:one', source: 'local' as const },
    { id: 'local-2', name: 'two.mp3', url: 'blob:two', source: 'local' as const }
  ];
  const next = removeTrack(tracks, tracks[0].id);

  assert.equal(next.length, tracks.length - 1);
  assert.equal(tracks.length, 2);
});

test('creates a local track from an audio file', () => {
  const file = new File(['audio'], 'my-song.mp3', { type: 'audio/mpeg' });
  const track = createTrack(file, 'blob:my-song');

  assert.equal(track.name, 'my-song.mp3');
  assert.equal(track.source, 'local');
  assert.equal(track.url, 'blob:my-song');
});

test('persists imported tracks and does not return deleted tracks', async () => {
  const files = new Map<string, { track: ReturnType<typeof createTrack>; blob: Blob }>();
  const library = createPersistentMusicLibrary({
    async load() { return [...files.values()].map(item => item.track); },
    async put(track, blob) { files.set(track.id, { track, blob }); },
    async delete(id) { files.delete(id); },
    async clear() { files.clear(); },
    async getBlob(id) { return files.get(id)?.blob; }
  });
  const file = new File(['audio'], 'persisted.mp3', { type: 'audio/mpeg' });
  const track = await library.add(file, 'blob:persisted');
  assert.equal((await library.load())[0].name, 'persisted.mp3');
  await library.remove(track.id);
  assert.deepEqual(await library.load(), []);
});

test('loads stored blobs into fresh playback URLs and clears all imported tracks', async () => {
  const blobs = new Map<string, Blob>();
  const metadata = new Map<string, { id: string; name: string; url: string; source: 'local' }>();
  let urlSequence = 0;
  const storage = {
    async load() { return [...metadata.values()]; },
    async put(track: ReturnType<typeof createTrack>, blob: Blob) {
      metadata.set(track.id, { ...track, url: '' });
      blobs.set(track.id, blob);
    },
    async delete(id: string) { metadata.delete(id); blobs.delete(id); },
    async clear() { metadata.clear(); blobs.clear(); },
    async getBlob(id: string) { return blobs.get(id); }
  };
  const library = createPersistentMusicLibrary(storage, () => `blob:restored-${++urlSequence}`);
  const file = new File(['audio'], 'restored.mp3', { type: 'audio/mpeg' });
  const created = await library.add(file);
  const restored = await createPersistentMusicLibrary(storage, () => `blob:restored-${++urlSequence}`).load();
  assert.equal(restored[0]?.id, created.id);
  assert.equal(restored[0]?.url, 'blob:restored-2');
  await library.clear();
  assert.deepEqual(await library.load(), []);
});
