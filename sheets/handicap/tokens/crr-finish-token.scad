// Chard Road Runners — finish token, with the club mark
//
// Handed out in finishing order at the monthly handicap; the number is the
// finishing position.
//
//   TOP (as printed): the CRR mark and the number, small, cut 1 mm in.
//   BOTTOM (on the bed): the number, big, as a FLUSH INLAY in a second
//   colour. Nothing is recessed on the bed side, so it needs no supports.
//
// The inlay only shows in a second colour, so print with two filaments (AMS,
// MMU or similar): load the body and the number STLs together as ONE object
// with two parts, and give the number part the second colour. Purple body,
// sky-blue number suits the club colours.
//
// Needs, next to this file: mark.scad (the club mark from src/assets/crr-logo-mark.svg
// as outlines) and Manrope-ExtraBold.ttf (Manrope, SIL Open Font Licence).
//   openscad -D number=7 -D 'part="body"'   -o crr-token-07-body.stl   crr-finish-token.scad
//   openscad -D number=7 -D 'part="number"' -o crr-token-07-number.stl crr-finish-token.scad

use <Manrope-ExtraBold.ttf>
include <mark.scad>

number    = 7;       // finishing position on the token
part      = "both";  // "body", "number", or "both" (preview)
width     = 50;      // mm
height    = 36;      // mm
thickness = 3.4;     // mm
corner    = 6;       // corner radius, mm
cut       = 1.0;     // how deep the mark is cut into the top, mm
inlay     = 0.6;     // how thick the flush number inlay is (3 layers at 0.2), mm
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

module body() {
    difference() {
        linear_extrude(thickness) outline();
        hole();
        translate([0, 0, thickness - cut]) linear_extrude(cut + 1) top_design();
        translate([0, 0, -1]) linear_extrude(inlay + 1) big_number();
    }
}

module number_inlay() {
    linear_extrude(inlay) big_number();
}

if (part == "body") body();
else if (part == "number") number_inlay();
else { color("#5b2d8e") body(); color("#7cc4ef") number_inlay(); }
