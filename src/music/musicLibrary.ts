export interface MusicTrack {
  id: string;
  name: string;
  url: string;
  source: 'local';
}

export interface MusicLibraryStorage {
  load(): Promise<MusicTrack[]>;
  put(track: MusicTrack, blob: Blob): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  getBlob(id: string): Promise<Blob | undefined>;
}

interface StoredMusicTrack {
  id: string;
  name: string;
  blob: Blob;
}

const databaseName = 'douai-music-library';
const databaseVersion = 1;
const trackStoreName = 'tracks';

function createIndexedDbStorage(): MusicLibraryStorage {
  let databasePromise: Promise<IDBDatabase> | undefined;

  function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) return databasePromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('当前环境不支持音乐持久化存储'));
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(trackStoreName)) {
          database.createObjectStore(trackStoreName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error || new Error('无法打开音乐数据库'));
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error('音乐数据库正被其他窗口占用'));
      };
    });
    return databasePromise;
  }

  async function transact<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(trackStoreName, mode);
      const request = operation(transaction.objectStore(trackStoreName));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error('音乐数据库操作失败'));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('音乐数据库事务失败'));
      transaction.onabort = () => reject(transaction.error || new Error('音乐数据库事务已中止'));
    });
  }

  return {
    async load() {
      const records = await transact<StoredMusicTrack[]>('readonly', store => store.getAll());
      return records.map(({ id, name }) => ({ id, name, url: '', source: 'local' }));
    },
    async put(track, blob) {
      await transact<IDBValidKey>('readwrite', store => store.put({
        id: track.id,
        name: track.name,
        blob
      } satisfies StoredMusicTrack));
    },
    async delete(id) {
      await transact<undefined>('readwrite', store => store.delete(id));
    },
    async clear() {
      await transact<undefined>('readwrite', store => store.clear());
    },
    async getBlob(id) {
      const record = await transact<StoredMusicTrack | undefined>('readonly', store => store.get(id));
      return record?.blob;
    }
  };
}

export function createPersistentMusicLibrary(
  storage: MusicLibraryStorage = createIndexedDbStorage(),
  createObjectUrl: (blob: Blob) => string = blob => URL.createObjectURL(blob),
  revokeObjectUrl: (url: string) => void = url => URL.revokeObjectURL(url)
) {
  return {
    async load(): Promise<MusicTrack[]> {
      const storedTracks = await storage.load();
      const tracks: MusicTrack[] = [];
      for (const track of storedTracks) {
        if (track.url) {
          tracks.push(track);
          continue;
        }
        const blob = await storage.getBlob(track.id);
        if (!blob) continue;
        tracks.push({ ...track, url: createObjectUrl(blob) });
      }
      return tracks;
    },
    async add(file: File, url?: string): Promise<MusicTrack> {
      const track: MusicTrack = {
        id: `local-${crypto.randomUUID()}`,
        name: file.name,
        url: url || createObjectUrl(file),
        source: 'local'
      };
      try {
        await storage.put(track, file);
      } catch (error) {
        if (!url) revokeObjectUrl(track.url);
        throw error;
      }
      return track;
    },
    remove(id: string) {
      return storage.delete(id);
    },
    clear() {
      return storage.clear();
    }
  };
}

export function removeTrack(tracks: MusicTrack[], id: string): MusicTrack[] {
  return tracks.filter(track => track.id !== id);
}

export function createTrack(file: File, url: string): MusicTrack {
  return {
    id: `local-${crypto.randomUUID()}`,
    name: file.name,
    url,
    source: 'local'
  };
}
