import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sidebarCompositionChecks } from './sidebar-composition.mjs';

const expanded = {
  row: { left: 12, right: 177, top: 84, bottom: 140, height: 56, width: 165, cx: 94.5, cy: 112 },
  icon: {
    left: 22,
    right: 42,
    top: 102,
    bottom: 122,
    width: 20,
    height: 20,
    cx: 32,
    cy: 112,
    visible: true,
  },
  glyph: { left: 20, right: 44, top: 100, bottom: 124, cx: 32, cy: 112 },
  label: {
    left: 48,
    right: 80.484,
    top: 103.375,
    bottom: 120.625,
    cx: 64.242,
    cy: 112,
    boxes: 1,
    visible: true,
  },
  gap: 4,
  labelFontSize: 11.5,
};
const collapsed = {
  ...expanded,
  row: { left: 8, right: 57, top: 100, bottom: 156, height: 56, width: 49, cx: 32.5, cy: 128 },
  icon: {
    ...expanded.icon,
    left: 22.5,
    right: 42.5,
    top: 107.375,
    bottom: 127.375,
    cx: 32.5,
    cy: 117.375,
  },
  glyph: { left: 20.5, right: 44.5, top: 105.375, bottom: 129.375, cx: 32.5, cy: 117.375 },
  label: {
    left: 16.25,
    right: 48.734,
    top: 133.375,
    bottom: 150.625,
    cx: 32.492,
    cy: 142,
    boxes: 1,
    visible: true,
  },
};
const passes = (composition, mode) =>
  Object.values(sidebarCompositionChecks(composition, mode)).every(Boolean);

test('accepts 56px expanded rows with 20px icons, 4px wrapper gap and 11.5px labels', () => {
  assert.equal(passes(expanded, 'expanded'), true);
});
test('accepts a centered compact icon and visible label group when collapsed', () => {
  assert.equal(passes(collapsed, 'collapsed'), true);
});
test('rejects obsolete 48px rows and oversized rows', () => {
  for (const height of [48, 60, 70])
    assert.equal(passes({ ...expanded, row: { ...expanded.row, height } }, 'expanded'), false);
});
test('rejects hidden collapsed wording', () => {
  assert.equal(
    passes({ ...collapsed, label: { ...collapsed.label, boxes: 0, visible: false } }, 'collapsed'),
    false,
  );
});
test('rejects incorrect icon size, gap and label size', () => {
  for (const wrong of [
    { ...expanded, icon: { ...expanded.icon, width: 24 } },
    { ...expanded, gap: 8 },
    { ...expanded, labelFontSize: 12 },
  ])
    assert.equal(passes(wrong, 'expanded'), false);
});
test('rejects stacked expanded composition and an off-center collapsed group', () => {
  assert.equal(passes(collapsed, 'expanded'), false);
  assert.equal(passes({ ...collapsed, row: { ...collapsed.row, cy: 132 } }, 'collapsed'), false);
});

test('rejects an icon shifted away from its glyph wrapper', () => {
  assert.equal(passes({ ...expanded, icon: { ...expanded.icon, cx: 100 } }, 'expanded'), false);
  assert.equal(
    passes({ ...collapsed, icon: { ...collapsed.icon, top: 90, bottom: 110 } }, 'collapsed'),
    false,
  );
});
test('rejects a collapsed glyph outside the row even when the group center is correct', () => {
  assert.equal(
    passes(
      { ...collapsed, glyph: { ...collapsed.glyph, left: 100, right: 124, cx: 112 } },
      'collapsed',
    ),
    false,
  );
  assert.equal(
    passes(
      {
        ...collapsed,
        glyph: { ...collapsed.glyph, top: 96, bottom: 140 },
        label: { ...collapsed.label, top: 144, bottom: 160 },
      },
      'collapsed',
    ),
    false,
  );
});
test('rejects expanded wording outside the clickable row', () => {
  assert.equal(
    passes({ ...expanded, label: { ...expanded.label, right: 180 } }, 'expanded'),
    false,
  );
});
