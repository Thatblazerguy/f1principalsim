import { createRoot, Root } from 'react-dom/client';

let globalRoot: Root | null = null;

export function renderToAppRoot(appRoot: HTMLElement, element: React.ReactNode) {
  if (!globalRoot) {
    globalRoot = createRoot(appRoot);
  }
  // Ensure appRoot is visible in case we came from HubLayout
  appRoot.style.display = '';
  globalRoot.render(element);
}
