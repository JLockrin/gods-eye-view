import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  applyMapStackCameraGestures,
  installMapStackCameraGestures,
  isPlainRightDrag,
  mapStackCameraGestureBindings,
} from './cameraGestures.js';

const RIGHT_DRAG = Cesium.CameraEventType.RIGHT_DRAG;
const LEFT_DRAG = Cesium.CameraEventType.LEFT_DRAG;
const MIDDLE_DRAG = Cesium.CameraEventType.MIDDLE_DRAG;
const WHEEL = Cesium.CameraEventType.WHEEL;
const PINCH = Cesium.CameraEventType.PINCH;
const CTRL = Cesium.KeyboardEventModifier.CTRL;

/** Cesium defaults plus the trackpad Ctrl+wheel binding the app installs. */
function cesiumBaselinePlusPinch() {
  return {
    zoomEventTypes: [
      RIGHT_DRAG,
      WHEEL,
      PINCH,
      { eventType: WHEEL, modifier: CTRL },
    ],
    tiltEventTypes: [
      MIDDLE_DRAG,
      PINCH,
      { eventType: LEFT_DRAG, modifier: CTRL },
      { eventType: RIGHT_DRAG, modifier: CTRL },
    ],
    rotateEventTypes: LEFT_DRAG,
  };
}

test('plain right-drag matches only the unmodified binding', () => {
  assert.equal(isPlainRightDrag(RIGHT_DRAG), true);
  assert.equal(isPlainRightDrag({ eventType: RIGHT_DRAG }), true);
  assert.equal(
    isPlainRightDrag({ eventType: RIGHT_DRAG, modifier: CTRL }),
    false,
  );
  assert.equal(isPlainRightDrag(WHEEL), false);
});

test('photoreal moves plain right-drag from zoom onto tilt (orbit)', () => {
  const baseline = cesiumBaselinePlusPinch();
  const next = mapStackCameraGestureBindings('photoreal', baseline);
  assert.ok(
    !next.zoomEventTypes.some(isPlainRightDrag),
    'right-drag must not zoom in Google 3D',
  );
  assert.ok(next.zoomEventTypes.includes(WHEEL), 'scroll zoom stays available');
  assert.ok(next.zoomEventTypes.includes(PINCH), 'pinch zoom stays available');
  assert.ok(
    next.zoomEventTypes.some(
      (binding) => binding?.eventType === WHEEL && binding?.modifier === CTRL,
    ),
    'trackpad Ctrl+wheel pinch binding is preserved',
  );
  assert.ok(
    next.tiltEventTypes.some(isPlainRightDrag),
    'right-drag orbits via Cesium tilt',
  );
  assert.ok(
    next.tiltEventTypes.some(
      (binding) =>
        binding?.eventType === RIGHT_DRAG && binding?.modifier === CTRL,
    ),
    'Ctrl+right-drag tilt remains',
  );
  assert.equal(
    baseline.rotateEventTypes,
    LEFT_DRAG,
    'left-drag rotate binding is not part of this remap',
  );
});

test('non-photoreal stacks keep Cesium right-drag zoom', () => {
  const baseline = cesiumBaselinePlusPinch();
  for (const stackId of ['osm', 'esri-imagery', 'bing-aerial', 'bing-labels']) {
    const next = mapStackCameraGestureBindings(stackId, baseline);
    assert.deepEqual(next.zoomEventTypes, baseline.zoomEventTypes, stackId);
    assert.deepEqual(next.tiltEventTypes, baseline.tiltEventTypes, stackId);
  }
});

test('applyMapStackCameraGestures writes only zoom and tilt lists', () => {
  const baseline = cesiumBaselinePlusPinch();
  const controller = {
    zoomEventTypes: [...baseline.zoomEventTypes],
    tiltEventTypes: [...baseline.tiltEventTypes],
    rotateEventTypes: LEFT_DRAG,
    lookEventTypes: {
      eventType: LEFT_DRAG,
      modifier: Cesium.KeyboardEventModifier.SHIFT,
    },
  };
  applyMapStackCameraGestures(controller, 'photoreal', baseline);
  assert.ok(!controller.zoomEventTypes.some(isPlainRightDrag));
  assert.ok(controller.tiltEventTypes.some(isPlainRightDrag));
  assert.equal(controller.rotateEventTypes, LEFT_DRAG);
  applyMapStackCameraGestures(controller, 'osm', baseline);
  assert.deepEqual(controller.zoomEventTypes, baseline.zoomEventTypes);
  assert.deepEqual(controller.tiltEventTypes, baseline.tiltEventTypes);
});

test('installMapStackCameraGestures syncs on subscribe and restores on dispose', () => {
  const baseline = cesiumBaselinePlusPinch();
  const controller = {
    zoomEventTypes: [...baseline.zoomEventTypes],
    tiltEventTypes: [...baseline.tiltEventTypes],
  };
  let listener = null;
  let activeId = 'photoreal';
  const mapStackController = {
    getActiveId: () => activeId,
    subscribe(fn) {
      listener = fn;
      return () => {
        listener = null;
      };
    },
  };
  const dispose = installMapStackCameraGestures(
    { scene: { screenSpaceCameraController: controller } },
    mapStackController,
  );
  assert.ok(
    controller.tiltEventTypes.some(isPlainRightDrag),
    'install applies the current photoreal stack',
  );
  activeId = 'osm';
  listener({ activeId });
  assert.ok(
    controller.zoomEventTypes.some(isPlainRightDrag),
    'leaving Google 3D restores right-drag zoom',
  );
  activeId = 'photoreal';
  listener({ activeId });
  assert.ok(!controller.zoomEventTypes.some(isPlainRightDrag));
  dispose();
  assert.deepEqual(controller.zoomEventTypes, baseline.zoomEventTypes);
  assert.deepEqual(controller.tiltEventTypes, baseline.tiltEventTypes);
  assert.equal(listener, null);
});

/**
 * Cesium tilt3D → rotate3D horizontal: phi ∝ (start.x - end.x), then
 * camera.rotateRight(deltaPhi). Dragging right makes start.x < end.x, so
 * deltaPhi is negative → rotateRight(negative) = yaw in the conventional
 * orbit direction (view turns with the drag).
 */
test('Cesium orbit math yaws with a rightward drag', () => {
  const startX = 100;
  const endX = 140;
  const phiWindowRatio = (startX - endX) / 800;
  assert.ok(phiWindowRatio < 0, 'drag right yields a negative phi ratio');
  const deltaPhi = 1 * phiWindowRatio * Math.PI * 2;
  assert.ok(
    deltaPhi < 0,
    'rotateRight receives a negative angle when dragging right',
  );
});
