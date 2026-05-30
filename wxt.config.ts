import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// https://wxt.dev/api/config.html
// Shared code lives at the project root (data/, lib/, nag/, state/, components/), so WXT's
// default `@` -> project-root alias resolves `@/data`, `@/lib`, etc. for both Vite and tsc.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'output',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Annoying-extension',
    description:
      'Your tasks, weaponized. A friendly-but-relentless to-do nagger that interrupts your doomscrolling until you actually get things done.',
    // storage: tasks/settings · alarms: random nag scheduling · sidePanel: the task board · tabs: read the active tab URL in the background
    permissions: ['storage', 'alarms', 'sidePanel', 'tabs'],
    // Content script can run anywhere (it stays inert until the background tells it to nag),
    // and the background needs to read the active tab's URL to decide when to nag.
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open Annoying-extension',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
