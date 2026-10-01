// Chard Road Runners — finish token, with the club mark
//
// Handed out in finishing order at the monthly handicap; the number is the
// finishing position. FRONT: the number, big, in Manrope ExtraBold leaning
// like the mark. BACK: the CRR mark, with the number again, small, so a token
// reads whichever way up it lands in someone's hand.
//
// Everything is cut 1 mm into the faces. Print flat, front face up, no
// supports. For two colours, change filament at the layer where the front
// cut begins (height = thickness - depth): purple body, sky-blue numbers.
//
// Needs, next to this file: mark.scad (the club mark from src/assets/crr-logo-mark.svg
// as outlines) and Manrope-ExtraBold.ttf (Manrope, SIL Open Font Licence).
// Make one: openscad -D number=7 -o crr-token-07.stl crr-finish-token.scad

use <Manrope-ExtraBold.ttf>
include <mark.scad>

number    = 7;       // finishing position on the token
width     = 50;      // mm
height    = 36;      // mm
thickness = 3.4;     // mm
corner    = 6;       // corner radius, mm
depth     = 1.0;     // how deep everything is cut, mm
hole_d    = 6;       // hole for a ring, string or hook board, mm
hole_edge = 5;       // hole centre from the top edge, mm
lean      = 12;      // degrees the numbers lean, echoing the mark's italic
mark_w    = 42;      // width of the mark on the back, mm
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

module front() {
    // One digit gets bigger type than two; both keep clear of the hole.
    translate([0, -3.5]) number_text(number < 10 ? 20 : 17);
}

module back() {
    translate([0, 0.5]) scale(mark_w / mark_size[0]) crr_mark();
    translate([0, -height / 2 + 4.6]) number_text(5);
}

difference() {
    linear_extrude(thickness) outline();
    translate([0, height / 2 - hole_edge, -1]) cylinder(d = hole_d, h = thickness + 2);
    translate([0, 0, thickness - depth]) linear_extrude(depth + 1) front();
    // Mirrored so it reads correctly when the token is turned over.
    translate([0, 0, -1]) linear_extrude(depth + 1) mirror([1, 0]) back();
}
