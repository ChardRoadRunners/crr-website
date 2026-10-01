// Chard Road Runners — finish token
//
// Handed out in finishing order at the monthly handicap. The number is the
// finishing position, so it has to be readable at arm's length in poor light.
//
// Numbers are cut into BOTH faces, so a token reads the right way up whichever
// way it lands in someone's hand. Print flat, no supports. For two colours,
// add a filament change at the layer where the cut begins on the top face
// (height = thickness - depth) — or simply fill the numbers with paint pen.
//
// Change `number` (or pass -D number=12 on the command line) and export STL.

number    = 11;      // finishing position printed on the token
width     = 50;      // mm
height    = 36;      // mm
thickness = 3.2;     // mm
corner    = 6;       // corner radius, mm
depth     = 1.0;     // how deep the numbers are cut on each face, mm
hole_d    = 6;       // hole for a string, ring or hook board, mm
hole_edge = 6.5;     // hole centre distance from the top edge, mm
label     = "CRR";   // small text under the number; "" for none
font      = "DejaVu Sans:style=Bold";

$fn = 64;

module outline() {
    offset(r = corner) offset(delta = -corner)
        square([width, height], center = true);
}

module number_text() {
    // Two-digit numbers get slightly smaller type so they never crowd the hole.
    size = number < 10 ? 18 : 15;
    translate([0, -1.5]) text(str(number), size = size, font = font,
                              halign = "center", valign = "center");
    if (label != "")
        translate([0, -height / 2 + 4.2])
            text(label, size = 4, font = font, halign = "center", valign = "center");
}

difference() {
    linear_extrude(thickness) outline();

    // Hole near the top edge.
    translate([0, height / 2 - hole_edge, -1]) cylinder(d = hole_d, h = thickness + 2);

    // Front face.
    translate([0, 0, thickness - depth]) linear_extrude(depth + 1) number_text();

    // Back face, mirrored so it reads correctly when the token is turned over.
    translate([0, 0, -1]) linear_extrude(depth + 1) mirror([1, 0]) number_text();
}
