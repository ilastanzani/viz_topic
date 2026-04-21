<!-- src/routes/v3/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { clusterKeywords, TREE, aggClusters, colorScale } from '$lib/data.js';

  // ── State ─────────────────────────────────────────────────────────────────────
  let selectedId = $state(null);   // fine-level cluster id
  let hoveredId  = $state(null);
  let svgEl      = $state(null);
  let dendroEl   = $state(null);
  let showKwRing = $state(false);  // whether keyword outer ring is shown

  // ── Tree helpers ──────────────────────────────────────────────────────────────
  function collectMergeDistances(node, out = []) {
    if (node.dist !== undefined && node.dist > 0) out.push(node.dist);
    if (node.children) node.children.forEach(c => collectMergeDistances(c, out));
    return out;
  }
  function cutTree(node, threshold) {
    if (!node.children || (node.dist !== undefined && node.dist <= threshold)) return [node];
    return node.children.flatMap(c => cutTree(c, threshold));
  }
  function leafIds(node) {
    if (!node.children) return [node.id];
    return node.children.flatMap(leafIds);
  }

  const allDists   = [...new Set(collectMergeDistances(TREE))].sort((a, b) => a - b);
  const maxDist    = TREE.dist ?? allDists.at(-1) ?? 1;
  const LEVEL_THRESHOLDS = [
    null,
    allDists[Math.max(0, Math.floor(0.25 * (allDists.length - 1)))],  // fine
    allDists[Math.max(0, Math.floor(0.60 * (allDists.length - 1)))],  // coarse
    maxDist * 1.01,                                                    // root
  ];

  function buildLevelClusters(level) {
    if (level === 0) return [];
    const superNodes = cutTree(TREE, LEVEL_THRESHOLDS[level]);
    return superNodes.map(sn => {
      const ids     = leafIds(sn);
      const bases   = aggClusters.filter(a => ids.includes(a.id));
      const kwcount = bases.reduce((s, a) => s + (a.kwcount ?? 0), 0) || ids.length;
      const kws     = ids.flatMap(id => clusterKeywords[id] ?? []);
      return { id: ids[0], ids, kwcount, kws,
               label: ids.length > 1 ? `[${ids.join(',')}]` : String(ids[0]) };
    });
  }

  // ── Build the full hierarchy layout in one pass ───────────────────────────────
  // Returns an object with:
  //   rootArcs   [{...cluster, a0, a1}]   2 arcs
  //   coarseArcs [{...cluster, a0, a1, rootParentId}]   ~47 arcs
  //   fineArcs   [{...cluster, a0, a1, coarseParentId}] ~88 arcs
  //
  // Angles are assigned top-down: root arcs are sized ∝ their total kwcount,
  // each root arc's span is then subdivided among coarse children ∝ kwcount,
  // each coarse arc's span is then subdivided among fine children ∝ kwcount.
  // This guarantees perfect nesting with no gaps or overlaps.
  function buildLayout() {
    const TAU    = 2 * Math.PI;
    const fine   = buildLevelClusters(1);
    const coarse = buildLevelClusters(2);
    const root   = buildLevelClusters(3);

    // Leaf-id → parent maps
    const leafToCoarse = new Map();
    const leafToRoot   = new Map();
    coarse.forEach(cp => cp.ids.forEach(id => leafToCoarse.set(id, cp)));
    root  .forEach(rp => rp.ids.forEach(id => leafToRoot  .set(id, rp)));

    function parentCoarse(fc) {
      for (const id of fc.ids) { const p = leafToCoarse.get(id); if (p) return p; }
      return null;
    }
    function parentRoot(cc) {
      for (const id of cc.ids) { const p = leafToRoot.get(id); if (p) return p; }
      return null;
    }

    // ── 1. Assign root arcs ∝ root kwcount ───────────────────────────────────
    const rootTotal = root.reduce((s, r) => s + (r.kwcount || 1), 0);
    let cursor = 0;
    const rootArcs = root.map(rp => {
      const frac = (rp.kwcount || 1) / rootTotal;
      const a0 = cursor * TAU, a1 = (cursor + frac) * TAU;
      cursor += frac;
      return { ...rp, a0, a1 };
    });

    // ── 2. Assign coarse arcs — subdivide each root arc among its children ────
    const coarseArcs = [];
    rootArcs.forEach(rp => {
      const children = coarse
        .filter(cc => parentRoot(cc)?.id === rp.id)
        .sort((a, b) => b.kwcount - a.kwcount);
      if (!children.length) return;
      const childTotal = children.reduce((s, c) => s + (c.kwcount || 1), 0);
      const span = rp.a1 - rp.a0;
      let cur = rp.a0;
      children.forEach(cc => {
        const frac = (cc.kwcount || 1) / childTotal;
        const a0 = cur, a1 = cur + frac * span;
        cur = a1;
        coarseArcs.push({ ...cc, a0, a1, rootParentId: rp.id });
      });
    });

    // ── 3. Assign fine arcs — subdivide each coarse arc among its children ────
    const fineArcs = [];
    coarseArcs.forEach(cp => {
      const children = fine
        .filter(fc => parentCoarse(fc)?.id === cp.id)
        .sort((a, b) => b.kwcount - a.kwcount);
      if (!children.length) return;
      const childTotal = children.reduce((s, c) => s + (c.kwcount || 1), 0);
      const span = cp.a1 - cp.a0;
      let cur = cp.a0;
      children.forEach(fc => {
        const frac = (fc.kwcount || 1) / childTotal;
        const a0 = cur, a1 = cur + frac * span;
        cur = a1;
        fineArcs.push({ ...fc, a0, a1, coarseParentId: cp.id });
      });
    });

    return { rootArcs, coarseArcs, fineArcs };
  }

  // ── Keyword dots (level-0 scatter view) ──────────────────────────────────────
  function buildKeywordDots() {
    const dots = [];
    const rng = d3.randomNormal.source(d3.randomLcg(42))(0, 0.18);
    aggClusters.forEach(cl => {
      (clusterKeywords[cl.id] ?? []).forEach(kw => {
        dots.push({ kw, clusterId: cl.id, cx: cl.cx + rng(), cy: cl.cy + rng() });
      });
    });
    return dots;
  }
  const kwDots = buildKeywordDots();

  // ── Derived keyword panel data ────────────────────────────────────────────────
  let _layout = null;

  function findArc(id) {
    if (!_layout || id === null) return null;
    return _layout.fineArcs.find(a => a.id === id)
        ?? _layout.coarseArcs.find(a => a.id === id)
        ?? _layout.rootArcs.find(a => a.id === id)
        ?? null;
  }

  let displayKws = $derived.by(() => {
    const id = selectedId ?? hoveredId;
    if (id === null) return [];
    if (!_layout) return clusterKeywords[id] ?? [];
    const arc = findArc(id);
    return arc ? arc.kws : (clusterKeywords[id] ?? []);
  });

  let listTitle = $derived.by(() => {
    const id = selectedId ?? hoveredId;
    if (id === null) return 'Click an arc to see keywords';
    const arc = _layout ? findArc(id) : null;
    return arc ? `${arc.label ?? id} — ${displayKws.length} keywords` : `Cluster ${id}`;
  });

  // ── Draw sunburst ─────────────────────────────────────────────────────────────
  function drawSunburst(el) {
    if (!el) return;

    const W  = el.clientWidth  || 600;
    const H  = el.clientHeight || 500;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.46;

    // Radial zones (from centre out):
    //   hole:    0  → holeR
    //   ring 1 (root):   holeR → r1
    //   ring 2 (coarse): r1    → r2
    //   ring 3 (fine):   r2    → r3 = maxR
    //   ring 4 (kw):     r3    → r4  (only when showKwRing)
    const holeR = maxR * 0.12;
    const r1    = maxR * 0.28;
    const r2    = maxR * 0.55;
    const r3    = maxR;          // fine ring outer edge
    const r4    = maxR * 1.22;  // keyword ring outer edge

    _layout = buildLayout();
    const { rootArcs, coarseArcs, fineArcs } = _layout;

    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // ── Arc generators ────────────────────────────────────────────────────────
    function makeArc(ir, or, pad = 0.008) {
      return d3.arc().innerRadius(ir).outerRadius(or)
        .startAngle(d => d.a0).endAngle(d => d.a1)
        .padAngle(pad).padRadius((ir + or) / 2);
    }

    const rootArcGen   = makeArc(holeR, r1, 0.015);
    const coarseArcGen = makeArc(r1 + 2, r2, 0.006);
    const fineArcGen   = makeArc(r2 + 2, r3, 0.003);
    const kwArcGen     = makeArc(r3 + 4, r4, 0.002);

    // ── Helper: determine the "root parent color" for a fine/coarse arc ───────
    function rootColor(d) {
      // find which root arc this belongs to
      const ra = rootArcs.find(r =>
        d.rootParentId === r.id ||
        (d.coarseParentId && coarseArcs.find(c => c.id === d.coarseParentId)?.rootParentId === r.id)
      );
      return ra ? colorScale(ra.id) : colorScale(d.id);
    }

    // ── Style helpers ─────────────────────────────────────────────────────────
    function fillOf(d, baseColor) {
      if (selectedId !== null) {
        if (d.id === selectedId) return '#f8c948';
        const arc = findArc(selectedId);
        if (arc) {
          if (d.id === arc.coarseParentId) return d3.color(baseColor).brighter(0.4);
          if (d.id === arc.rootParentId)   return d3.color(baseColor).brighter(0.4);
          // fine siblings (same coarse parent)
          const selFine = fineArcs.find(f => f.id === selectedId);
          if (selFine && d.coarseParentId === selFine.coarseParentId) return d3.color(baseColor).brighter(0.15);
        }
        return d3.color(baseColor).darker(1.2).copy({opacity: 0.25});
      }
      if (d.id === hoveredId) return d3.color(baseColor).brighter(0.5);
      return baseColor;
    }

    function opacityOf(d) {
      if (selectedId !== null) {
        if (d.id === selectedId) return 1;
        const arc = findArc(selectedId);
        if (arc && (d.id === arc.coarseParentId || d.id === arc.rootParentId)) return 0.85;
        const selFine = fineArcs.find(f => f.id === selectedId);
        if (selFine && d.coarseParentId === selFine.coarseParentId) return 0.65;
        return 0.18;
      }
      return d.id === hoveredId ? 0.95 : 0.72;
    }

    function strokeOf(d) {
      if (d.id === selectedId) return '#fff';
      if (d.id === hoveredId)  return '#cbd5e1';
      return '#0f172a';
    }
    function strokeWOf(d) {
      return (d.id === selectedId || d.id === hoveredId) ? 1.5 : 0.4;
    }

    // ── Draw ring ─────────────────────────────────────────────────────────────
    function drawRing(data, arcGen, colorFn, ringClass) {
      const rg = g.append('g').attr('class', ringClass);
      rg.selectAll('path')
        .data(data, d => d.id)
        .join('path')
          .attr('class', `arc ${ringClass}-arc`)
          .attr('d', arcGen)
          .attr('fill', d => fillOf(d, colorFn(d)))
          .attr('fill-opacity', d => opacityOf(d))
          .attr('stroke', d => strokeOf(d))
          .attr('stroke-width', d => strokeWOf(d))
          .style('cursor', 'pointer')
          .on('mouseenter', (_, d) => { hoveredId = d.id; updateStyles(); })
          .on('mouseleave', ()     => { hoveredId = null;  updateStyles(); })
          .on('click', (_, d) => {
            selectedId = selectedId === d.id ? null : d.id;
            showKwRing = selectedId !== null;
            hoveredId  = null;
            updateStyles();
            updateDendroStyles();
            drawKwRing(el, cx, cy, r3, r4);
          });
      return rg;
    }

    // Root ring — each arc gets its own colorScale color
    drawRing(rootArcs,   rootArcGen,   d => colorScale(d.id), 'root-ring');
    // Coarse ring — inherit tint from root parent
    drawRing(coarseArcs, coarseArcGen, d => rootColor(d),    'coarse-ring');
    // Fine ring — inherit tint from root parent (slightly darker)
    drawRing(fineArcs,   fineArcGen,   d => {
      const base = rootColor(d);
      return d3.color(base).darker(0.3).toString();
    }, 'fine-ring');

    // ── Labels ────────────────────────────────────────────────────────────────
    function addLabels(data, arcGen, ir, or, minSpan, maxChars) {
      g.selectAll(`text.lbl-${ir}`)
        .data(data.filter(d => (d.a1 - d.a0) > minSpan), d => d.id)
        .join('text')
          .attr('class', `lbl lbl-${ir}`)
          .attr('transform', d => {
            const mid  = (d.a0 + d.a1) / 2 - Math.PI / 2;
            const midR = (ir + or) / 2;
            const flip = (mid > 0 && mid < Math.PI) ? 180 : 0;
            return `rotate(${mid * 180 / Math.PI}) translate(${midR},0) rotate(${flip})`;
          })
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('font-size', d => {
            const arcLen = (d.a1 - d.a0) * (ir + or) / 2;
            return `${Math.max(6, Math.min(11, arcLen * 0.13))}px`;
          })
          .attr('font-weight', d => d.id === selectedId ? '800' : '600')
          .attr('fill', d => d.id === selectedId ? '#0f172a' : '#e2e8f0')
          .attr('paint-order', 'stroke')
          .attr('stroke', d => d.id === selectedId ? 'none' : '#0f172a')
          .attr('stroke-width', '2.5px').attr('stroke-linejoin', 'round')
          .attr('pointer-events', 'none')
          .text(d => {
            const txt = d.kws[0] ?? String(d.id);
            return txt.length > maxChars ? txt.slice(0, maxChars - 1) + '…' : txt;
          });
    }

    addLabels(rootArcs,   rootArcGen,   holeR, r1, 0.20, 14);
    addLabels(coarseArcs, coarseArcGen, r1,    r2, 0.10, 10);
    addLabels(fineArcs,   fineArcGen,   r2,    r3, 0.06, 8);

    // ── Centre hole label ─────────────────────────────────────────────────────
    g.append('circle').attr('r', holeR).attr('fill', '#0f172a').attr('stroke', '#1e3a5f').attr('stroke-width', 1);
    const cg = g.append('g').attr('class', 'centre').attr('pointer-events', 'none');
    cg.append('text').attr('class', 'c-title')
      .attr('text-anchor', 'middle').attr('y', -6)
      .attr('font-size', '10px').attr('font-weight', '700').attr('fill', '#94a3b8')
      .text(selectedId !== null ? (findArc(selectedId)?.kws[0] ?? String(selectedId)) : 'Sunburst');
    cg.append('text').attr('class', 'c-count')
      .attr('text-anchor', 'middle').attr('y', 7)
      .attr('font-size', '8px').attr('fill', '#475569')
      .text(selectedId !== null ? `${displayKws.length} kw` : `${fineArcs.length} fine`);

    // ── Separator ring lines ──────────────────────────────────────────────────
    [r1, r2, r3].forEach(r => {
      g.append('circle').attr('r', r)
        .attr('fill', 'none').attr('stroke', '#0f172a').attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    });

    // ── Keyword ring layer ────────────────────────────────────────────────────
    svg.append('g').attr('class', 'kw-layer');
    if (showKwRing && selectedId !== null) drawKwRing(el, cx, cy, r3, r4);
  }

  // ── Keyword outer ring ────────────────────────────────────────────────────────
  function drawKwRing(el, cx, cy, innerR, outerR) {
    const layer = d3.select(el).select('g.kw-layer');
    layer.selectAll('*').remove();
    if (!selectedId) return;

    // Find the selected fine arc to get its angular span
    const selArc = _layout?.fineArcs.find(a => a.id === selectedId);
    if (!selArc) return;

    const kws  = clusterKeywords[selectedId] ?? [];
    if (!kws.length) return;

    const span = selArc.a1 - selArc.a0;
    const step = span / kws.length;

    const kwData = kws.map((kw, i) => ({
      kw, id: `kw-${i}`,
      a0: selArc.a0 + i * step,
      a1: selArc.a0 + (i + 1) * step,
    }));

    const arcGen = d3.arc()
      .innerRadius(innerR + 4).outerRadius(outerR)
      .startAngle(d => d.a0).endAngle(d => d.a1)
      .padAngle(0.003).padRadius(innerR + 4);

    const g = layer.append('g').attr('transform', `translate(${cx},${cy})`);

    g.selectAll('path').data(kwData).join('path')
      .attr('d', arcGen)
      .attr('fill', colorScale(selectedId))
      .attr('fill-opacity', 0.45)
      .attr('stroke', '#0f172a').attr('stroke-width', 0.4)
      .attr('pointer-events', 'none');

    const minSpan = 0.035;
    g.selectAll('text').data(kwData.filter(d => (d.a1 - d.a0) > minSpan)).join('text')
      .attr('transform', d => {
        const mid  = (d.a0 + d.a1) / 2 - Math.PI / 2;
        const midR = (innerR + 4 + outerR) / 2;
        const flip = (mid > 0 && mid < Math.PI) ? 180 : 0;
        return `rotate(${mid * 180 / Math.PI}) translate(${midR},0) rotate(${flip})`;
      })
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', '6px').attr('font-weight', '500')
      .attr('fill', '#e2e8f0')
      .attr('paint-order', 'stroke').attr('stroke', '#0f172a')
      .attr('stroke-width', '2px').attr('stroke-linejoin', 'round')
      .attr('pointer-events', 'none')
      .text(d => d.kw.length > 10 ? d.kw.slice(0, 9) + '…' : d.kw);
  }

  // ── Style-only updater (no redraw) ────────────────────────────────────────────
  function updateStyles() {
    if (!svgEl || !_layout) return;
    const { rootArcs, coarseArcs, fineArcs } = _layout;
    const allArcs = [...rootArcs, ...coarseArcs, ...fineArcs];

    const maxR  = Math.min(svgEl.clientWidth || 600, svgEl.clientHeight || 500) * 0.46;
    const holeR = maxR * 0.12, r1 = maxR * 0.28, r2 = maxR * 0.55, r3 = maxR;

    function rootColor(d) {
      const ra = _layout.rootArcs.find(r =>
        d.rootParentId === r.id ||
        (d.coarseParentId && coarseArcs.find(c => c.id === d.coarseParentId)?.rootParentId === r.id)
      );
      return ra ? colorScale(ra.id) : colorScale(d.id);
    }

    function fillOf(d, baseColor) {
      if (selectedId !== null) {
        if (d.id === selectedId) return '#f8c948';
        const arc = findArc(selectedId);
        if (arc) {
          if (d.id === arc.coarseParentId || d.id === arc.rootParentId)
            return d3.color(baseColor).brighter(0.4).toString();
          const selFine = fineArcs.find(f => f.id === selectedId);
          if (selFine && d.coarseParentId === selFine.coarseParentId)
            return d3.color(baseColor).brighter(0.15).toString();
        }
        return d3.color(baseColor).darker(1.2).copy({opacity: 0.25}).toString();
      }
      if (d.id === hoveredId) return d3.color(baseColor).brighter(0.5).toString();
      return baseColor;
    }

    d3.select(svgEl).selectAll('path.arc').each(function(d) {
      const isRoot   = _layout.rootArcs.some(r => r.id === d.id);
      const isCoarse = _layout.coarseArcs.some(c => c.id === d.id);
      const base = isRoot
        ? colorScale(d.id)
        : isCoarse
          ? rootColor(d)
          : d3.color(rootColor(d)).darker(0.3).toString();

      d3.select(this)
        .attr('fill',         fillOf(d, base))
        .attr('fill-opacity', () => {
          if (selectedId !== null) {
            if (d.id === selectedId) return 1;
            const arc = findArc(selectedId);
            if (arc && (d.id === arc.coarseParentId || d.id === arc.rootParentId)) return 0.85;
            const selFine = fineArcs.find(f => f.id === selectedId);
            if (selFine && d.coarseParentId === selFine.coarseParentId) return 0.65;
            return 0.18;
          }
          return d.id === hoveredId ? 0.95 : 0.72;
        })
        .attr('stroke',       d.id === selectedId ? '#fff' : d.id === hoveredId ? '#cbd5e1' : '#0f172a')
        .attr('stroke-width', (d.id === selectedId || d.id === hoveredId) ? 1.5 : 0.4);
    });

    d3.select(svgEl).selectAll('text.lbl')
      .attr('fill',   d => d.id === selectedId ? '#0f172a' : '#e2e8f0')
      .attr('stroke', d => d.id === selectedId ? 'none' : '#0f172a')
      .attr('font-weight', d => d.id === selectedId ? '800' : '600');

    d3.select(svgEl).select('text.c-title')
      .text(selectedId !== null ? (findArc(selectedId)?.kws[0] ?? String(selectedId)) : 'Sunburst');
    d3.select(svgEl).select('text.c-count')
      .text(selectedId !== null ? `${displayKws.length} kw` : `${fineArcs.length} fine`);
  }

  // ── Dendrogram ────────────────────────────────────────────────────────────────
  function updateDendroStyles() {
    if (!dendroEl) return;
    d3.select(dendroEl).selectAll('path.link')
      .attr('stroke', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        return selectedId === null ? '#334155' : ids.includes(selectedId) ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        return selectedId === null ? 1 : ids.includes(selectedId) ? 2 : 0.8;
      });
    d3.select(dendroEl).selectAll('circle.leaf')
      .attr('fill',   d => selectedId === d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => selectedId === d.data.id ? '#fff' : hoveredId === d.data.id ? '#cbd5e1' : 'none');
  }

  function drawDendrogram(el) {
    if (!el) return;
    const W = el.clientWidth || 400, H = el.clientHeight || 220;
    const m = { top: 14, right: 64, bottom: 10, left: 38 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;

    const root = d3.hierarchy(TREE, n => n.children);
    d3.cluster().size([iw, ih])(root);
    const yS = d3.scaleLinear().domain([0, maxDist]).range([ih, 0]);
    root.each(n => { n.y = yS(n.data.dist ?? 0); });

    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    g.append('g').call(d3.axisLeft(yS).ticks(5).tickSize(-iw))
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').attr('stroke', '#1e3a5f').attr('stroke-dasharray', '2,3');
        ax.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '9px');
      });

    g.selectAll('path.link').data(root.links()).join('path').attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        return selectedId === null ? '#334155' : ids.includes(selectedId) ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        return selectedId === null ? 1 : ids.includes(selectedId) ? 2 : 0.8;
      })
      .attr('d', d => `M${d.source.x},${d.source.y}H${d.target.x}V${d.target.y}`);

    const lvs = root.leaves();
    g.selectAll('circle.leaf').data(lvs).join('circle').attr('class', 'leaf')
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 4)
      .attr('fill',   d => selectedId === d.data.id ? '#f8c948' : colorScale(d.data.id))
      .attr('stroke', d => selectedId === d.data.id ? '#fff' : hoveredId === d.data.id ? '#cbd5e1' : 'none')
      .attr('stroke-width', 1.5).style('cursor', 'pointer')
      .on('mouseenter', (_, d) => { hoveredId = d.data.id; updateDendroStyles(); })
      .on('mouseleave', ()     => { hoveredId = null;       updateDendroStyles(); })
      .on('click', (_, d) => {
        selectedId = String(selectedId) === String(d.data.id) ? null : d.data.id;
        showKwRing = selectedId !== null;
        updateStyles();
        updateDendroStyles();
        if (svgEl && _layout) {
          const maxR = Math.min(svgEl.clientWidth || 600, svgEl.clientHeight || 500) * 0.46;
          drawKwRing(svgEl, (svgEl.clientWidth || 600) / 2, (svgEl.clientHeight || 500) / 2, maxR, maxR * 1.22);
        }
      });

    if (selectedId !== null) {
      const s = lvs.find(l => l.data.id === selectedId);
      if (s) g.append('text').attr('x', s.x).attr('y', s.y + 13)
        .attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#f8c948')
        .text(s.data.id);
    }

    // ── Right rail (level snap indicators) ───────────────────────────────────
    const LEVEL_LABELS = ['Keywords', 'Fine', 'Coarse', 'Root'];
    const snapPYs = LEVEL_THRESHOLDS.map(d => d === null ? ih : yS(d));
    const rail = g.append('g').attr('class', 'rail');
    rail.append('line')
      .attr('x1', iw + 10).attr('x2', iw + 10)
      .attr('y1', snapPYs.at(-1)).attr('y2', snapPYs[0])
      .attr('stroke', '#1e3a5f').attr('stroke-width', 1);

    LEVEL_THRESHOLDS.forEach((_, lvl) => {
      const py = snapPYs[lvl];
      const grp = rail.append('g').attr('cursor', 'pointer');
      grp.append('rect')
        .attr('x', iw + 6).attr('y', py - 4).attr('width', 8).attr('height', 8)
        .attr('transform', `rotate(45,${iw + 10},${py})`)
        .attr('fill', '#1e3a5f').attr('stroke', '#475569').attr('stroke-width', 1);
      grp.append('text').attr('x', iw + 22).attr('y', py + 3.5)
        .attr('font-size', '9px').attr('fill', '#64748b').text(LEVEL_LABELS[lvl]);
      grp.append('rect').attr('x', iw + 4).attr('y', py - 8)
        .attr('width', m.right - 4).attr('height', 16).attr('fill', 'transparent');
    });

    // ── Threshold guide lines on the dendrogram ───────────────────────────────
    [1, 2, 3].forEach(lvl => {
      const py = snapPYs[lvl];
      g.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', py).attr('y2', py)
        .attr('stroke', '#1e3a5f').attr('stroke-dasharray', '4,3').attr('stroke-width', 0.8);
    });
  }

  // ── Effects & mount ───────────────────────────────────────────────────────────
  $effect(() => {
    // track state to re-trigger
    const _s = selectedId, _h = hoveredId;
    if (svgEl)    drawSunburst(svgEl);
    if (dendroEl) drawDendrogram(dendroEl);
  });

  onMount(() => {
    if (svgEl)    drawSunburst(svgEl);
    if (dendroEl) drawDendrogram(dendroEl);
    const ro = new ResizeObserver(() => {
      if (svgEl)    drawSunburst(svgEl);
      if (dendroEl) drawDendrogram(dendroEl);
    });
    [svgEl, dendroEl].forEach(el => el && ro.observe(el));
    return () => ro.disconnect();
  });
