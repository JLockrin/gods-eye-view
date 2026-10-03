#!/usr/bin/env node
/**
 * Headless check: with photoreal camera gestures applied, a right-button
 * horizontal drag changes camera heading in the conventional orbit direction.
 * Left-drag rotate bindings and wheel zoom bindings remain present.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import {
  applyMapStackCameraGestures,
  isPlainRightDrag,
} from '../src/maps/cameraGestures.js';
import * as CesiumNode from 'cesium';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cesiumBuild = path.join(root, 'node_modules/cesium/Build/Cesium');

const html = `<!doctype html>
<html><head>
  <link rel="stylesheet" href="/cesium/Widgets/widgets.css">
  <style>html,body,#c{margin:0;width:100%;height:100%;overflow:hidden}</style>
</head><body>
  <div id="c"></div>
  <script src="/cesium/Cesium.js"></script>
  <script>
    window.__ready = (async () => {
      Cesium.Ion.defaultAccessToken = undefined;
      const viewer = new Cesium.Viewer('c', {
        timeline: false, animation: false, baseLayerPicker: false,
        geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, fullscreenButton: false,
        imageryProvider: false, baseLayer: false,
      });
      viewer.scene.globe.show = true;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 800),
        orientation: {
          heading: Cesium.Math.toRadians(10),
          pitch: Cesium.Math.toRadians(-35),
          roll: 0,
        },
      });
      // Force a known transform-identity city view so tilt uses terrain/ellipsoid orbit.
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
      window.__viewer = viewer;
      return true;
    })();
  </script>
</body></html>`;

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg'))
    return 'image/jpeg';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  if (req.url.startsWith('/cesium/')) {
    const rel = decodeURIComponent(req.url.slice('/cesium/'.length));
    const filePath = path.normalize(path.join(cesiumBuild, rel));
    if (!filePath.startsWith(cesiumBuild) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  res.writeHead(404);
  res.end('missing');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

let failures = 0;
const check = (name, ok, detail) => {
  console.log(
    `[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`,
  );
  if (!ok) failures++;
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.goto(`http://127.0.0.1:${port}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => window.__viewer, { timeout: 60000 });

  const before = await page.evaluate(() => {
    const c = window.__viewer.scene.screenSpaceCameraController;
    return {
      zoom: c.zoomEventTypes,
      tilt: c.tiltEventTypes,
      rotate: c.rotateEventTypes,
      heading: window.__viewer.camera.heading,
    };
  });

  // Apply the same binding transform the app uses for photoreal.
  const baseline = {
    zoomEventTypes: before.zoom,
    tiltEventTypes: before.tilt,
  };
  // Reconstruct enums from numeric values returned through the bridge.
  const toBinding = (value) => {
    if (value && typeof value === 'object' && 'eventType' in value) {
      return {
        eventType: value.eventType,
        modifier: value.modifier,
      };
    }
    return value;
  };
  const nodeBaseline = {
    zoomEventTypes: baseline.zoomEventTypes.map(toBinding),
    tiltEventTypes: baseline.tiltEventTypes.map(toBinding),
  };
  const fakeController = {
    zoomEventTypes: [...nodeBaseline.zoomEventTypes],
    tiltEventTypes: [...nodeBaseline.tiltEventTypes],
  };
  applyMapStackCameraGestures(fakeController, 'photoreal', nodeBaseline);
  check(
    'photoreal zoom drops plain right-drag',
    !fakeController.zoomEventTypes.some(isPlainRightDrag),
  );
  check(
    'photoreal tilt gains plain right-drag',
    fakeController.tiltEventTypes.some(isPlainRightDrag),
  );
  check(
    'baseline still had right-drag zoom (Cesium default)',
    nodeBaseline.zoomEventTypes.some(isPlainRightDrag),
  );

  await page.evaluate(
    (zoomEventTypes, tiltEventTypes) => {
      const c = window.__viewer.scene.screenSpaceCameraController;
      c.zoomEventTypes = zoomEventTypes;
      c.tiltEventTypes = tiltEventTypes;
    },
    fakeController.zoomEventTypes,
    fakeController.tiltEventTypes,
  );

  const headingBefore = await page.evaluate(
    () => window.__viewer.camera.heading,
  );

  // Right-button drag to the right across the canvas center.
  const box = await page.evaluate(() => {
    const canvas = window.__viewer.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + 160, box.y, { steps: 12 });
  // Keep the drag long enough for Cesium's aggregator + preRender to consume it.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const viewer = window.__viewer;
        let frames = 0;
        const remove = viewer.scene.preRender.addEventListener(() => {
          frames += 1;
          if (frames >= 8) {
            remove();
            resolve();
          }
        });
        viewer.scene.requestRender();
      }),
  );
  await page.mouse.up({ button: 'right' });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );

  const headingAfter = await page.evaluate(
    () => window.__viewer.camera.heading,
  );
  const delta = headingAfter - headingBefore;
  // Normalize to [-PI, PI]
  const norm =
    ((((delta + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
    Math.PI;
  check(
    'right-drag changed heading',
    Math.abs(norm) > 1e-4,
    `deltaRad=${norm}`,
  );
  // Conventional orbit: drag right → rotateRight(negative) in ENU → heading increases
  // in Cesium (clockwise from north). Accept either documented sign if absolute motion
  // is clearly non-zero; prefer positive heading change.
  check(
    'right-drag yaws with drag (heading increases)',
    norm > 0,
    `deltaRad=${norm}`,
  );

  const leftStillRotate = await page.evaluate(() => {
    const c = window.__viewer.scene.screenSpaceCameraController;
    const rotate = c.rotateEventTypes;
    const list = Array.isArray(rotate) ? rotate : [rotate];
    return list.includes(Cesium.CameraEventType.LEFT_DRAG);
  });
  check('left-drag remains the rotate binding', leftStillRotate);

  const wheelStillZoom = await page.evaluate(() => {
    const c = window.__viewer.scene.screenSpaceCameraController;
    const zoom = Array.isArray(c.zoomEventTypes)
      ? c.zoomEventTypes
      : [c.zoomEventTypes];
    return zoom.includes(Cesium.CameraEventType.WHEEL);
  });
  check('wheel remains a zoom binding', wheelStillZoom);

  // Restore non-photoreal and confirm right-drag returns to zoom list.
  applyMapStackCameraGestures(fakeController, 'osm', nodeBaseline);
  check(
    'osm restores right-drag zoom',
    fakeController.zoomEventTypes.some(isPlainRightDrag),
  );
} finally {
  await browser.close();
  server.close();
}

if (failures) {
  console.error(`\n${failures} verification check(s) failed`);
  process.exit(1);
}
console.log('\nRight-drag orbit verification passed');
