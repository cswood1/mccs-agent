/**
 * Land shapes for the Explore globe, bundled locally (no runtime fetches from outside sites).
 *
 *   node scripts/build-globe-data.mjs
 *
 * Reads world-atlas (npm) countries at 1:110m, converts TopoJSON to GeoJSON, drops Antarctica (it only
 * adds dots at the bottom of the globe), rounds coordinates, and writes public/globe/countries.geojson.
 * Degenerate polygons (fewer than 3 distinct points, e.g. a speck of North Korea in world-atlas) are
 * dropped, and every polygon is checked with h3-js (what globe.gl's dotted land uses), because one bad
 * polygon throws inside the globe at runtime.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { polygonToCells } from "h3-js";
import { feature } from "topojson-client";

const root = process.cwd();
const topo = JSON.parse(readFileSync(path.join(root, "node_modules/world-atlas/countries-110m.json"), "utf8"));
const geo = feature(topo, topo.objects.countries);
const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));
const dropped = [];
const usable = (polygon, id) => {
  const distinct = new Set(polygon[0].map((p) => p.join(","))).size;
  let ok = distinct >= 3;
  if (ok) {
    try {
      polygonToCells(polygon, 3, true);
    } catch {
      ok = false;
    }
  }
  if (!ok) dropped.push(id);
  return ok;
};
geo.features = geo.features
  .filter((f) => f.id !== "010") // Antarctica
  .map((f) => {
    const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map(round).filter((p) => usable(p, f.id));
    return { type: "Feature", id: f.id, properties: {}, geometry: { type: "MultiPolygon", coordinates: polygons } };
  })
  .filter((f) => f.geometry.coordinates.length);
mkdirSync(path.join(root, "public/globe"), { recursive: true });
const out = JSON.stringify(geo);
writeFileSync(path.join(root, "public/globe/countries.geojson"), out);
console.log(`${geo.features.length} countries, ${Math.round(out.length / 1024)} KB; dropped ${dropped.length} degenerate polygon(s): ${dropped.join(", ") || "none"}`);
