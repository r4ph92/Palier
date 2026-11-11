import { File, Paths } from 'expo-file-system';
import type { OfflineWalkStore } from './OfflineWalkStore';
import { parseQueuedWalks } from './parseQueuedWalks';

// In the documents folder, so a walk kept offline outlives the app being killed (decision 024).
export function fileOfflineWalkStore(file: File = new File(Paths.document, 'offline-walks.json')): OfflineWalkStore {
  return {
    load: async () => (file.exists ? parseQueuedWalks(await file.text()) : []),
    save: (walks) => file.write(JSON.stringify(walks)),
  };
}
