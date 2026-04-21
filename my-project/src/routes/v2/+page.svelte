<!-- Bubble chart — /v2 -->
<script>
  import { onMount, untrack } from 'svelte';
  import * as d3 from 'd3';
  import { clusterKeywords, TREE, aggClusters, colorScale } from '$lib/data.js';

  function splitBigram(kw) {
    const raw = String(kw ?? '').trim();
    const normalized = raw.includes(' ') ? raw : raw.replace(/[_-]+/g, ' ');
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.length === 2 ? parts : null;
  }

  let currentLevel = $state(1);
  let selectedId = $state(null);
  let hoveredId = $state(null);
  let svgEl = $state(null);
  let dendroEl = $state(null);
  let showDendro = $state(false);


  const LEVEL_LABELS = ['Keywords', 'Fine', 'Mid', 'Coarse'];
  const LEVEL_ICONS  = ['⬤', '◉', '◎', '○'];

  function onLevelChange(lvl) {
    currentLevel = lvl;
    selectedId = null;
    hoveredId = null;
  }

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

  const allDists = [...new Set(collectMergeDistances(TREE))].sort((a, b) => a - b);
  const maxDist = TREE.dist ?? allDists.at(-1) ?? 1;
  const quantileDist = q => allDists[Math.max(0, Math.floor(q * (allDists.length - 1)))];
  const LEVEL_THRESHOLDS = [null, quantileDist(0.25), quantileDist(0.60), quantileDist(0.92)];

  function buildLevelClusters(level) {
    if (level === 0) return [];
    const superNodes = cutTree(TREE, LEVEL_THRESHOLDS[level]);
    return superNodes.map((sn, i) => {
      const ids = leafIds(sn);
      const bases = aggClusters.filter(a => ids.includes(a.id));
      const kwcount = bases.reduce((s, a) => s + (a.kwcount ?? 0), 0) || ids.length;
      const cx = bases.length ? d3.mean(bases, a => a.cx) : 0;
      const cy = bases.length ? d3.mean(bases, a => a.cy) : 0;
      const kws = ids.flatMap(id => clusterKeywords[id] ?? []);
      return {
        id: ids[0], superIdx: i, ids, kwcount, cx, cy, kws,
        label: ids.length > 1 ? `[${ids.join(',')}]` : String(ids[0]),
      };
    });
  }

  // Palette anchored at Coarse level (level 3) — must have at least as many entries
  // as there are Coarse clusters so every top-level cluster gets a unique color.
  const COARSE_PALETTE = [
    '#e6194b','#3cb44b','#4363d8','#f58231','#911eb4',
    '#42d4f4','#f032e6','#bfef45','#fabed4','#469990',
    '#dcbeff','#9A6324','#fffac8','#800000','#aaffc3',
    '#808000','#ffd8b1','#000075','#a9a9a9','#ffffff',
    '#000000','#e6beff','#008080','#aa6e28','#fffac8',
  ];

  // Maps every aggCluster leaf id → its Coarse-level color
  let colorById = new Map();

  function initHierarchyColors() {
    colorById = new Map();
    // Assign one unique color per Coarse cluster (level 3), then propagate
    // that color down to every leaf id contained within it.
    const coarse = buildLevelClusters(3).sort((a, b) => a.id - b.id);
    coarse.forEach((cc, idx) => {
      const color = COARSE_PALETTE[idx % COARSE_PALETTE.length];
      cc.ids.forEach(id => colorById.set(id, color));
    });
  }

  // Resolve color for any cluster at any level via its leaf ids
  function clusterColor(id) {
    const cluster = levelClusters.find(c => c.id === id);
    if (!cluster) return colorScale(id);
    return colorById.get(cluster.ids[0]) ?? colorScale(id);
  }

  function buildKeywordDots() {
    const dots = [];
    const rng = d3.randomNormal.source(d3.randomLcg(42))(0, 0.18);
    aggClusters.forEach(cl => {
      (clusterKeywords[cl.id] ?? []).forEach((kw) => {
        dots.push({ kw, clusterId: cl.id, cx: cl.cx + rng(), cy: cl.cy + rng() });
      });
    });
    return dots;
  }
  const kwDots = buildKeywordDots();

  let levelClusters = $derived(buildLevelClusters(currentLevel));

  let activeSC = $derived(
    currentLevel === 0
      ? null
      : levelClusters.find(c => c.id === (selectedId ?? hoveredId)) ?? null
  );
  let displayKws = $derived(
    currentLevel === 0
      ? (hoveredId !== null ? (clusterKeywords[hoveredId] ?? []) : [])
      : (activeSC ? activeSC.kws : [])
  );
  let listTitle = $derived(
    currentLevel === 0
      ? (hoveredId !== null ? `Cluster ${hoveredId} keywords` : 'Hover a dot to see its cluster')
      : activeSC
        ? `${activeSC.label} — ${displayKws.length} keywords`
        : 'Click a bubble to see keywords'
  );

  function makeScales(W, H, pad = 0.7) {
    const allX = aggClusters.map(d => d.cx);
    const allY = aggClusters.map(d => d.cy);
    const xExt = d3.extent(allX), yExt = d3.extent(allY);
    return {
      xS: d3.scaleLinear().domain([xExt[0]-pad, xExt[1]+pad]).range([40, W-40]),
      yS: d3.scaleLinear().domain([yExt[0]-pad, yExt[1]+pad]).range([H-40, 40]),
    };
  }

  let simulation = null;
  let _nodes = [];
  let _subSim = null;

  function drawBubble(el) {
    if (!el) return;
    if (currentLevel === 0) { drawKeywordDots(el); return; }

    const clusters = levelClusters;

    // Build a parentId for every node at every level (except the top level 3).
    // parentId = the id of the cluster at (currentLevel+1) that contains this node.
    const parentById = new Map();
    if (currentLevel < 3) {
      buildLevelClusters(currentLevel + 1).forEach(parent => {
        parent.ids.forEach(id => parentById.set(id, parent.id));
      });
    }

    const W = el.clientWidth || 600, H = el.clientHeight || 500;
    const { xS, yS } = makeScales(W, H);

    const maxKw = d3.max(clusters, d => d.kwcount) || 1;
    const maxR  = Math.min(W, H) * 0.085;
    const rOf   = d => Math.max(6, maxR * Math.sqrt(d.kwcount / maxKw));

    _nodes = clusters.map(d => ({
      ...d,
      parentId: parentById.get(d.id) ?? d.id,
      r:  rOf(d),
      tx: xS(d.cx),
      ty: yS(d.cy),
      x:  xS(d.cx),
      y:  yS(d.cy),
    }));

    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const circles = svg.selectAll('circle.bubble').data(_nodes, d=>d.id).join('circle')
      .attr('class','bubble')
      .attr('r', d => d.r)
      .attr('fill', d => selectedId===d.id ? '#f8c948' : clusterColor(d.id))
      .attr('opacity', d => { if(selectedId!==null) return selectedId===d.id?1:0.2; return hoveredId===d.id?1:0.72; })
      .attr('stroke', d => selectedId===d.id?'#fff':hoveredId===d.id?'#cbd5e1':'none')
      .attr('stroke-width',1.5).style('cursor','pointer')
      .on('mouseenter', (event,d) => { hoveredId = d.id; updateBubbleStyles(); showBubbleTooltip(svg, d, event); })
      .on('mousemove',  (event,d) => { moveBubbleTooltip(svg, event); })
      .on('mouseleave', () => { hoveredId = null; updateBubbleStyles(); hideBubbleTooltip(svg); })
      .on('click', (_,d) => {
        selectedId = selectedId===d.id ? null : d.id;
        hoveredId = null;
        updateBubbleStyles();
        updateDendroStyles();
        drawSubLevel(el);
      });

    const labels = svg.selectAll('text.blbl').data(_nodes, d=>d.id).join('text')
      .attr('class','blbl')
      .attr('text-anchor','middle')
      .attr('font-size', d => d.r > 18 ? '9px' : d.r > 11 ? '7.5px' : '6.5px')
      .attr('fill', '#000000')
      .attr('font-weight','600')
      .attr('pointer-events','none')
      .each(function(d) {
        const g = d3.select(this);
        g.selectAll('tspan').remove();
        if (d.r < 8) return;
        const top = d.kws[0] ?? String(d.id);
        const bg = splitBigram(top);
        const maxChars = Math.max(3, Math.floor(d.r * 0.38));
        const ell = top.length > maxChars ? top.slice(0, maxChars - 1) + '\u2026' : top;
        if (bg) {
          g.append('tspan').attr('class', 'lbl-line lbl-top').text(bg[0]);
          g.append('tspan').attr('class', 'lbl-line lbl-bot').text(bg[1]);
        } else {
          g.append('tspan').attr('class', 'lbl-line lbl-one').text(ell);
        }
      });

    function positionBlblLabels() {
      labels.each(function(d) {
        const g = d3.select(this);
        if (d.r < 8) return;
        const x = Math.round(d.x * 2) / 2;
        const y = Math.round(d.y * 2) / 2;
        const top = d.kws[0] ?? String(d.id);
        const bg = splitBigram(top);
        const gap = Math.max(3, Math.min(7, d.r * 0.15));
        if (bg) {
          g.select('.lbl-top').attr('x', x).attr('y', y - gap);
          g.select('.lbl-bot').attr('x', x).attr('y', y + gap);
        } else {
          g.select('.lbl-one').attr('x', x).attr('y', y + 3);
        }
      });
    }
    positionBlblLabels();

    svg.append('g').attr('class', 'sublevel-layer');

    if (simulation) simulation.stop();

    // Compute the centroid of each parent group in target (data) space
    // so we can attract siblings toward each other.
    const parentCenters = new Map();
    if (currentLevel < 3) {
      d3.group(_nodes, d => d.parentId).forEach((groupNodes, parentId) => {
        parentCenters.set(parentId, {
          x: d3.mean(groupNodes, n => n.tx) ?? 0,
          y: d3.mean(groupNodes, n => n.ty) ?? 0
        });
      });
    }

    // OVERLAP: same-parent bubbles may overlap slightly (negative padding).
    // SEPARATION: different-parent bubbles are pushed apart by an extra gap.
    const OVERLAP   =  4;   // px same-parent bubbles overlap
    const SEP_GAP   = 24;   // px minimum gap between different-parent bubbles
    const SEP_STR   = 0.35; // separation force strength

    simulation = d3.forceSimulation(_nodes)
      .force('x', d3.forceX(d => d.tx).strength(0.10))
      .force('y', d3.forceY(d => d.ty).strength(0.10))
      // Pull siblings toward their shared parent centroid
      .force('groupX', currentLevel < 3
        ? d3.forceX(d => parentCenters.get(d.parentId)?.x ?? d.tx).strength(0.22)
        : null)
      .force('groupY', currentLevel < 3
        ? d3.forceY(d => parentCenters.get(d.parentId)?.y ?? d.ty).strength(0.22)
        : null)
      // Collide: same-parent pairs use (r - overlap) so they can touch/overlap;
      // different-parent pairs use a larger radius handled by 'separate' below,
      // so here we just prevent same-parent bubbles from fully clipping through.
      .force('collide', d3.forceCollide(d => d.r - OVERLAP / 2).strength(0.9).iterations(4))
      // Separate: push different-parent bubbles apart
      .force('separate', currentLevel < 3 ? (() => {
        for (let i = 0; i < _nodes.length; i++) {
          for (let j = i + 1; j < _nodes.length; j++) {
            const a = _nodes[i], b = _nodes[j];
            if (a.parentId === b.parentId) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r + SEP_GAP;
            if (dist < minDist && dist > 0) {
              const f = (minDist - dist) / dist * SEP_STR;
              a.x -= dx * f;
              a.y -= dy * f;
              b.x += dx * f;
              b.y += dy * f;
            }
          }
        }
      }) : null)
      .force('boundary', () => {
        for (const n of _nodes) {
          n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
          n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
        }
      })
      .alphaDecay(0.05)
      .alphaMin(0.03)
      .velocityDecay(0.6)
      .on('tick', () => {
        circles.attr('cx', d => Math.round(d.x * 2) / 2).attr('cy', d => Math.round(d.y * 2) / 2);
        positionBlblLabels();
      })
      .on('end', () => {
        _nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
        drawSubLevel(el);
      });

    circles.call(
      d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end',   (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = d.x; d.fy = d.y;
        })
    );
  }

  function drawSubLevel(el) {
    if (_subSim) { _subSim.stop(); _subSim = null; }

    const svg   = d3.select(el);
    const layer = svg.select('g.sublevel-layer');
    layer.selectAll('*').remove();
    svg.selectAll('defs.sublevel-defs').remove();

    if (selectedId === null) return;

    const selNode = _nodes.find(n => n.id === selectedId);
    if (!selNode) return;

    const cx = selNode.x, cy = selNode.y, R = selNode.r;
    const clipId = `clip-sublevel-${selNode.id}`;

    const defs = svg.append('defs').attr('class', 'sublevel-defs');
    defs.append('clipPath').attr('id', clipId)
      .append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', R - 1.5);

    const grp = layer.append('g')
      .attr('clip-path', `url(#${clipId})`)
      .attr('pointer-events', 'none');

    if (currentLevel === 1) {
      const kws = clusterKeywords[selNode.id] ?? [];
      if (!kws.length) return;

      const dotR  = Math.max(2, Math.min(4, (R * 0.72) / Math.sqrt(kws.length)));
      const inner = R - dotR - 2;

      const dotData = kws.map((kw, i) => {
        const angle = i * 2.399963;
        const r     = inner * Math.sqrt((i + 0.5) / kws.length);
        return { kw, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), r: dotR };
      });

      grp.selectAll('circle').data(dotData).join('circle')
        .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
        .attr('fill', '#e2e8f0').attr('opacity', 0.75);

      if (kws.length <= 24) {
        grp.selectAll('text').data(dotData).join('text')
          .attr('x', d => d.x + d.r + 1.5).attr('y', d => d.y + 3.5)
          .attr('font-size', `${Math.max(5, Math.min(7, dotR * 1.7))}px`)
          .attr('fill', '#e2e8f0')
          .text(d => d.kw);
      }

    } else if (currentLevel === 2 || currentLevel === 3) {
      // Level 2 (Mid): show Fine sub-clusters inside the selected Mid bubble
      // Level 3 (Coarse): show Mid sub-clusters inside the selected Coarse bubble
      const childLevel   = currentLevel - 1;
      const childClusters = buildLevelClusters(childLevel);
      const subClusters   = childClusters.filter(cc =>
        selNode.ids.some(id => cc.ids.includes(id))
      );
      if (!subClusters.length) return;

      const totalArea = Math.PI * R * R * 0.78;
      const sumKw     = subClusters.reduce((s, d) => s + d.kwcount, 0) || subClusters.length;
      const areaPerKw = totalArea / sumKw;
      const rOfSub    = d => Math.max(5, Math.sqrt((d.kwcount || 1) * areaPerKw / Math.PI));

      // Seed positions spread around the parent centre so the simulation
      // converges faster and sub-bubbles don't all start on top of each other.
      const angleStep = (2 * Math.PI) / subClusters.length;
      const subNodes  = subClusters.map((sc, i) => {
        const r0 = R * 0.35;
        return {
          ...sc,
          r: rOfSub(sc),
          x: cx + r0 * Math.cos(i * angleStep),
          y: cy + r0 * Math.sin(i * angleStep),
        };
      });

      const subCircles = grp.selectAll('circle.sub-bubble').data(subNodes).join('circle')
        .attr('class', 'sub-bubble')
        .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
        .attr('fill', d => colorById.get(d.ids[0]) ?? colorScale(d.id))
        .attr('opacity', 0.72)
        .attr('stroke', 'rgba(0,0,0,0.35)').attr('stroke-width', 0.8);

      const subLabels = grp.selectAll('text.sub-lbl').data(subNodes).join('text')
        .attr('class', 'sub-lbl')
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('font-size', d => `${Math.max(5.5, Math.min(9, d.r * 0.55))}px`)
        .attr('fill', '#000')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text(d => d.r > 8 ? (d.kws[0] ?? d.id) : '');

      _subSim = d3.forceSimulation(subNodes)
        .force('x',       d3.forceX(cx).strength(0.10))
        .force('y',       d3.forceY(cy).strength(0.10))
        .force('collide', d3.forceCollide(d => d.r + 1.5).strength(1).iterations(6))
        .force('contain', () => {
          for (const n of subNodes) {
            const maxR = R - n.r - 2;
            const dist = Math.hypot(n.x - cx, n.y - cy);
            if (dist > maxR && dist > 0) {
              const scale = maxR / dist;
              n.x = cx + (n.x - cx) * scale;
              n.y = cy + (n.y - cy) * scale;
            }
          }
        })
        .alphaDecay(0.04)
        .on('tick', () => {
          subCircles.attr('cx', d => d.x).attr('cy', d => d.y);
          subLabels .attr('x',  d => d.x).attr('y',  d => d.y);
        })
        .on('end', () => {
          subNodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
        });
    }
  }

  function drawKeywordDots(el) {
    if (!el) return;
    const W = el.clientWidth || 600, H = el.clientHeight || 500;
    const { xS, yS } = makeScales(W, H);

    const svg = d3.select(el).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    aggClusters.forEach(cl => {
      svg.append('circle')
        .attr('cx', xS(cl.cx)).attr('cy', yS(cl.cy))
        .attr('r', 18)
        .attr('fill', colorScale(cl.id))
        .attr('opacity', 0.06)
        .attr('pointer-events', 'none');
    });

    const dots = kwDots.map(d => ({ ...d, px: xS(d.cx), py: yS(d.cy) }));

    svg.selectAll('circle.kwdot').data(dots).join('circle')
      .attr('class','kwdot')
      .attr('cx', d => d.px)
      .attr('cy', d => d.py)
      .attr('r', 3)
      .attr('fill', d => colorScale(d.clusterId))
      .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0.55)
      .attr('stroke', d => hoveredId === d.clusterId ? '#fff' : 'none')
      .attr('stroke-width', 0.8)
      .style('cursor', 'default')
      .on('mouseenter', (_, d) => { hoveredId = d.clusterId; updateDotStyles(); })
      .on('mouseleave', ()     => { hoveredId = null;        updateDotStyles(); });

    svg.append('g').attr('class','kwlabels').selectAll('text').data(dots).join('text')
      .attr('class','kwtext')
      .attr('x', d => d.px + 4).attr('y', d => d.py + 3)
      .attr('font-size','7px').attr('fill', '#94a3b8').attr('pointer-events', 'none')
      .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0)
      .text(d => d.kw);
  }

  function showBubbleTooltip(svg, d, event) {
    const fullLabel = d.kws[0] ?? String(d.id);
    const maxChars = Math.max(3, Math.floor(d.r * 0.38));
    const isTruncated = fullLabel.length > maxChars;
    if (!isTruncated) { hideBubbleTooltip(svg); return; }

    const pad = 6, fontSize = 11;
    let tip = svg.select('g.bubble-tooltip');
    if (tip.empty()) {
      tip = svg.append('g').attr('class', 'bubble-tooltip').attr('pointer-events', 'none');
      tip.append('rect').attr('rx', 4).attr('ry', 4);
      tip.append('text').attr('dominant-baseline', 'middle').attr('font-size', `${fontSize}px`).attr('font-weight', '600');
    }

    const tipH = fontSize + pad * 2;
    const approxW = fullLabel.length * fontSize * 0.6 + pad * 2;
    tip.select('rect')
      .attr('width', approxW).attr('height', tipH)
      .attr('fill', '#1e293b').attr('stroke', '#475569').attr('stroke-width', 1).attr('opacity', 0.95);
    tip.select('text').text(fullLabel).attr('x', pad).attr('y', tipH / 2).attr('fill', '#f1f5f9');

    tip.style('display', null);
    moveBubbleTooltip(svg, event);
  }

  function moveBubbleTooltip(svg, event) {
    const tip = svg.select('g.bubble-tooltip');
    if (tip.empty() || tip.style('display') === 'none') return;
    const [mx, my] = d3.pointer(event, svg.node());
    const svgW = svg.node().clientWidth, svgH = svg.node().clientHeight;
    const tipW = parseFloat(tip.select('rect').attr('width'));
    const tipH = parseFloat(tip.select('rect').attr('height'));
    const offset = 14;
    let tx = mx + offset;
    let ty = my - tipH / 2;
    if (tx + tipW > svgW - 4) tx = mx - tipW - offset;
    if (ty < 4) ty = 4;
    if (ty + tipH > svgH - 4) ty = svgH - tipH - 4;
    tip.attr('transform', `translate(${tx},${ty})`).raise();
  }

  function hideBubbleTooltip(svg) {
    svg.select('g.bubble-tooltip').style('display', 'none');
  }

  function updateBubbleStyles() {
    if (!svgEl || currentLevel === 0) return;
    // Never change 'r' here — that would nudge fixed nodes and restart the simulation
    d3.select(svgEl).selectAll('circle.bubble')
      .attr('fill', d => selectedId===d.id ? '#f8c948' : clusterColor(d.id))
      .attr('opacity', d => { if(selectedId!==null) return selectedId===d.id?1:0.2; return hoveredId===d.id?1:0.72; })
      .attr('stroke', d => selectedId===d.id?'#fff':hoveredId===d.id?'#cbd5e1':'none')
      .attr('stroke-width', d => hoveredId===d.id ? 2 : 1.5);
    d3.select(svgEl).selectAll('text.blbl')
      .attr('fill', '#000000')
      .attr('font-weight', d => selectedId===d.id?'bold':'normal');
  }

  function updateDotStyles() {
    if (!svgEl || currentLevel !== 0) return;
    d3.select(svgEl).selectAll('circle.kwdot')
      .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0.55)
      .attr('stroke', d => hoveredId === d.clusterId ? '#fff' : 'none');
    d3.select(svgEl).selectAll('text.kwtext')
      .attr('opacity', d => hoveredId === d.clusterId ? 1 : 0);
  }

  function updateDendroStyles() {
    if (!dendroEl) return;
    d3.select(dendroEl).selectAll('path.link')
      .attr('stroke', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return '#334155';
        return ids.includes(selectedId) ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return 1;
        return ids.includes(selectedId) ? 2 : 0.8;
      });
    d3.select(dendroEl).selectAll('circle.leaf')
      .attr('fill', d => selectedId===d.data.id ? '#f8c948' : (colorById.get(d.data.id) ?? colorScale(d.data.id)))
      .attr('stroke', d => {
        if (selectedId!==null) return selectedId===d.data.id?'#fff':'none';
        return hoveredId===d.data.id?'#cbd5e1':'none';
      });
  }

  function drawDendrogram(el) {
    if (!el) return;
    const W = el.clientWidth || 400, H = el.clientHeight || 220;
    const m = { top:14, right:64, bottom:10, left:38 };
    const iw = W-m.left-m.right, ih = H-m.top-m.bottom;

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
        ax.selectAll('.tick line').attr('stroke','#1e3a5f').attr('stroke-dasharray','2,3');
        ax.selectAll('.tick text').attr('fill','#475569').attr('font-size','9px');
      });

    g.selectAll('path.link').data(root.links()).join('path').attr('class','link')
      .attr('fill','none')
      .attr('stroke', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return '#334155';
        return ids.includes(selectedId) ? '#f8c948' : '#1e3a5f';
      })
      .attr('stroke-width', d => {
        const ids = d.target.leaves().map(l => l.data.id);
        if (selectedId === null) return 1;
        return ids.includes(selectedId) ? 2 : 0.8;
      })
      .attr('d', d => `M${d.source.x},${d.source.y}H${d.target.x}V${d.target.y}`);

    const lvs = root.leaves();
    g.selectAll('circle.leaf').data(lvs).join('circle').attr('class','leaf')
      .attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',4)
      .attr('fill',d => selectedId===d.data.id?'#f8c948':(colorById.get(d.data.id) ?? colorScale(d.data.id)))
      .attr('stroke',d => {
        if(selectedId!==null) return selectedId===d.data.id?'#fff':'none';
        return hoveredId===d.data.id?'#cbd5e1':'none';
      })
      .attr('stroke-width',1.5).style('cursor','pointer')
      .on('mouseenter',(_,d)=>{ hoveredId=d.data.id; updateDotStyles(); })
      .on('mouseleave',()=>{ hoveredId=null; updateDotStyles(); })
      .on('click',(_,d)=>{
        selectedId = String(selectedId)===String(d.data.id) ? null : d.data.id;
        updateBubbleStyles();
        updateDendroStyles();
        drawSubLevel(svgEl);
      });

    if (selectedId !== null) {
      const s = lvs.find(l => l.data.id === selectedId);
      if (s) g.append('text').attr('x',s.x).attr('y',s.y+13)
        .attr('text-anchor','middle').attr('font-size','8px').attr('fill','#f8c948').text(s.data.id);
    }

    const snapPYs = LEVEL_THRESHOLDS.map(d => d === null ? ih : yS(d));
    const rail = g.append('g').attr('class','rail');

    rail.append('line')
      .attr('x1', iw+10).attr('x2', iw+10)
      .attr('y1', snapPYs.at(-1)).attr('y2', snapPYs[0])
      .attr('stroke','#1e3a5f').attr('stroke-width',1);

    LEVEL_THRESHOLDS.forEach((_, lvl) => {
      const py = snapPYs[lvl];
      const isActive = lvl === currentLevel;
      const grp = rail.append('g').attr('cursor','pointer')
        .on('click', () => onLevelChange(lvl));

      grp.append('rect')
        .attr('x', iw+6).attr('y', py-4).attr('width', 8).attr('height', 8)
        .attr('transform', `rotate(45, ${iw+10}, ${py})`)
        .attr('fill', isActive ? '#f8c948' : '#1e3a5f')
        .attr('stroke', isActive ? '#f8c948' : '#475569')
        .attr('stroke-width', 1);

      grp.append('text')
        .attr('x', iw+22).attr('y', py+3.5)
        .attr('font-size','9px')
        .attr('fill', isActive ? '#f8c948' : '#64748b')
        .attr('font-weight', isActive ? 'bold' : 'normal')
        .text(LEVEL_LABELS[lvl]);

      grp.append('rect')
        .attr('x', iw+4).attr('y', py-8)
        .attr('width', m.right-4).attr('height', 16)
        .attr('fill','transparent');
    });

    const initPY = snapPYs[currentLevel];
    const cutG   = g.append('g').attr('class','cut-line').style('cursor','ns-resize');

    const cutLine = cutG.append('line')
      .attr('x1', -8).attr('x2', iw+8)
      .attr('y1', initPY).attr('y2', initPY)
      .attr('stroke','#f8c948').attr('stroke-width', 1.5)
      .attr('stroke-dasharray','5,3');

    const handle = cutG.append('g').attr('transform', `translate(-18, ${initPY})`);
    handle.append('circle').attr('r',7).attr('fill','#f8c948').attr('stroke','#0f172a').attr('stroke-width',1.5);
    handle.append('text').attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size','9px').attr('fill','#0f172a').attr('font-weight','bold').text('↕');

    const cutLabel = cutG.append('text')
      .attr('x', -18).attr('y', initPY-11)
      .attr('text-anchor','middle').attr('font-size','8px').attr('fill','#f8c948')
      .text(LEVEL_LABELS[currentLevel]);

    const cutBand = cutG.append('rect')
      .attr('x',-8).attr('width', iw+16)
      .attr('y', initPY-1).attr('height', 2)
      .attr('fill','#f8c948').attr('opacity', 0.15);

    function moveCutTo(py) {
      cutLine.attr('y1', py).attr('y2', py);
      handle.attr('transform', `translate(-18, ${py})`);
      cutLabel.attr('y', py-11);
      cutBand.attr('y', py-1);
    }

    cutG.call(
      d3.drag()
        .on('start', () => cutG.raise())
        .on('drag', (event) => {
          const py = Math.max(0, Math.min(ih, event.y));
          moveCutTo(py);
          const nearest = snapPYs.reduce((best, sy, i) =>
            Math.abs(sy-py) < Math.abs(snapPYs[best]-py) ? i : best, 0);
          cutLabel.text(LEVEL_LABELS[nearest]);
        })
        .on('end', (event) => {
          const py = Math.max(0, Math.min(ih, event.y));
          const nearest = snapPYs.reduce((best, sy, i) =>
            Math.abs(sy-py) < Math.abs(snapPYs[best]-py) ? i : best, 0);
          moveCutTo(snapPYs[nearest]);
          cutLabel.text(LEVEL_LABELS[nearest]);
          if (nearest !== currentLevel) onLevelChange(nearest);
        })
    );
  }

  $effect(() => {
    // Only re-draw when level or dendro visibility changes.
    // hoveredId / selectedId must NOT be read here — they are handled by
    // updateBubbleStyles() directly, so a hover never triggers a full redraw.
    const _lvl = currentLevel;
    const _tree = showDendro;
    untrack(() => {
      if (svgEl)    drawBubble(svgEl);
      if (showDendro && dendroEl) drawDendrogram(dendroEl);
    });
  });

  onMount(() => {
    initHierarchyColors();
    if (svgEl)    drawBubble(svgEl);
    if (showDendro && dendroEl) drawDendrogram(dendroEl);

    const ro = new ResizeObserver(() => {
      if (svgEl)    drawBubble(svgEl);
      if (showDendro && dendroEl) drawDendrogram(dendroEl);
    });
    [svgEl, dendroEl].forEach(el => el && ro.observe(el));
    return () => { ro.disconnect(); if (simulation) simulation.stop(); if (_subSim) _subSim.stop(); };
  });