</script>

<style>
  .page        { display:flex; height:100%; gap:10px; padding:10px; }
  .panel       { background:#1e293b; border:1px solid #334155; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  .panel-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:8px 14px 6px; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .panel-body  { flex:1; overflow:hidden; }
  .panel-body svg { display:block; width:100%; height:100%; }
  .left        { flex:0 0 62%; }
  .right       { flex:1; display:flex; flex-direction:column; gap:10px; }
  .right .panel { flex:1; }
  .kw-panel    { flex:0 0 34% !important; }
  .list-sub    { padding:5px 14px; font-size:11px; color:#94a3b8; border-bottom:1px solid #1e3a5f; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .kw-list     { flex:1; overflow-y:auto; padding:6px 10px; }
  .kw-list::-webkit-scrollbar       { width:4px; }
  .kw-list::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
  .chip        { display:inline-block; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:3px 10px; margin:3px; font-size:11px; color:#94a3b8; transition:all .12s; }
  .chip:hover  { background:#1e40af; border-color:#3b82f6; color:#fff; }
  .empty       { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#334155; font-size:12px; gap:6px; }
  .legend      { display:flex; gap:8px; padding:4px 14px; font-size:9px; color:#475569; align-items:center; border-bottom:1px solid #1e3a5f; flex-shrink:0; }
  .legend-item { display:flex; align-items:center; gap:4px; }
  .dot         { width:8px; height:8px; border-radius:50%; }

  /* Light theme overrides */
  .panel { background:#ffffff; border-color:#d6deea; }
  .panel-title { color:#334155; border-bottom-color:#dbe4ef; }
  .list-sub { color:#475569; border-bottom-color:#dbe4ef; }
  .legend { border-bottom-color:#dbe4ef; color:#475569; }
  .kw-list::-webkit-scrollbar-thumb { background:#c9d5e5; }
  .chip { background:#ffffff; border-color:#c9d5e5; color:#475569; }
  .chip:hover { background:#e8f0fe; border-color:#93c5fd; color:#1e3a8a; }
</style>

<div class="page">
  <div class="panel left">
    <div class="panel-title">
      Sunburst hierarchy — Root (inner) → Coarse → Fine → Keywords (on click)
    </div>
    <div class="legend">
      <div class="legend-item"><div class="dot" style="background:#475569"></div> Root (2)</div>
      <div class="legend-item"><div class="dot" style="background:#64748b;opacity:.8"></div> Coarse (47)</div>
      <div class="legend-item"><div class="dot" style="background:#94a3b8;opacity:.6"></div> Fine (88)</div>
      <div class="legend-item"><div class="dot" style="background:#f8c948;opacity:.5"></div> Keywords (click fine arc)</div>
    </div>
    <div class="panel-body"><svg bind:this={svgEl}></svg></div>
  </div>

  <div class="right">
    <div class="panel">
      <div class="panel-title">Dendrogram</div>
      <div class="panel-body"><svg bind:this={dendroEl}></svg></div>
    </div>
    <div class="panel kw-panel">
      <div class="panel-title">Keywords</div>
      <div class="list-sub">{listTitle}</div>
      <div class="kw-list">
        {#if displayKws.length > 0}
          {#each displayKws as kw}<span class="chip">{kw}</span>{/each}
        {:else}
          <div class="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Click a fine arc for keywords
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
