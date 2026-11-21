"""Route tiles trial: Strava routes drawn over the club's LIDAR contours.

Reads the contour GeoPackages from the club Drive (Media > TOPO, OSGB36 /
British National Grid, 5 m interval) and each run's GPS line, and writes
src/data/routes-trial.json: for each route, an SVG viewBox, the contour paths
clipped to the tile and the route path, already projected, so the site needs
no mapping code at all.

Usage:
    python3 make_tiles.py <gpkg folder> <routes input json> <output json>
"""

import glob
import json
import math
import sqlite3
import struct
import sys

from pyproj import Transformer
from shapely import wkb
from shapely.geometry import LineString, box
from shapely.ops import transform as shp_transform  # noqa: the newer shapely.transform takes arrays, this takes a function

TILE_W, TILE_H = 400, 300     # SVG units; the page scales it
PAD = 0.12                    # breathing room round the route, as a share of the tile
TOLERANCE_PX = 0.6            # contour simplification, in SVG units


def gpkg_geom(blob):
    """GeoPackage geometry blob -> shapely geometry (header, then plain WKB)."""
    flags = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 0b111]
    return wkb.loads(bytes(blob[8 + env:]))


def load_contours(folder):
    """Every contour line, plus the extent the data covers (the union of tiles)."""
    lines = []
    extent = [math.inf, math.inf, -math.inf, -math.inf]
    for path in sorted(glob.glob(f"{folder}/*.gpkg")):
        con = sqlite3.connect(path)
        table, *bounds = con.execute(
            "select table_name, min_x, min_y, max_x, max_y from gpkg_contents").fetchone()
        extent = [min(extent[0], bounds[0]), min(extent[1], bounds[1]),
                  max(extent[2], bounds[2]), max(extent[3], bounds[3])]
        for geom, z in con.execute(f'select geom, "Z" from "{table}"'):
            g = gpkg_geom(geom)
            parts = g.geoms if g.geom_type.startswith("Multi") else [g]
            for p in parts:
                lines.append((p, z))
    return lines, extent


def path_d(coords):
    out = []
    for i, (x, y) in enumerate(coords):
        out.append(("M" if i == 0 else "L") + f"{x:.1f} {y:.1f}")
    return "".join(out)


def main(folder, routes_in, out_path):
    to_bng = Transformer.from_crs(4326, 27700, always_xy=True)
    contours, (ex0, ey0, ex1, ey1) = load_contours(folder)
    routes = json.load(open(routes_in))
    result = []
    for r in routes:
        pts = [to_bng.transform(lng, lat) for lat, lng in r["points"]]
        line = LineString(pts)
        minx, miny, maxx, maxy = line.bounds
        cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
        # Fit the route into the tile's shape, then pad.
        w, h = maxx - minx, maxy - miny
        aspect = TILE_W / TILE_H
        if w / h > aspect:
            h = w / aspect
        else:
            w = h * aspect
        w, h = w / (1 - 2 * PAD), h / (1 - 2 * PAD)
        # Slide the frame back inside the contour data where the route allows,
        # so padding alone never runs off the edge of the map.
        cx = min(max(cx, ex0 + w / 2), ex1 - w / 2) if w < ex1 - ex0 else cx
        cy = min(max(cy, ey0 + h / 2), ey1 - h / 2) if h < ey1 - ey0 else cy
        # ...but never so far that the route itself loses its padding.
        cx = min(max(cx, maxx - w / 2 + w * PAD), minx + w / 2 - w * PAD)
        cy = min(max(cy, maxy - h / 2 + h * PAD), miny + h / 2 - h * PAD)
        frame = box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
        scale = TILE_W / w
        x0, y1 = cx - w / 2, cy + h / 2

        def to_svg(x, y, z=None):
            return ((x - x0) * scale, (y1 - y) * scale)

        contour_paths = {"minor": [], "major": []}
        for geom, z in contours:
            if not geom.intersects(frame):
                continue
            clipped = geom.intersection(frame)
            if clipped.is_empty:
                continue
            svg = shp_transform(to_svg, clipped).simplify(TOLERANCE_PX)
            parts = svg.geoms if svg.geom_type.startswith("Multi") or svg.geom_type == "GeometryCollection" else [svg]
            for p in parts:
                if p.geom_type != "LineString" or p.length < 4:
                    continue
                kind = "major" if round(z) % 25 == 0 else "minor"
                contour_paths[kind].append(path_d(p.coords))

        route_svg = shp_transform(to_svg, line).simplify(0.4)
        # Where the tile runs past the edge of the contour data, the page fades
        # the contours out rather than stopping them at a hard line.
        dx0, dy0 = to_svg(max(ex0, x0), min(ey1, y1))
        dx1, dy1 = to_svg(min(ex1, x0 + w), max(ey0, y1 - h))
        full = dx0 <= 0.5 and dy0 <= 0.5 and dx1 >= TILE_W - 0.5 and dy1 >= TILE_H - 0.5
        data_edge = None if full else [round(dx0, 1), round(dy0, 1), round(dx1 - dx0, 1), round(dy1 - dy0, 1)]
        result.append({
            **{k: v for k, v in r.items() if k != "points"},
            "viewBox": f"0 0 {TILE_W} {TILE_H}",
            "contoursMinor": "".join(contour_paths["minor"]),
            "contoursMajor": "".join(contour_paths["major"]),
            "route": path_d(route_svg.coords),
            "start": [round(c, 1) for c in route_svg.coords[0]],
            "dataEdge": data_edge,
            "metresPerUnit": round(1 / scale, 3),
        })
    json.dump(result, open(out_path, "w"), indent=1)


if __name__ == "__main__":
    main(*sys.argv[1:4])
