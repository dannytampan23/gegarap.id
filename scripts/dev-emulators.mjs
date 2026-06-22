// Launches the Firebase Emulators robustly on Windows.
//
// Fixes two Windows-specific gotchas so `npm run dev` "just works":
//
// 1. Java not on PATH. firebase-tools spawns `java` from PATH to run the
//    Firestore emulator. A freshly installed JDK isn't visible to terminals
//    opened before the install (stale PATH). We locate a JDK ourselves and
//    prepend its bin dir to the child's PATH so no terminal restart is needed.
//
// 2. Space in the temp path. JDK 16+ builds its NIO selector self-pipe as an
//    AF_UNIX socket under the OS temp dir. When that path contains a space
//    (e.g. "C:\Users\Lenovo X13\AppData\Local\Temp"), the AF_UNIX connect()
//    fails with "Unable to establish loopback connection" and the Firestore
//    (Java) emulator can't start. Pointing TEMP/TMP at a space-free directory
//    sidesteps it.
//
// Both are no-ops off Windows.
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, delimiter } from 'node:path';

const env = { ...process.env };

/** Find a JDK bin dir on Windows (JAVA_HOME first, then common install roots). */
function findJavaBin() {
  const candidates = [];
  if (env.JAVA_HOME) candidates.push(join(env.JAVA_HOME, 'bin'));

  const roots = [
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\Zulu',
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (/jdk/i.test(name)) candidates.push(join(root, name, 'bin'));
    }
  }
  // Prefer the highest version number (rough: lexical sort, newest last).
  candidates.sort();
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (existsSync(join(candidates[i], 'java.exe'))) return candidates[i];
  }
  return null;
}

if (process.platform === 'win32') {
  const tmp = 'C:\\firebase-emu-tmp';
  mkdirSync(tmp, { recursive: true });
  env.TEMP = tmp;
  env.TMP = tmp;

  const javaBin = findJavaBin();
  if (javaBin) {
    env.PATH = javaBin + delimiter + (env.PATH || '');
  } else {
    console.warn(
      '[dev:emulators] No JDK found. Install JDK 21+ (e.g. `winget install Microsoft.OpenJDK.21`) — the Firestore emulator needs Java.'
    );
  }
}

const args = [
  'emulators:start',
  '--import=./firebase-data',
  '--export-on-exit=./firebase-data',
];

// `shell: true` so the platform resolves the `firebase` bin (firebase.cmd on Windows).
const child = spawn('firebase', args, { stdio: 'inherit', env, shell: true });

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[dev:emulators] failed to launch firebase:', err);
  process.exit(1);
});
