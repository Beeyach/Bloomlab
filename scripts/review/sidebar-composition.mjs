// The requested compact rail keeps wording visible in both states. Check rendered geometry,
// including the glyph wrapper: its 4px gap is distinct from the SVG edge's 6px distance.
export function sidebarCompositionChecks({ row, icon, glyph, label, gap, labelFontSize }, mode) {
  return {
    requestedRow: row.height === 56 && row.width >= 44,
    requestedIcon: icon.visible && icon.width === 20 && icon.height === 20,
    requestedLabel: label.visible && label.boxes > 0 && labelFontSize === 11.5,
    requestedGap: gap === 4,
    iconInGlyph:
      icon.left >= glyph.left &&
      icon.right <= glyph.right &&
      icon.top >= glyph.top &&
      icon.bottom <= glyph.bottom &&
      Math.abs(icon.cx - glyph.cx) <= 1 &&
      Math.abs(icon.cy - glyph.cy) <= 1,
    rowBounds:
      glyph.left >= row.left &&
      glyph.right <= row.right &&
      glyph.top >= row.top &&
      glyph.bottom <= row.bottom &&
      label.top >= row.top &&
      label.bottom <= row.bottom &&
      (mode === 'collapsed' || (label.left >= row.left && label.right <= row.right)),
    composition:
      mode === 'expanded'
        ? Math.abs(label.left - glyph.right - 4) <= 0.5 && Math.abs(icon.cy - label.cy) <= 2
        : Math.abs(label.top - glyph.bottom - 4) <= 0.5 &&
          Math.abs(glyph.cx - row.cx) <= 1 &&
          Math.abs(icon.cx - row.cx) <= 1 &&
          Math.abs(label.cx - row.cx) <= 1 &&
          Math.abs((glyph.top + label.bottom) / 2 - row.cy) <= 1,
  };
}
