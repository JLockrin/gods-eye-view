import * as Cesium from 'cesium';
import { destinationPointDeg } from './model.js';
import { alprHazardColor, isFlockAlpr } from './records.js';
import {
  DIRECTION_CONE_M,
  DIRECTION_CONE_HALF_ANGLE_DEG,
  MARKER_SCALE_BY_DISTANCE,
} from './policy.js';

/**
 * Badge scale at a camera distance, matching Cesium's NearFarScalar for the
 * native badges (linear between near and far, clamped outside).
 * @param {number} distanceM Camera-to-marker distance.
 * @returns {number} Scale factor.
 */
export function markerScale(distanceM) {
  const [near, nearScale, far, farScale] = MARKER_SCALE_BY_DISTANCE;
  if (!Number.isFinite(distanceM) || distanceM <= near) return nearScale;
  if (distanceM >= far) return farScale;
  return (
    nearScale + ((distanceM - near) / (far - near)) * (farScale - nearScale)
  );
}

// Camera artwork originally contributed by Manjunath (@manjunath22466);
// hazard recolors keep the same silhouette for avoid-zone framing.
export const MARKER_IMAGE = new URL(
  './assets/alpr-marker-hazard.png',
  import.meta.url,
).href;
export const FLOCK_MARKER_IMAGE = new URL(
  './assets/alpr-marker-flock.png',
  import.meta.url,
).href;
export const SELECTED_IMAGE = new URL(
  './assets/alpr-marker-selected-hazard.png',
  import.meta.url,
).href;
export const BRACKETS_IMAGE = new URL(
  './assets/alpr-marker-brackets-hazard.png',
  import.meta.url,
).href;

/** Pick the hazard badge artwork for a record. */
export function alprMarkerImage(record, selected = false) {
  if (selected) return SELECTED_IMAGE;
  return isFlockAlpr(record) ? FLOCK_MARKER_IMAGE : MARKER_IMAGE;
}

/** Compact display label; selection identity always uses the full record id. */
export function alprDisplayId(record) {
  if (!Number.isSafeInteger(record.osmId)) return 'ALPR CAMERA';
  return `ALPR-${String(record.osmId).slice(-4).padStart(4, '0')}`;
}

/** Show only supplied metadata, with the actual source named for custom adapters. */
export function alprLabelDetails(record, source) {
  const sourceName =
    source.attribution?.name || source.label || 'Camera source';
  const details = [
    sourceName === 'OpenStreetMap'
      ? 'OSM MAPPED · COMMUNITY ALPR'
      : `Source: ${sourceName}`,
  ];
  if (isFlockAlpr(record)) details.push('FLOCK SAFETY');
  if (Number.isFinite(record.directionDeg))
    details.push(`DIRECTION ${Math.round(record.directionDeg)}°`);
  const equipment = [
    ...new Set(
      [record.manufacturer, record.operator, record.cameraType]
        .map((value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
  if (equipment.length) details.push(equipment.join(' · '));
  if (sourceName === 'OpenStreetMap') details.push('PUBLIC MAP DATA');
  return details;
}

/**
 * Illustrative bearing wedge, not measured field of view or operating range.
 * @param {object} record Camera record.
 * @param {number} [heightM] Apex height.
 * @param {function(number, number): (number|null)} [heightAt] Optional height
 *   for the two far corners (degrees lat, lon), so the wedge follows a slope
 *   instead of floating level from the apex; falls back to the apex height.
 * @returns {Array<Cesium.Cartesian3>|null} Apex, left and right corners.
 */
export function directionWedgePositions(record, heightM = 0, heightAt = null) {
  if (!Number.isFinite(record.directionDeg)) return null;
  const left = destinationPointDeg(
    record.latitude,
    record.longitude,
    record.directionDeg - DIRECTION_CONE_HALF_ANGLE_DEG,
    DIRECTION_CONE_M,
  );
  const right = destinationPointDeg(
    record.latitude,
    record.longitude,
    record.directionDeg + DIRECTION_CONE_HALF_ANGLE_DEG,
    DIRECTION_CONE_M,
  );
  const corner = (point) => {
    const height = heightAt?.(point.latitude, point.longitude);
    return Number.isFinite(height) ? height : heightM;
  };
  return [
    Cesium.Cartesian3.fromDegrees(record.longitude, record.latitude, heightM),
    Cesium.Cartesian3.fromDegrees(left.longitude, left.latitude, corner(left)),
    Cesium.Cartesian3.fromDegrees(
      right.longitude,
      right.latitude,
      corner(right),
    ),
  ];
}

/** Paint a hazard-red gradient wedge with a crisp V-shaped boundary. */
export function paintDirectionWedge(
  ctx,
  origin,
  left,
  right,
  selected,
  record,
) {
  const hex = alprHazardColor(record || {}, { selected });
  const rgb = hex
    .replace('#', '')
    .match(/.{2}/g)
    .map((part) => Number.parseInt(part, 16))
    .join(', ');
  const gradient = ctx.createLinearGradient(
    origin.x,
    origin.y,
    (left.x + right.x) / 2,
    (left.y + right.y) / 2,
  );
  const alpha = selected ? [0.85, 0.52, 0.24, 0.06] : [0.42, 0.26, 0.12, 0.03];
  [0, 0.36, 0.72, 1].forEach((stop, i) =>
    gradient.addColorStop(stop, `rgba(${rgb}, ${alpha[i]})`),
  );
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(origin.x, origin.y);
  ctx.lineTo(right.x, right.y);
  ctx.strokeStyle = `rgba(${rgb}, ${selected ? 0.98 : 0.8})`;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Reject transient tile/terrain samples outside plausible mapped ground heights. */
export function validAlprGroundHeight(height) {
  return Number.isFinite(height) && height >= -500 && height <= 10000;
}
