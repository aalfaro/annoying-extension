// Runs on every page (inert until the background sends a nag). Mounts the React overlay
// into a Shadow DOM so the host page's CSS can never break — or detect — our UI.
import './style.css';
import ReactDOM from 'react-dom/client';
import { NagOverlay } from '@/components/overlay/NagOverlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'annoying-extension-overlay',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const wrapper = document.createElement('div');
        container.append(wrapper);
        const root = ReactDOM.createRoot(wrapper);
        root.render(<NagOverlay />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
