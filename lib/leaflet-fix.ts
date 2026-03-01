import L from 'leaflet';

let patched = false;

/**
 * Patches Leaflet's Map._initContainer to handle already-initialized containers.
 *
 * React 18 Strict Mode (dev), Suspense, and Next.js route transitions can
 * re-attach refs to DOM elements that still carry a `_leaflet_id` from a
 * previous Leaflet map instance. The unpatched Leaflet throws
 * "Map container is already initialized." — this patch clears the stale
 * marker so the new map can initialise cleanly.
 */
export function patchLeafletContainer() {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const proto = ((L as any).Map).prototype;
  const original = proto._initContainer;

  proto._initContainer = function (id: any) {
    const container =
      typeof id === 'string' ? document.getElementById(id) : id;

    if (container && (container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
      container.innerHTML = '';
    }

    original.call(this, id);
  };
}
