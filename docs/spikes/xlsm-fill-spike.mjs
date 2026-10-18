// Fill input cells of an .xlsm by editing the sheet XML inside the zip. Nothing else is touched
// except workbook.xml's calcPr (force a recalculation on load) and the calcChain part, which Excel
// rebuilds. Works in Node and in a browser (fflate is the only dependency). Spike code for issue
// #39, not production: not part of the build, fflate is not in package.json, and the official
// workbook is not in the repo. See docs/spikes/xlsm-automated-data-sheet.md for what each rule is for.
//
//   import { fillWorkbook } from './xlsm-fill-spike.mjs';
//   const { bytes } = fillWorkbook(new Uint8Array(officialXlsm), [
//     { sheet: 'Page 3 (Soil)', cell: 'B6', v: '0-8' },   // text: an inline string, style kept
//     { sheet: 'Page 3 (Soil)', cell: 'R6', v: 100 },      // number
//     { sheet: 'Page 1 (Hydrology)', cell: 'M39', v: 'X' }, // a tick is a literal "X"
//     { sheet: 'Page 1 (Hydrology)', cell: 'B27', v: '' },  // empty cell: switches an automatic tick off
//   ]);
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // control characters other than tab, LF, CR are illegal in XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const colToNum = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const numToCol = (n) => {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/**
 * Shift the relative references of a formula by (dRow, dCol), as Excel does when a shared formula
 * is read at a child cell. Skips string literals and quoted sheet names; `$` pins a part.
 */
export function shiftFormula(text, dRow, dCol) {
  return text
    .split(/("[^"]*"|'[^']*')/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/(^|[^A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (m, pre, ca, col, ra, row) => {
            const c = ca ? col : numToCol(colToNum(col) + dCol);
            const r = ra ? row : String(Number(row) + dRow);
            return `${pre}${ca}${c}${ra}${r}`;
          }),
    )
    .join('');
}

/**
 * Excel stores a formula shared by a block of cells once, on the top-left "master" (<f t="shared"
 * ref=... si=N>text</f>); the others carry <f t="shared" si=N/>. Replacing the master orphans the
 * others and Excel then refuses the file. This rewrites every child of group `si` as a plain formula.
 */
export function unshareGroup(xml, si, masterCol, masterRow, text) {
  const child = new RegExp(`(<c r="([A-Z]+)(\\d+)"[^>]*>)<f t="shared" si="${si}"/>`, 'g');
  return xml.replace(child, (m, open, col, row) => {
    const f = shiftFormula(text, Number(row) - masterRow, colToNum(col) - masterCol);
    return `${open}<f>${f}</f>`;
  });
}

/** Insert a cell that does not exist yet (some hidden helper cells are absent) in column order. */
function insertCell(xml, ref, cellXml) {
  const [, col, row] = /^([A-Z]+)(\d+)$/.exec(ref);
  const rowStart = xml.indexOf(`<row r="${row}"`);
  if (rowStart < 0) throw new Error(`row ${row} is not in the sheet XML`);
  const tagEnd = xml.indexOf('>', rowStart);
  if (xml[tagEnd - 1] === '/') return xml.slice(0, tagEnd - 1) + `>${cellXml}</row>` + xml.slice(tagEnd + 1);
  const rowEnd = xml.indexOf('</row>', tagEnd);
  const cells = xml.slice(tagEnd + 1, rowEnd);
  let at = cells.length;
  for (const m of cells.matchAll(/<c r="([A-Z]+)\d+"/g)) {
    if (colToNum(m[1]) > colToNum(col)) {
      at = m.index;
      break;
    }
  }
  return xml.slice(0, tagEnd + 1) + cells.slice(0, at) + cellXml + cells.slice(at) + xml.slice(rowEnd);
}

/** Replace the cell `ref` in `xml` with a number or an inline string, keeping its style (s=). */
export function setCell(xml, ref, value) {
  const i = xml.indexOf(`<c r="${ref}"`);
  if (i < 0) {
    const cell = typeof value === 'number' ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    return { xml: insertCell(xml, ref, cell), hadFormula: false, unshared: false };
  }
  const gt = xml.indexOf('>', i);
  const selfClosing = xml[gt - 1] === '/';
  const end = selfClosing ? gt + 1 : xml.indexOf('</c>', gt) + 4;
  const old = xml.slice(i, end);
  const style = /\ss="(\d+)"/.exec(old.slice(0, old.indexOf('>')))?.[1];
  const hadFormula = /<f[ >/]/.test(old);
  const head = `<c r="${ref}"${style ? ` s="${style}"` : ''}`;
  // '' or null writes a truly empty cell, which switches an automated tick off (no formula left)
  const cell =
    value === '' || value == null
      ? `${head}/>`
      : typeof value === 'number'
        ? `${head}><v>${value}</v></c>`
        : `${head} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  let out = xml.slice(0, i) + cell + xml.slice(end);
  const master = /<f t="shared" ref="[^"]+" si="(\d+)">([^<]*)<\/f>/.exec(old);
  if (master) {
    const [, col, row] = /^([A-Z]+)(\d+)$/.exec(ref);
    out = unshareGroup(out, master[1], colToNum(col), Number(row), master[2]);
  }
  return { xml: out, hadFormula, unshared: Boolean(master) };
}

/** fills: [{ sheet: 'Page 3 (Soil)', cell: 'B6', v: '0-8' | 60 }] */
export function fillWorkbook(bytes, fills, { forceRecalc = true, dropCalcChain = true } = {}) {
  const z = unzipSync(bytes);
  const wb = strFromU8(z['xl/workbook.xml']);
  const rels = strFromU8(z['xl/_rels/workbook.xml.rels']);
  const partOf = (name) => {
    const tag = new RegExp(`<sheet [^>]*name="${reEscape(name)}"[^>]*/>`).exec(wb)?.[0];
    const rid = tag && /r:id="([^"]+)"/.exec(tag)?.[1];
    if (!rid) throw new Error(`no sheet named ${name}`);
    const rel = new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*/>`).exec(rels)?.[0];
    return 'xl/' + /Target="([^"]+)"/.exec(rel)[1];
  };
  const bySheet = new Map();
  for (const f of fills) {
    if (!bySheet.has(f.sheet)) bySheet.set(f.sheet, []);
    bySheet.get(f.sheet).push(f);
  }
  const stats = { replacedFormulas: 0, unsharedGroups: 0 };
  for (const [sheet, list] of bySheet) {
    const part = partOf(sheet);
    let xml = strFromU8(z[part]);
    for (const f of list) {
      const r = setCell(xml, f.cell, f.v);
      xml = r.xml;
      if (r.hadFormula) stats.replacedFormulas++;
      if (r.unshared) stats.unsharedGroups++;
    }
    z[part] = strToU8(xml);
  }
  let newWb = wb;
  if (forceRecalc) {
    newWb = newWb.replace(/<calcPr ([^>]*?)\/>/, (m, a) =>
      /fullCalcOnLoad/.test(a) ? m : `<calcPr ${a} fullCalcOnLoad="1"/>`,
    );
  }
  z['xl/workbook.xml'] = strToU8(newWb);
  if (dropCalcChain && z['xl/calcChain.xml']) {
    delete z['xl/calcChain.xml'];
    z['[Content_Types].xml'] = strToU8(
      strFromU8(z['[Content_Types].xml']).replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, ''),
    );
    z['xl/_rels/workbook.xml.rels'] = strToU8(rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''));
  }
  return { bytes: zipSync(z, { level: 6 }), ...stats };
}
