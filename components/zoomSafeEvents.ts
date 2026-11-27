import { events as createPointerEvents } from '@react-three/fiber';

/**
 * R3F pointer events that work under the site-wide 80% page zoom (style.css).
 * The default maths uses offsetX/offsetY against the canvas size, which no
 * longer line up once the page is zoomed, so raycasts miss. Screen-space
 * client coordinates against the canvas's on-screen rect always agree.
 */
export const zoomSafeEvents = (store: any) => {
  const base = createPointerEvents(store);
  return {
    ...base,
    compute(event: any, state: any) {
      const r = state.gl.domElement.getBoundingClientRect();
      state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
  };
};