</script>

<style>
  .shell {
    display: flex;
    height: 100%;
    min-height: 0;
    gap: 0;
    position: relative;
  }
  .sidebar {
    width: 52px;
    flex-shrink: 0;
    background: #1e293b;
    border-right: 1px solid #1e3a5f;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 0 10px;
    gap: 6px;
    z-index: 1;
  }
  .sidebar-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #334155;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    margin-bottom: 8px;
    user-select: none;
  }
  .lvl-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: transparent;
    color: #475569;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    transition: all 0.15s;
    padding: 0;
  }
  .lvl-btn:hover  { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .lvl-btn.active { border-color: #f8c948; color: #f8c948; background: #1e3a5f; }
  .lvl-btn .icon { font-size: 11px; line-height: 1; }
  .lvl-btn .lbl  { font-size: 7px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; }
  .sidebar-spacer { flex: 1; }
  .main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .main-row {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 10px;
    padding: 10px;
    position: relative;
  }

  .panel { background:#1e293b; border:1px solid #334155; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; }
  .panel-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:8px 14px 6px; border-bottom:1px solid #1e3a5f; flex-shrink:0; display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
  .panel-body  { flex:1; overflow:hidden; }
  .panel-body svg { display:block; width:100%; height:100%; }
  .left  { flex:0 0 62%; }
  .right { flex:1; display:flex; flex-direction:column; gap:10px; }
  .kw-panel { flex:0 0 34% !important; }
  .panel-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .panel-btn {
    height: 20px; border-radius: 6px; border: 1px solid #334155;
    background: transparent; color: #94a3b8; font-size: 10px; padding: 0 8px; cursor: pointer;
  }
  .panel-btn:hover { border-color:#64748b; color:#e2e8f0; background:#0f172a; }
  .tree-toggle {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: transparent;
    color: #475569;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    transition: all 0.15s;
    padding: 0;
  }
  .tree-toggle:hover  { border-color: #64748b; color: #94a3b8; background: #0f172a; }
  .tree-toggle.active { border-color:#f8c948; color:#f8c948; background:#1e3a5f; }
  .tree-toggle .icon { font-size: 14px; line-height: 1; }
  .tree-toggle .lbl  { font-size: 6px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; }
  .dendro-window {
    position: absolute; top: 14px; right: 14px;
    width: 420px; height: 260px;
    background: #1e293b; border: 1px solid #334155; border-radius: 12px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 20;
  }
  .dendro-window.hidden { display:none; }
  .level-badge {
    display: inline-block;
    margin-left: 4px;
    background: #1e3a5f;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 1px 8px;
    font-size: 9px;
    color: #f8c948;
    letter-spacing: 0.06em;
    text-transform: none;
    white-space: nowrap;
  }
  .list-sub { padding:5px 14px; font-size:11px; color:#94a3b8; border-bottom:1px solid #1e3a5f; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .kw-list  { flex:1; overflow-y:auto; padding:6px 10px; }
  .kw-list::-webkit-scrollbar { width:4px; }
  .kw-list::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
  .chip { display:inline-block; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:3px 10px; margin:3px; font-size:11px; color:#94a3b8; transition:all .12s; }
  .chip:hover { background:#1e40af; border-color:#3b82f6; color:#fff; }
  .chip.bigram { white-space:normal; display:inline-flex; flex-direction:column; align-items:center; line-height:1.05; padding:4px 10px; }
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#334155; font-size:12px; gap:6px; }

  /* Light theme overrides */
  .sidebar { background: #eef3f9; border-right-color: #d6deea; }
  .sidebar-label { color: #64748b; }
  .lvl-btn, .tree-toggle { border-color: #c9d5e5; color: #475569; background: #ffffff; }
  .lvl-btn:hover, .tree-toggle:hover { background: #f4f7fb; border-color: #94a3b8; color: #334155; }
  .lvl-btn.active, .tree-toggle.active { background: #fff7db; color: #7c5a00; border-color: #f8c948; }
  .panel { background: #ffffff; border-color: #d6deea; }
  .panel-title { color: #334155; border-bottom-color: #dbe4ef; }
  .level-badge { background: #fff7db; border-color: #f8c948; color: #7c5a00; }
  .list-sub { color: #475569; border-bottom-color: #dbe4ef; }
  .kw-list::-webkit-scrollbar-thumb { background: #c9d5e5; }
  .chip { background: #ffffff; border-color: #c9d5e5; color: #475569; }
  .chip:hover { background: #e8f0fe; border-color: #93c5fd; color: #1e3a8a; }
  .dendro-window { background: #ffffff; border-color: #d6deea; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); }
</style>

<div class="shell">
  <aside class="sidebar">
    <span class="sidebar-label">Granularity</span>
    {#each [...LEVEL_LABELS].reverse() as lbl, i}
      {@const lvl = LEVEL_LABELS.length - 1 - i}
      <button
        type="button"
        class="lvl-btn {currentLevel === lvl ? 'active' : ''}"
        onclick={() => onLevelChange(lvl)}
        title={lbl}
      >
        <span class="icon">{LEVEL_ICONS[lvl]}</span>
        <span class="lbl">{lbl}</span>
      </button>
    {/each}
    <div class="sidebar-spacer"></div>
    <button
      type="button"
      class="tree-toggle {showDendro ? 'active' : ''}"
      onclick={() => (showDendro = !showDendro)}
      title={showDendro ? 'Hide dendrogram' : 'Show dendrogram'}
    >
      <span class="icon">⎇</span>
      <span class="lbl">{showDendro ? 'hide' : 'tree'}</span>
    </button>
  </aside>

  <div class="main">
  <div class="main-row">
  <div class="panel left">
    <div class="panel-title">
      {currentLevel === 0 ? 'Keyword Map — hover to highlight cluster' : 'Cluster Bubble Chart — size ∝ keyword count'}
      <span class="level-badge">{LEVEL_LABELS[currentLevel]}</span>
    </div>
    <div class="panel-body"><svg bind:this={svgEl}></svg></div>
  </div>

  <div class="right">
    <div class="panel kw-panel">
      <div class="panel-title">Keywords</div>
      <div class="list-sub">{listTitle}</div>
      <div class="kw-list">
        {#if displayKws.length > 0}
          {#each displayKws as kw}
            {#if splitBigram(kw)}
              <span class="chip bigram">{splitBigram(kw)[0]}<br />{splitBigram(kw)[1]}</span>
            {:else}
              <span class="chip">{kw}</span>
            {/if}
          {/each}
        {:else}
          <div class="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {currentLevel === 0 ? 'Hover a dot' : 'Select a cluster'}
          </div>
        {/if}
      </div>
    </div>
  </div>
  </div>

  <div class="dendro-window {showDendro ? '' : 'hidden'}">
    <div class="panel-title panel-head">
      <span>Dendrogram — drag ↕ or click level</span>
      <button class="panel-btn" onclick={() => showDendro = false}>Hide</button>
    </div>
    <div class="panel-body"><svg bind:this={dendroEl}></svg></div>
  </div>
  </div>
</div>
