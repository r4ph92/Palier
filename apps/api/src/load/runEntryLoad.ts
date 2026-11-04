import { readMinimumAppVersion } from '../config/environment.ts';
import { connectToDatabase } from '../infrastructure/postgres/database.ts';
import { databaseUrlAllowedForSeeding } from '../seed/seedGuard.ts';
import { runEntryLoad } from './entryLoad.ts';
import { parseEntryLoadArguments } from './entryLoadArguments.ts';

// The app's version (apps/mobile/src/api/appUpdate.ts) unless the API asks for a higher minimum.
const APP_VERSION = '0.1.0';

const options = parseEntryLoadArguments(process.argv.slice(2), process.env);
const connection = connectToDatabase(databaseUrlAllowedForSeeding(process.env));
try {
  const appVersion = readMinimumAppVersion(process.env['MINIMUM_APP_VERSION']) ?? APP_VERSION;
  console.log(`${options.drivers} load-test drivers scan ${options.gateName} at once, against ${options.apiUrl.origin}.`);
  const report = await runEntryLoad({ database: connection.database, options, appVersion });
  console.log(`summary ${report.summary}`);
  console.log(`slowest answer: ${report.slowestMilliseconds} ms`);
  for (const failure of report.failures) {
    console.error(`FAILED: ${failure}`);
  }
  console.log(report.failures.length === 0 ? 'OK' : 'FAILED');
  process.exitCode = report.failures.length === 0 ? 0 : 1;
} finally {
  await connection.close();
}
