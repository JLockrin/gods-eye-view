import * as Cesium from 'cesium';
import {
  COVERAGE_RADIUS_M,
  COVERAGE_DESATURATE,
  COVERAGE_GRADE_MIN_POINTS,
  ALPR_HEAT_COLOR,
  ALPR_FLOCK_COLOR,
} from './policy.js';
import { aggregateAlprHeatCells, isFlockAlpr } from './records.js';

/**
 * Fragment shader: desaturate the globe outside ALPR coverage, keep (and
 * slightly hazard-tint) color inside soft coverage blobs. The coverage
 * texture's red channel is the watched mask (0..1).
 */
export const ALPR_COVERAGE_GRADE_SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform sampler2D coverageTexture;
uniform float intensity;
uniform float time;
in vec2 v_textureCoordinates;

void main() {
  vec2 uv = v_textureCoordinates;
  vec4 color = texture(colorTexture, uv);
  float cover = texture(coverageTexture, uv).r;
  // Subtle watched pulse in dense coverage — restrained, not cartoonish.
  float pulse = 0.5 + 0.5 * sin(time * 1.6);
  float watched = cover * (0.92 + 0.08 * pulse);

  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 gray = vec3(luma * 0.92);
  vec3 outside = mix(color.rgb, gray, clamp(intensity, 0.0, 1.0));

  // Inside coverage: restore scene color and lean toward hazard red.
  vec3 hazard = vec3(
    min(1.0, color.r * 1.08 + 0.04 * watched),
    color.g * (1.0 - 0.12 * watched),
    color.b * (1.0 - 0.14 * watched)
  );
  vec3 inside = mix(color.rgb, hazard, 0.35 * watched);
  vec3 result = mix(outside, inside, clamp(watched, 0.0, 1.0));
  out_FragColor = vec4(result, color.a);
}
`;

/**
 * Screen-space radius in pixels for a ground influence of `radiusM` at the
 * given camera range. Pure so tests pin the falloff.
 * @param {number} radiusM Ground radius.
 * @param {number} rangeM Camera-to-ground range.
 * @param {number} viewportHeightPx Canvas height.
 * @returns {number} Pixel radius.
 */
export function coverageScreenRadiusPx(radiusM, rangeM, viewportHeightPx) {
  if (
    !Number.isFinite(radiusM) ||
    !Number.isFinite(rangeM) ||
    !Number.isFinite(viewportHeightPx) ||
    radiusM <= 0 ||
    rangeM <= 0 ||
    viewportHeightPx <= 0
  )
    return 0;
  // Approximate metres→pixels with a 40° vertical FOV: height spans ~0.73*range.
  const metresPerPx = (rangeM * 0.73) / viewportHeightPx;
  const px = radiusM / Math.max(metresPerPx, 0.5);
  // Keep blobs readable from orbital / city-edge zooms without flooding.
  return Math.min(Math.max(px, 18), viewportHeightPx * 0.35);
}

/**
 * Draw a soft coverage / danger-zone mask into a 2D canvas from projected
 * camera samples. Pure canvas side-effect helper for the grade texture.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {Array<{x:number, y:number, radiusPx:number, weight?:number, flock?:boolean}>} samples
 */
export function paintCoverageMask(ctx, width, height, samples) {
  ctx.clearRect(0, 0, width, height);
  if (!samples?.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const sample of samples) {
    if (
      !Number.isFinite(sample.x) ||
      !Number.isFinite(sample.y) ||
      !(sample.radiusPx > 0)
    )
      continue;
    const weight = Math.min(1, Math.max(0.15, sample.weight ?? 0.55));
    const gradient = ctx.createRadialGradient(
      sample.x,
      sample.y,
      0,
      sample.x,
      sample.y,
      sample.radiusPx,
    );
    // Flock clusters lean hotter; others stay a warning rose in the mask.
    const hot = sample.flock ? 1 : 0.82;
    gradient.addColorStop(0, `rgba(255, 0, 0, ${0.85 * weight * hot})`);
    gradient.addColorStop(0.45, `rgba(255, 0, 0, ${0.4 * weight * hot})`);
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sample.x, sample.y, sample.radiusPx, 0, Math.PI * 2);
    ctx.fill();
  }
  // Faint all-seeing-eye motif in the densest sample (low opacity).
  const densest = samples.reduce(
    (best, sample) =>
      (sample.weight ?? 0) > (best?.weight ?? -1) ? sample : best,
    null,
  );
  if (densest && (densest.weight ?? 0) >= 0.55 && densest.radiusPx >= 28) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(densest.x, densest.y);
    const s = Math.min(densest.radiusPx * 0.35, 36);
    ctx.globalAlpha = 0.14 + 0.06 * ((densest.weight ?? 0.55) - 0.55);
    ctx.strokeStyle = 'rgba(255, 220, 220, 0.9)';
    ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40, 0, 0, 0.55)';
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Own the coverage-grade post-process stage and its mask canvas. The layer
 * enables the grade only while ALPR is on and enough coverage samples exist,
 * so an empty / zoom-out view never paints the whole planet muddy gray.
 */
export function createAlprCoverageGrade({
  createStage = (options) => new Cesium.PostProcessStage(options),
  now = () => performance.now(),
} = {}) {
  let viewer = null;
  let stage = null;
  let canvas = null;
  let ctx = null;
  let enabled = false;
  let lastSignature = '';

  function ensureCanvas(width, height) {
    if (typeof document === 'undefined') return null;
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 2));
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { alpha: true });
    }
    if (!ctx) return null;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { width: w, height: h, scaleX: w / width, scaleY: h / height };
  }

  function ensureStage() {
    if (
      stage ||
      !viewer?.scene?.postProcessStages ||
      typeof document === 'undefined'
    )
      return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      ctx = canvas.getContext('2d', { alpha: true });
    }
    stage = createStage({
      name: 'godsEyeView_alprCoverageGrade',
      fragmentShader: ALPR_COVERAGE_GRADE_SHADER,
      uniforms: {
        intensity: COVERAGE_DESATURATE,
        time: 0,
        coverageTexture: () => canvas,
      },
    });
    stage.enabled = false;
    viewer.scene.postProcessStages.add(stage);
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    if (!enabled) {
      if (stage) stage.enabled = false;
      lastSignature = '';
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ensureStage();
  }

  /** Advance the subtle watched pulse without rebuilding the mask. */
  function tick() {
    if (!enabled || !stage?.enabled) return;
    if (stage.uniforms?.time !== undefined) stage.uniforms.time = now() / 1000;
  }

  /**
   * Rebuild the mask from records currently in view and sync the stage.
   * @param {object} options
   * @param {Array<object>} options.records Visible camera records.
   * @param {Array<object>} [options.heatCells] Pre-aggregated heat cells.
   * @param {Cesium.Viewer} options.viewerArg Active viewer.
   */
  function sync({ records = [], heatCells = null, viewerArg = viewer } = {}) {
    viewer = viewerArg || viewer;
    if (!enabled || !viewer?.scene) {
      if (stage) stage.enabled = false;
      return;
    }
    ensureStage();
    const scene = viewer.scene;
    const canvasEl = scene.canvas;
    const width = canvasEl?.clientWidth || canvasEl?.width || 0;
    const height = canvasEl?.clientHeight || canvasEl?.height || 0;
    const camera = viewer.camera;
    if (!width || !height || !camera?.positionWC || !stage) {
      if (stage) stage.enabled = false;
      return;
    }
    const focus = camera.pickEllipsoid?.(
      new Cesium.Cartesian2(width / 2, height / 2),
      scene.globe.ellipsoid,
    );
    const range = focus
      ? Cesium.Cartesian3.distance(camera.positionWC, focus)
      : Cesium.Cartesian3.magnitude(camera.positionWC);
    const cells = heatCells || aggregateAlprHeatCells(records);
    const surface = ensureCanvas(width, height);
    if (!surface || !stage) {
      if (stage) stage.enabled = false;
      return;
    }
    const occluder = new Cesium.EllipsoidalOccluder(
      Cesium.Ellipsoid.WGS84,
      camera.positionWC,
    );
    const samples = [];
    const sources =
      cells.length > 0
        ? cells.map((cell) => ({
            latitude: cell.latitude,
            longitude: cell.longitude,
            radiusM: cell.radiusM,
            weight: cell.intensity,
            flock: cell.flockCount > 0,
          }))
        : records.map((record) => ({
            latitude: record.latitude,
            longitude: record.longitude,
            radiusM: COVERAGE_RADIUS_M,
            weight: isFlockAlpr(record) ? 0.7 : 0.45,
            flock: isFlockAlpr(record),
          }));
    for (const source of sources) {
      const position = Cesium.Cartesian3.fromDegrees(
        source.longitude,
        source.latitude,
        0,
      );
      if (!occluder.isPointVisible(position)) continue;
      const windowPos = Cesium.SceneTransforms.worldToWindowCoordinates(
        scene,
        position,
      );
      if (!windowPos) continue;
      const radiusPx = coverageScreenRadiusPx(source.radiusM, range, height);
      samples.push({
        x: windowPos.x * surface.scaleX,
        y: windowPos.y * surface.scaleY,
        radiusPx: radiusPx * surface.scaleX,
        weight: source.weight,
        flock: source.flock,
      });
    }
    const signature = `${surface.width}x${surface.height}:${samples.length}:${records.length}`;
    if (signature !== lastSignature) {
      paintCoverageMask(ctx, surface.width, surface.height, samples);
      lastSignature = signature;
    }
    const active = samples.length >= COVERAGE_GRADE_MIN_POINTS;
    stage.enabled = active;
    if (stage.uniforms?.time !== undefined) stage.uniforms.time = now() / 1000;
    if (stage.uniforms?.intensity !== undefined)
      stage.uniforms.intensity = COVERAGE_DESATURATE;
  }

  function destroy() {
    setEnabled(false);
    if (stage && viewer?.scene?.postProcessStages) {
      viewer.scene.postProcessStages.remove(stage);
    }
    stage = null;
    canvas = null;
    ctx = null;
    viewer = null;
  }

  /**
   * Upsert ground danger-zone ellipses for heat cells into a data source.
   * @param {Cesium.CustomDataSource} dataSource
   * @param {Array<object>} heatCells
   */
  function renderHeatEntities(dataSource, heatCells) {
    if (!dataSource) return;
    const keep = new Set(heatCells.map((cell) => cell.id));
    for (const entity of [...dataSource.entities.values]) {
      if (
        typeof entity.id === 'string' &&
        entity.id.startsWith('alpr-heat:') &&
        !keep.has(entity.id)
      )
        dataSource.entities.remove(entity);
    }
    const base = Cesium.Color.fromCssColorString(ALPR_HEAT_COLOR);
    const flock = Cesium.Color.fromCssColorString(ALPR_FLOCK_COLOR);
    for (const cell of heatCells) {
      const color = (cell.flockCount > 0 ? flock : base).withAlpha(
        0.1 + cell.intensity * 0.28,
      );
      const outline = color.withAlpha(
        Math.min(0.55, 0.18 + cell.intensity * 0.35),
      );
      let entity = dataSource.entities.getById(cell.id);
      if (!entity) {
        entity = dataSource.entities.add({
          id: cell.id,
          position: Cesium.Cartesian3.fromDegrees(
            cell.longitude,
            cell.latitude,
            0,
          ),
          ellipse: {
            semiMajorAxis: cell.radiusM,
            semiMinorAxis: cell.radiusM,
            material: color,
            outline: true,
            outlineColor: outline,
            outlineWidth: 1,
            height: 0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            classificationType: Cesium.ClassificationType.BOTH,
          },
        });
        entity.gevAlprHeat = true;
      } else {
        entity.position = Cesium.Cartesian3.fromDegrees(
          cell.longitude,
          cell.latitude,
          0,
        );
        entity.ellipse.semiMajorAxis = cell.radiusM;
        entity.ellipse.semiMinorAxis = cell.radiusM;
        entity.ellipse.material = color;
        entity.ellipse.outlineColor = outline;
      }
    }
  }

  return {
    setEnabled,
    sync,
    tick,
    destroy,
    renderHeatEntities,
    /** Test seam */
    _canvas: () => canvas,
    _stage: () => stage,
  };
}

export { aggregateAlprHeatCells };
