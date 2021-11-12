import { Writable } from 'stream';
import { stdout } from 'process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ItemRecord } from './types';

async function count(fragment: string): Promise<number> {
  // gh api -X GET search/code -f q='\u{1f4a9}' --jq '.total_count' 
  const { stdout } = await promisify(execFile)('gh', ['api', '-X', 'GET', 'search/code', '-f', `q=${fragment}`, '--jq', '.total_count']);
  return parseInt(stdout);
}

function write(dest: Writable, item: ItemRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const jsonWithLF = JSON.stringify(item) + '\n';
    dest.write(jsonWithLF, 'utf8', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

(async () => {
  const now = new Date().toISOString();
  const fragments = ['💩', '\\u{1f4a9}'];
  for (const fragment of fragments) {
    const val = await count(fragment);
    const record: ItemRecord = {
      version: "v1",
      fragment,
      val,
      timestamp: now,
    };
    await write(stdout, record);
  }
})();
