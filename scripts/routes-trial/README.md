# Route tiles — trial

A trial for the club route library (backlog: Q1 2027). The page is
`/routes-trial/`: six Tuesday club runs, each drawn on the club's LIDAR contours
with its distance and average pace. It isn't linked from the menu or the footer.

## Where the pieces come from

| Piece | Source |
|---|---|
| The runs | Six of Matthew's own Strava activities, all starting and finishing at Chard Cricket Club. GPS line, distance, moving-time pace and climb, in `routes.json` |
| The contours | The club's LIDAR contour GeoPackages in Drive, Media › TOPO: `Just Ground Contour.gpkg` and `2` to `9`. Nine tiles, about 6.7 × 7.6 km round Chard, 5 m apart, British National Grid. **Not in this repository** (about 40 MB) |
| The page's words | `src/data/routes-trial/page.json` |
| The finished maps | `src/data/routes-trial/tiles.json`, written by `make_tiles.py` |

The site does no mapping. `make_tiles.py` projects the runs onto the grid,
crops each tile to fit its route, clips and simplifies the contours, and writes
finished SVG paths. `RouteTile.astro` only draws them.

## Making the tiles again

Needs Python 3 with `pyproj` and `shapely` (`pip install pyproj shapely`).

1. Download the nine `.gpkg` files from Drive into a folder, say `topo/`.
2. From the repository root:

   ```sh
   python3 scripts/routes-trial/make_tiles.py topo scripts/routes-trial/routes.json src/data/routes-trial/tiles.json
   ```

## Things to decide before this becomes the real library

- **Where routes come from.** These are one member's runs. Members' own
  recordings start and finish at their front doors, and only a recording that
  starts at the club can go up without trimming (CLAUDE.md, "Never publish
  anyone's home address").
- **Python.** The rest of the site's tooling is Node. Either the real version
  draws tiles in Node at build time (a GeoPackage is a SQLite file, so that
  needs a SQLite package), or the contours are cut once into a lighter file and
  the build reads that.
- **A routes collection** (`src/content/routes/`) with a CMS form, so a
  webmaster can add a route without running anything. That means
  `content.config.ts` and `public/admin/config.yml` changing together.
- **Edges.** Two of Tom's runs go past the LIDAR coverage. The page fades the
  contours out there rather than stopping them at a hard edge.
- **GPX downloads**, and whether to show the climb as well as distance and
  pace.
