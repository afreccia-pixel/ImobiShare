/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import L from 'leaflet';

/**
 * Universal safety patch for Leaflet to prevent runtime crashes such as:
 * - Uncaught TypeError: Cannot read properties of undefined (reading '_leaflet_pos')
 * - Uncaught TypeError: Cannot set properties of undefined (setting '_leaflet_pos')
 * - Map container is already initialized
 *
 * This occurs in React StrictMode and fast unmount/remount transitions
 * when markers, popups, or tiles are detached while animations or event handlers
 * are executing.
 */
export function safePatchLeaflet(leafletInstance: typeof L = L): void {
  if (!leafletInstance || !leafletInstance.DomUtil) return;

  const domUtil = leafletInstance.DomUtil as unknown as {
    __safeLeafletPosPatched?: boolean;
    getPosition: (el: HTMLElement | null | undefined) => L.Point;
    setPosition: (el: HTMLElement | null | undefined, point: L.Point) => void;
  };

  if (!domUtil.__safeLeafletPosPatched) {
    domUtil.__safeLeafletPosPatched = true;

    // 1. Safe DomUtil.getPosition
    const originalGetPosition = domUtil.getPosition;
    domUtil.getPosition = function (el: any): L.Point {
      if (!el) {
        return leafletInstance.point ? leafletInstance.point(0, 0) : ({ x: 0, y: 0 } as unknown as L.Point);
      }
      try {
        if (originalGetPosition) {
          const pos = originalGetPosition.call(leafletInstance.DomUtil, el);
          if (pos) return pos;
        }
        return el._leaflet_pos || (leafletInstance.point ? leafletInstance.point(0, 0) : ({ x: 0, y: 0 } as unknown as L.Point));
      } catch {
        return (el && el._leaflet_pos) || (leafletInstance.point ? leafletInstance.point(0, 0) : ({ x: 0, y: 0 } as unknown as L.Point));
      }
    };

    // 2. Safe DomUtil.setPosition
    const originalSetPosition = domUtil.setPosition;
    domUtil.setPosition = function (el: any, point: any): void {
      if (!el) return;
      try {
        if (originalSetPosition) {
          originalSetPosition.call(leafletInstance.DomUtil, el, point);
        } else {
          el._leaflet_pos = point;
        }
      } catch {
        try {
          if (el) el._leaflet_pos = point;
        } catch {
          // ignore detached node mutation error
        }
      }
    };
  }

  // 3. Safe Map.prototype._getMapPanePos
  if (leafletInstance.Map && leafletInstance.Map.prototype) {
    const proto = leafletInstance.Map.prototype as any;
    if (proto._getMapPanePos && !proto.__safePanePosPatched) {
      proto.__safePanePosPatched = true;
      const origGetMapPanePos = proto._getMapPanePos;
      proto._getMapPanePos = function (this: L.Map) {
        try {
          if (!(this as any)._mapPane) {
            return leafletInstance.point ? leafletInstance.point(0, 0) : ({ x: 0, y: 0 } as unknown as L.Point);
          }
          return origGetMapPanePos.call(this) || (leafletInstance.point ? leafletInstance.point(0, 0) : ({ x: 0, y: 0 } as unknown as L.Point));
        } catch {
          return leafletInstance.point ? leafletInstance.point(0, 0) : ({ x: 0, y: 0 } as unknown as L.Point);
        }
      };
    }

    // 4. Safe Map.prototype.remove
    const originalMapRemove = leafletInstance.Map.prototype.remove;
    if (originalMapRemove && !proto.__safeRemovePatched) {
      proto.__safeRemovePatched = true;
      leafletInstance.Map.prototype.remove = function (this: L.Map) {
        try {
          // Stop any pending pan/zoom animations before removing
          if (typeof (this as any)._stop === 'function') {
            (this as any)._stop();
          }
          return originalMapRemove.call(this);
        } catch (err) {
          console.warn('[Leaflet] Suppressed error during map.remove():', err);
          return this;
        }
      };
    }
  }
}

// Global browser window listener to trap any detached Leaflet animation tick errors
if (typeof window !== 'undefined' && !(window as any).__safeLeafletWindowErrorPatched) {
  (window as any).__safeLeafletWindowErrorPatched = true;
  window.addEventListener(
    'error',
    (event) => {
      if (
        event?.message &&
        (event.message.includes('_leaflet_pos') ||
          event.message.includes('Map container is already initialized'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('[Leaflet Guard] Suppressed benign Leaflet position error:', event.message);
      }
    },
    true
  );
}

// Auto-run immediately upon module load
safePatchLeaflet(L);
