import { File, Paths } from 'expo-file-system';

export interface LocationExplanationStore {
  wasAnswered(): Promise<boolean>;
  markAnswered(): Promise<void>;
}

// A file in the app sandbox goes with the app on uninstall, as iOS resets its permission prompts then; a keychain item would not.
// « Reset Location & Privacy » in iOS Settings resets the prompts without removing the file, so the explanation is not shown again after it.
export function fileLocationExplanationStore(file: File = new File(Paths.document, 'location-explanation-answered')): LocationExplanationStore {
  return {
    wasAnswered: () => Promise.resolve(file.exists),
    markAnswered: () => {
      file.create({ overwrite: true });
      return Promise.resolve();
    },
  };
}

// A write that failed still counts as answered until the app closes, wherever the screen is mounted again.
export function rememberingAnswer(store: LocationExplanationStore): LocationExplanationStore {
  let isAnsweredHere = false;
  return {
    wasAnswered: async () => isAnsweredHere || (await store.wasAnswered()),
    markAnswered: () => {
      isAnsweredHere = true;
      return store.markAnswered();
    },
  };
}
