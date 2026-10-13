import assert from 'node:assert/strict';

/** Inspect painted text, including wraps, rather than only page-level overflow. */
export async function playgroundLayout(page) {
  const result = await page.evaluate(`(() => {
    const list = document.querySelector('[aria-label="Unlocked features"]');
    if (!list) return { rows: 0, failures: ['Unlocked feature rows are missing'] };
    const failures = [];
    for (const row of list.children) {
      const bounds = row.getBoundingClientRect();
      const cells = [...row.children].map((cell) => {
        const rect = cell.getBoundingClientRect();
        const clipped = ['hidden', 'clip'].includes(getComputedStyle(cell).overflowX);
        const ranges = [];
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          ranges.push(...[...range.getClientRects()].map(r => ({left:r.left,right:r.right,top:r.top,bottom:r.bottom})));
        }
        return { text: cell.textContent.trim(), rect, ranges: clipped ? [rect] : ranges };
      });
      for (const [index, cell] of cells.entries()) {
        if (cell.ranges.some(r => r.left < bounds.left - 1 || r.right > bounds.right + 1))
          failures.push(row.dataset.feature + ': text outside row: ' + cell.text);
        for (const other of cells.slice(index + 1))
          if (cell.ranges.some(r => other.ranges.some(o => r.left < o.right - 1 && r.right > o.left + 1 && r.top < o.bottom - 1 && r.bottom > o.top + 1)))
            failures.push(row.dataset.feature + ': overlapping text: ' + cell.text + ' / ' + other.text);
      }
      const table = list.parentElement;
      if (bounds.right > table.getBoundingClientRect().right + 1)
        failures.push(row.dataset.feature + ': row needs horizontal scrolling');
    }
    return { rows: list.children.length, failures };
  })()`);
  assert(result.rows > 0, 'Inspect populated unlocked features');
  assert.deepEqual(
    result.failures,
    [],
    'Unlocked feature text remains readable without overlap or horizontal scrolling',
  );
  return result;
}
