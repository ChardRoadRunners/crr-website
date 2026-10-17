// Chard Road Runners — finish token, with the club mark
//
// Handed out in finishing order at the monthly handicap; the number is the
// finishing position. One solid piece, printed flat, no supports.
//
//   TOP (as printed): the CRR mark and the number, small, cut 1 mm in.
//   BOTTOM (on the bed): the number, big, flush with the face and outlined by
//   a fine groove, so it can be coloured in by hand afterwards (paint pen).
//   The groove is narrow enough to bridge, so the bed side needs no supports.
//
// Needs, next to this file: mark.scad (the club mark from src/assets/crr-logo-mark.svg
// as outlines) and Manrope-ExtraBold.ttf (Manrope, SIL Open Font Licence).
//   openscad -D number=10 -o crr-token-10.stl crr-finish-token.scad

use <Manrope-ExtraBold.ttf>
include <mark.scad>

number    = 7;       // finishing position on the token
width     = 50;      // mm
height    = 36;      // mm
thickness = 3.4;     // mm
corner    = 6;       // corner radius, mm
cut       = 1.0;     // how deep the mark is cut into the top, mm
groove_w  = 0.6;     // width of the outline round the big number, mm
groove_d  = 0.4;     // its depth (2 layers at 0.2), mm
hole_d    = 6;       // hole for a ring, string or hook board, mm
hole_edge = 5;       // hole centre from the top edge, mm
lean      = 12;      // degrees the numbers lean, echoing the mark's italic
mark_w    = 42;      // width of the mark, mm
font      = "Manrope ExtraBold";

$fn = 64;

module outline() {
    offset(r = corner) offset(delta = -corner) square([width, height], center = true);
}

module leaning() {
    multmatrix([[1, tan(lean), 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) children();
}

module number_text(size) {
    leaning() text(str(number), size = size, font = font, halign = "center", valign = "center");
}

// The big number, as seen from underneath: mirrored so it reads correctly
// when the token is turned over.
module big_number() {
    mirror([1, 0]) translate([0, -3.5]) number_text(number < 10 ? 20 : 17);
}

module top_design() {
    translate([0, 0.5]) scale(mark_w / mark_size[0]) crr_mark();
    translate([0, -height / 2 + 4.6]) number_text(5);
}

module hole() {
    translate([0, height / 2 - hole_edge, -1]) cylinder(d = hole_d, h = thickness + 2);
}

// The outline round the big number: a thin band straddling its edge.
module number_outline() {
    difference() {
        offset(delta = groove_w / 2) big_number();
        offset(delta = -groove_w / 2) big_number();
    }
}

difference() {
    linear_extrude(thickness) outline();
    hole();
    translate([0, 0, thickness - cut]) linear_extrude(cut + 1) top_design();
    translate([0, 0, -1]) linear_extrude(groove_d + 1) number_outline();
}
