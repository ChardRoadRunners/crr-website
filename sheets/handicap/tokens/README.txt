CRR finish tokens 1-40, two colours

Each token is two STLs that fit together: crr-token-NN-body.stl and crr-token-NN-number.stl.
50 x 36 x 3.4 mm.

  Top (as printed): the CRR mark and the number, small, cut 1 mm in.
  Bottom (on the bed): the big number, flush, in the second colour. 0.6 mm thick.
  Nothing is recessed on the bed side, so no supports.

Slicer (Bambu Studio / PrusaSlicer / Orca): select BOTH files for a token and drop them in
together; answer Yes to "load as a single object with multiple parts". Give the number part
the second filament. Both files share the same origin, so they line up by themselves.
Use a 0.2 mm first layer so the number is exactly 3 layers.

Club colours: purple body, sky-blue number.

To change anything, edit the values at the top of crr-finish-token.scad in OpenSCAD,
keeping mark.scad and Manrope-ExtraBold.ttf alongside. Manrope: SIL Open Font Licence.
