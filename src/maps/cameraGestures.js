import * as Cesium from 'cesium';

const PHOTOREAL_STACK_ID = 'photoreal';

function asEventTypeList(value) {
  if (Array.isArray(value)) return [...value];
  if (value === undefined || value === null) return [];
  return [value];
}

/** True for unmodified right-drag (not Ctrl/Shift-qualified bindings). */
export function isPlainRightDrag(binding) {
  if (binding === Cesium.CameraEventType.RIGHT_DRAG) return true;
  return (
    binding?.eventType === Cesium.CameraEventType.RIGHT_DRAG &&
    (binding.modifier === undefined || binding.modifier === null)
  );
}

/**
 * Build zoom/tilt bindings for the active map stack.
 *
 * Cesium's default RIGHT_DRAG is zoom. Near the ground, LEFT_DRAG already pans
 * through spin3D, so operators get no orbit from either button. Photorealistic
 * Google 3D rebinds plain right-drag onto tilt (Cesium's orbit-around-pick
 * path): drag right yaws via rotateRight with a negative delta in the local
 * ENU frame — the conventional 3D-orbit direction. Wheel/pinch zoom and
 * left-drag stay on their existing bindings. Other stacks keep Cesium's
 * baseline (right-drag zoom).
 */
export function mapStackCameraGestureBindings(stackId, baseline = {}) {
  const zoom = asEventTypeList(baseline.zoomEventTypes);
  const tilt = asEventTypeList(baseline.tiltEventTypes);
  if (stackId !== PHOTOREAL_STACK_ID) {
    return { zoomEventTypes: zoom, tiltEventTypes: tilt };
  }
  const photorealZoom = zoom.filter((binding) => !isPlainRightDrag(binding));
  const photorealTilt = tilt.filter((binding) => !isPlainRightDrag(binding));
  if (!photorealTilt.some(isPlainRightDrag)) {
    photorealTilt.push(Cesium.CameraEventType.RIGHT_DRAG);
  }
  return {
    zoomEventTypes: photorealZoom,
    tiltEventTypes: photorealTilt,
  };
}

/** Apply zoom/tilt event bindings for one map-stack id. */
export function applyMapStackCameraGestures(controller, stackId, baseline) {
  if (!controller) throw new TypeError('screenSpaceCameraController required');
  const next = mapStackCameraGestureBindings(stackId, baseline);
  controller.zoomEventTypes = next.zoomEventTypes;
  controller.tiltEventTypes = next.tiltEventTypes;
  return next;
}

/**
 * Keep Cesium camera mouse bindings in sync with the active map stack.
 * Capture baselines after trackpad pinch zoom has augmented zoomEventTypes.
 * @returns {() => void} disposer that unsubscribes and restores baselines
 */
export function installMapStackCameraGestures(viewer, mapStackController) {
  const controller = viewer?.scene?.screenSpaceCameraController;
  if (!controller || !mapStackController) {
    throw new TypeError(
      'viewer.scene.screenSpaceCameraController and mapStackController required',
    );
  }
  const baseline = {
    zoomEventTypes: asEventTypeList(controller.zoomEventTypes),
    tiltEventTypes: asEventTypeList(controller.tiltEventTypes),
  };
  const sync = (stackId) =>
    applyMapStackCameraGestures(controller, stackId, baseline);
  sync(mapStackController.getActiveId?.());
  const unsubscribe = mapStackController.subscribe?.((state) => {
    sync(state?.activeId);
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (typeof unsubscribe === 'function') unsubscribe();
    controller.zoomEventTypes = [...baseline.zoomEventTypes];
    controller.tiltEventTypes = [...baseline.tiltEventTypes];
  };
}
