/* Vietflex Terrain Editor - application shell */
(function () {
  'use strict';

  var C = window.VFTerrainCore;
  var IO = window.VFTerrainIO;
  var Edit = window.VFTerrainEdit;
  var OPENMAP_ROOT = 'https://vietflexmap.github.io/openmap';
  var DEM_SOURCE = 'vf-local-dem';
  var DEM_LAYER = 'vf-local-dem-layer';
  var SKETCH_SOURCE = 'vf-editor-sketch';
  var SKETCH_LINE = 'vf-editor-sketch-line';
  var SKETCH_FILL = 'vf-editor-sketch-fill';
  var CONTOUR_SOURCE = 'vf-editor-contours';
  var CONTOUR_LINE = 'vf-editor-contour-line';

  function byId(id) { return document.getElementById(id); }
  function all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  var el = {
    fileInput: byId('file-input'),
    stage: byId('map-stage'),
    crosshair: byId('crosshair'),
    cursorHud: byId('cursor-hud'),
    hudXY: byId('hud-xy'),
    hudZ: byId('hud-z'),
    dropZone: byId('drop-zone'),
    floating: byId('floating-message'),
    documentTitle: byId('document-title'),
    layerList: byId('layer-list'),
    statusMessage: byId('status-message'),
    statusX: byId('status-x'),
    statusY: byId('status-y'),
    statusZ: byId('status-z'),
    statusZoom: byId('status-zoom'),
    statusCrs: byId('status-crs'),
    commandInput: byId('command-input'),
    propName: byId('prop-name'),
    propSize: byId('prop-size'),
    propCrs: byId('prop-crs'),
    propExtent: byId('prop-extent'),
    propResolution: byId('prop-resolution'),
    propNoData: byId('prop-nodata'),
    propRange: byId('prop-range'),
    propMean: byId('prop-mean'),
    propSource: byId('prop-source'),
    opacity: byId('opacity'),
    opacityValue: byId('opacity-value'),
    terrainDot: byId('terrain-contract-dot'),
    terrainStatus: byId('terrain-contract-status'),
    engineSearch: byId('engine-search'),
    engineList: byId('engine-list'),
    about: byId('about-dialog'),
    paletteBackdrop: byId('palette-backdrop'),
    paletteInput: byId('palette-input'),
    paletteResults: byId('palette-results')
  };

  var state = {
    map: null,
    vfMap: null,
    dem: null,
    renderMode: 'elevation',
    tool: 'pan',
    sketch: [],
    sketchHover: null,
    sketchKind: null,
    rectStart: null,
    points: [],
    lines: [],
    polygons: [],
    undo: [],
    redo: [],
    messageTimer: null,
    engineFilter: ''
  };

  var capabilities = [
    ['I/O','Đọc GeoTIFF / COG','browser','open-dem',''],
    ['I/O','Ghi GeoTIFF','browser','save-geotiff',''],
    ['I/O','Đọc/Ghi ASCII Grid','browser','save-asc',''],
    ['I/O','SRTM / remote DEM','adapter','',''],
    ['I/O','Chuyển đổi raster format','adapter','',''],
    ['Raster','Clip theo bounding box','browser','','clip-rect'],
    ['Raster','Clip theo polygon','browser','','clip-poly'],
    ['Raster','Mosaic / Merge DEM','adapter','',''],
    ['Raster','Blend DEM','adapter','',''],
    ['Raster','Resample / Reproject','adapter','',''],
    ['Raster','Fill sinks / Denoise / Smooth','adapter','',''],
    ['Terrain','Slope','browser','render:slope',''],
    ['Terrain','Aspect','browser','render:aspect',''],
    ['Terrain','Hillshade','browser','render:hillshade',''],
    ['Terrain','Contours','browser','contours',''],
    ['Terrain','Curvature / Roughness / TPI / TRI','adapter','',''],
    ['Terrain','TWI / SPI / Relative elevation','adapter','',''],
    ['Hydrology','D8 / D-Infinity / MFD','adapter','',''],
    ['Hydrology','Flow accumulation / Streams','adapter','',''],
    ['Hydrology','Watershed / Basin','adapter','',''],
    ['Hydrology','Simple flood / Surface runoff','adapter','',''],
    ['3D','Terrain 3D / Mesh','adapter','',''],
    ['3D','glTF / STL export','adapter','',''],
    ['3D','Volume / Surface area','adapter','',''],
    ['Visibility','Viewshed','adapter','',''],
    ['Visibility','Solar / Shadow','adapter','',''],
    ['Geomorphology','Peak / Ridge / Valley','adapter','',''],
    ['Geomorphology','Plateau / Plain / Depression','adapter','',''],
    ['Change','Compare DEM / DoD','adapter','',''],
    ['Change','DEM error / checkpoint correction','adapter','',''],
    ['LiDAR','Read/Write LAS/LAZ','adapter','',''],
    ['LiDAR','Ground filter / classification','adapter','',''],
    ['LiDAR','LiDAR → DEM / DSM / CHM','adapter','',''],
    ['Fusion','Interpolate point → DEM','adapter','',''],
    ['Fusion','RGB-D / multi-source fusion','adapter','',''],
    ['Web','DEM tile / streaming','adapter','',''],
    ['Web','Elevation query','browser','','elevation'],
    ['Web','Profile / zonal sample','adapter','',''],
    ['Output','Export CSV samples','browser','save-csv',''],
    ['Output','Print map','browser','print','']
  ];

  function escapeHtml(v) {
    return String(v).replace(/[&<>'"]/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }

  function fmt(v, d) {
    if (d === undefined) d = 3;
    return Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d }) : '—';
  }

  function setStatus(text) {
    el.statusMessage.textContent = text;
  }

  function flash(text, kind) {
    clearTimeout(state.messageTimer);
    el.floating.hidden = false;
    el.floating.className = 'floating-message' + (kind ? ' ' + kind : '');
    el.floating.textContent = text;
    state.messageTimer = setTimeout(function () { el.floating.hidden = true; }, 3500);
  }

  function setBusy(on, text) {
    document.body.classList.toggle('is-busy', !!on);
    if (text) setStatus(text);
  }

  function suffixName(name, suffix) {
    var s = String(name || 'dem');
    var i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) + suffix + s.slice(i) : s + suffix;
  }

  function pushHistory() {
    if (!state.dem) return;
    state.undo.push(C.cloneDem(state.dem));
    if (state.undo.length > 5) state.undo.shift();
    state.redo.length = 0;
  }

  function undo() {
    if (!state.undo.length) return flash('Không còn bước Undo.', 'warn');
    if (state.dem) state.redo.push(C.cloneDem(state.dem));
    state.dem = state.undo.pop();
    demChanged('Undo DEM', true);
  }

  function redo() {
    if (!state.redo.length) return flash('Không còn bước Redo.', 'warn');
    if (state.dem) state.undo.push(C.cloneDem(state.dem));
    state.dem = state.redo.pop();
    demChanged('Redo DEM', true);
  }

  var map = Vietflex.vietflexMap('map', {
    basemap: 'light',
    language: 'vi',
    vietnamReferenceLabels: true,
    center: [16.1, 106.3],
    zoom: 5.2,
    zoomControl: false,
    attributionControl: false
  });

  state.vfMap = map;
  new Vietflex.ZoomControl({ position: 'topleft' }).addTo(map);
  new Vietflex.ScaleControl({ position: 'bottomleft' }).addTo(map);

  map.ready(function (rawMap) {
    state.map = rawMap;

    rawMap.on('mousemove', onMapMove);
    rawMap.on('mouseenter', function () {
      el.crosshair.classList.add('is-visible');
      el.cursorHud.classList.add('is-visible');
    });
    rawMap.on('mouseleave', function () {
      el.crosshair.classList.remove('is-visible');
      el.cursorHud.classList.remove('is-visible');
    });
    rawMap.on('click', onMapClick);
    rawMap.on('dblclick', onMapDoubleClick);
    rawMap.on('zoom', function () {
      el.statusZoom.textContent = 'ZL ' + rawMap.getZoom().toFixed(2);
    });
    rawMap.on('style.load', function () {
      ensureSketchLayers();
      if (state.dem) renderDem(false);
      refreshSketch();
    });

    ensureSketchLayers();
    el.statusZoom.textContent = 'ZL ' + rawMap.getZoom().toFixed(2);
  });

  async function loadFile(file) {
    if (!file) return;

    setBusy(true, 'Đang đọc ' + file.name + '...');
    try {
      state.dem = await IO.open(file);
      state.undo.length = 0;
      state.redo.length = 0;
      demChanged('Đã mở ' + file.name, true);
    } catch (err) {
      console.error(err);
      flash('Không đọc được DEM: ' + err.message, 'error');
      setStatus('ERROR: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  function demChanged(message, fit) {
    if (!state.dem) return;
    state.dem.stats = C.computeStats(state.dem.data, state.dem.nodata);
    updateProperties();
    updateLayerList();
    renderDem(!!fit);
    el.documentTitle.textContent = state.dem.name || 'DEM';
    setStatus(message);
  }

  function updateProperties() {
    var d = state.dem;
    if (!d) return;

    el.propName.textContent = d.name || 'DEM';
    el.propSize.textContent = d.width.toLocaleString() + ' × ' + d.height.toLocaleString() + ' (' + (d.data.byteLength / 1048576).toFixed(1) + ' MB)';
    el.propCrs.value = d.crs || 'LOCAL';
    el.propExtent.textContent = d.bbox.map(function (v) { return fmt(v, 6); }).join(', ');

    var rx = Math.abs((d.bbox[2] - d.bbox[0]) / d.width);
    var ry = Math.abs((d.bbox[3] - d.bbox[1]) / d.height);

    el.propResolution.textContent = fmt(rx, 6) + ' × ' + fmt(ry, 6);
    el.propNoData.textContent = Number.isFinite(d.nodata) ? String(d.nodata) : 'none';
    el.propRange.textContent = fmt(d.stats.min, 2) + ' / ' + fmt(d.stats.max, 2) + ' m';
    el.propMean.textContent = fmt(d.stats.mean, 2) + ' m';
    el.propSource.textContent = d.sourceType || 'DEM';
    el.statusCrs.textContent = (d.crs || 'LOCAL').replace('EPSG:', 'E');
  }

  function updateLayerList() {
    var html = '<div class="layer-row locked"><span class="layer-eye">◉</span><span class="layer-swatch basemap"></span><span class="layer-name">Vietflex OpenMap</span><span class="layer-tag">BASE</span></div>';

    if (state.dem) {
      html += '<div class="layer-row active"><span class="layer-eye">◉</span><span class="layer-swatch"></span><span class="layer-name">' +
        escapeHtml(state.dem.name || 'DEM') + '</span><span class="layer-tag">RASTER</span></div>';
    }

    if (state.points.length || state.lines.length || state.polygons.length) {
      html += '<div class="layer-row sketch"><span class="layer-eye">◉</span><span class="layer-swatch"></span><span class="layer-name">Editor Sketch</span><span class="layer-tag">DRAW</span></div>';
    }

    if (state.map && state.map.getLayer(CONTOUR_LINE)) {
      html += '<div class="layer-row"><span class="layer-eye">◉</span><span class="layer-swatch sketch"></span><span class="layer-name">Contours</span><span class="layer-tag">LINE</span></div>';
    }

    el.layerList.innerHTML = html;
  }

  function removeDemLayer() {
    if (!state.map) return;
    try { if (state.map.getLayer(DEM_LAYER)) state.map.removeLayer(DEM_LAYER); } catch (_) {}
    try { if (state.map.getSource(DEM_SOURCE)) state.map.removeSource(DEM_SOURCE); } catch (_) {}
  }

  function renderDem(fit) {
    if (!state.map || !state.dem) return;

    var corners = C.cornersWgs84(state.dem);
    if (!corners) {
      removeDemLayer();
      return flash('CRS ' + state.dem.crs + ' chưa có phép chiếu sang WGS84. Hãy đặt đúng EPSG trong Properties.', 'warn');
    }

    setBusy(true, 'Đang render ' + state.renderMode + '...');
    setTimeout(function () {
      try {
        var canvas = C.renderCanvas(state.dem, state.renderMode, 1400);
        var url = canvas.toDataURL('image/png');

        removeDemLayer();
        state.map.addSource(DEM_SOURCE, {
          type: 'image',
          url: url,
          coordinates: corners
        });
        state.map.addLayer({
          id: DEM_LAYER,
          type: 'raster',
          source: DEM_SOURCE,
          paint: {
            'raster-opacity': Number(el.opacity.value),
            'raster-resampling': 'linear'
          }
        });

        if (fit) fitDem();
        updateLayerList();
        setStatus(state.renderMode.toUpperCase() + ' · ' + state.dem.width + '×' + state.dem.height + ' · ' + state.dem.crs);
      } catch (err) {
        console.error(err);
        flash('Render lỗi: ' + err.message, 'error');
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  function fitDem() {
    if (!state.map || !state.dem) return;
    var corners = C.cornersWgs84(state.dem);
    if (!corners) return;

    var xs = corners.map(function (p) { return p[0]; });
    var ys = corners.map(function (p) { return p[1]; });

    state.map.fitBounds([
      [Math.min.apply(null, xs), Math.min.apply(null, ys)],
      [Math.max.apply(null, xs), Math.max.apply(null, ys)]
    ], { padding: 50, duration: 450 });
  }

  function setRenderMode(mode) {
    if (!state.dem) return flash('Hãy mở DEM trước.', 'warn');
    state.renderMode = mode;

    all('[data-render]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.render === mode);
    });

    renderDem(false);
  }

  function onMapMove(e) {
    var x = e.point.x;
    var y = e.point.y;
    var z = C.sampleElevation(state.dem, e.lngLat.lng, e.lngLat.lat);

    el.crosshair.style.setProperty('--cx', x + 'px');
    el.crosshair.style.setProperty('--cy', y + 'px');
    el.cursorHud.style.left = Math.min(el.stage.clientWidth - 155, x + 13) + 'px';
    el.cursorHud.style.top = Math.min(el.stage.clientHeight - 48, y + 13) + 'px';

    var text = 'Lon ' + e.lngLat.lng.toFixed(6) + '  Lat ' + e.lngLat.lat.toFixed(6);
    var demXY = state.dem ? C.fromWgs84(e.lngLat.lng, e.lngLat.lat, state.dem.crs) : null;

    if (demXY) text = 'X ' + fmt(demXY[0], 3) + '  Y ' + fmt(demXY[1], 3);

    el.hudXY.textContent = text;
    el.hudZ.textContent = Number.isFinite(z) ? 'Z ' + z.toFixed(2) + ' m' : 'Z —';
    el.statusX.textContent = demXY ? 'X ' + fmt(demXY[0], 3) : 'X ' + e.lngLat.lng.toFixed(5);
    el.statusY.textContent = demXY ? 'Y ' + fmt(demXY[1], 3) : 'Y ' + e.lngLat.lat.toFixed(5);
    el.statusZ.textContent = Number.isFinite(z) ? 'Z ' + z.toFixed(2) : 'Z —';

    if (state.tool === 'clip-rect' && state.rectStart) {
      state.sketch = [state.rectStart, [e.lngLat.lng, e.lngLat.lat]];
      state.sketchKind = 'rect';
      refreshSketch();
    } else if (['polyline','polygon','clip-poly'].indexOf(state.tool) >= 0 && state.sketch.length) {
      state.sketchHover = [e.lngLat.lng, e.lngLat.lat];
      refreshSketch();
    }
  }

  function setTool(tool) {
    state.tool = tool;
    state.rectStart = null;
    state.sketch = [];
    state.sketchHover = null;
    state.sketchKind = null;

    all('[data-tool]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tool === tool);
    });

    if (state.map) {
      if (['polyline','polygon','clip-poly'].indexOf(tool) >= 0) state.map.doubleClickZoom.disable();
      else state.map.doubleClickZoom.enable();
    }

    setStatus('Command: ' + tool.toUpperCase());
    refreshSketch();
  }

  function onMapClick(e) {
    var p = [e.lngLat.lng, e.lngLat.lat];

    if (state.tool === 'point') {
      state.points.push(p);
      refreshSketch();
      updateLayerList();

      var z = C.sampleElevation(state.dem, p[0], p[1]);
      setStatus('POINT ' + p[0].toFixed(6) + ', ' + p[1].toFixed(6) + (Number.isFinite(z) ? ' · Z ' + z.toFixed(2) + ' m' : ''));
      return;
    }

    if (state.tool === 'elevation') {
      var elev = C.sampleElevation(state.dem, p[0], p[1]);
      if (Number.isFinite(elev)) {
        flash('Elevation: ' + elev.toFixed(3) + ' m @ ' + p[1].toFixed(6) + ', ' + p[0].toFixed(6));
      } else {
        flash('Điểm nằm ngoài DEM hoặc NoData.', 'warn');
      }
      return;
    }

    if (state.tool === 'clip-rect') {
      if (!state.dem) return flash('Hãy mở DEM trước.', 'warn');

      if (!state.rectStart) {
        state.rectStart = p;
        state.sketch = [p, p];
        state.sketchKind = 'rect';
        refreshSketch();
        return setStatus('CLIP RECT: chọn góc đối diện.');
      }

      var a = state.rectStart;
      var bbox = [
        Math.min(a[0], p[0]),
        Math.min(a[1], p[1]),
        Math.max(a[0], p[0]),
        Math.max(a[1], p[1])
      ];

      try {
        pushHistory();
        state.dem = Edit.clipWgs84Bbox(state.dem, bbox);
        state.dem.name = suffixName(state.dem.name, '_clip');
        demChanged('CLIP: hoàn tất', true);
      } catch (err) {
        if (state.undo.length) state.undo.pop();
        flash(err.message, 'error');
      }

      setTool('pan');
      return;
    }

    if (['polyline','polygon','clip-poly'].indexOf(state.tool) >= 0) {
      state.sketch.push(p);
      state.sketchKind = state.tool;
      refreshSketch();
      setStatus(state.tool.toUpperCase() + ': ' + state.sketch.length + ' vertices · double-click/Enter để kết thúc.');
    }
  }

  function onMapDoubleClick(e) {
    if (['polyline','polygon','clip-poly'].indexOf(state.tool) >= 0) {
      e.preventDefault();
      finishSketch();
    }
  }

  function finishSketch() {
    if (state.tool === 'polyline' && state.sketch.length >= 2) {
      state.lines.push(state.sketch.slice());
    } else if (state.tool === 'polygon' && state.sketch.length >= 3) {
      state.polygons.push(state.sketch.slice());
    } else if (state.tool === 'clip-poly' && state.sketch.length >= 3) {
      try {
        pushHistory();
        state.dem = Edit.clipPolygon(state.dem, state.sketch.slice());
        state.dem.name = suffixName(state.dem.name, '_mask');
        demChanged('MASK POLYGON: hoàn tất', true);
      } catch (err) {
        if (state.undo.length) state.undo.pop();
        flash(err.message, 'error');
      }
    }

    state.sketch = [];
    state.sketchHover = null;
    state.sketchKind = null;
    refreshSketch();
    updateLayerList();
    setTool('pan');
  }

  function ensureSketchLayers() {
    if (!state.map || !state.map.isStyleLoaded()) return;

    if (!state.map.getSource(SKETCH_SOURCE)) {
      state.map.addSource(SKETCH_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!state.map.getLayer(SKETCH_FILL)) {
      state.map.addLayer({
        id: SKETCH_FILL,
        type: 'fill',
        source: SKETCH_SOURCE,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#45b9ef', 'fill-opacity': 0.12 }
      });
    }

    if (!state.map.getLayer(SKETCH_LINE)) {
      state.map.addLayer({
        id: SKETCH_LINE,
        type: 'line',
        source: SKETCH_SOURCE,
        paint: {
          'line-color': '#73d8ff',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      });
    }
  }

  function refreshSketch() {
    if (!state.map) return;
    ensureSketchLayers();

    var src = state.map.getSource(SKETCH_SOURCE);
    if (!src) return;

    var features = [];

    state.points.forEach(function (p) {
      features.push({
        type: 'Feature',
        properties: { kind: 'point' },
        geometry: {
          type: 'LineString',
          coordinates: [[p[0] - 0.00002, p[1]], [p[0] + 0.00002, p[1]]]
        }
      });
    });

    state.lines.forEach(function (c) {
      features.push({ type: 'Feature', properties: { kind: 'line' }, geometry: { type: 'LineString', coordinates: c } });
    });

    state.polygons.forEach(function (c) {
      features.push({ type: 'Feature', properties: { kind: 'polygon' }, geometry: { type: 'Polygon', coordinates: [c.concat([c[0]])] } });
    });

    if (state.sketchKind === 'rect' && state.sketch.length >= 2) {
      var a = state.sketch[0], b = state.sketch[1];
      var ring = [
        [a[0], a[1]],
        [b[0], a[1]],
        [b[0], b[1]],
        [a[0], b[1]],
        [a[0], a[1]]
      ];
      features.push({ type: 'Feature', properties: { kind: 'active' }, geometry: { type: 'Polygon', coordinates: [ring] } });
    } else if (state.sketch.length) {
      var coords = state.sketch.slice();
      if (state.sketchHover) coords.push(state.sketchHover);

      if (state.sketchKind === 'polygon' || state.sketchKind === 'clip-poly') {
        if (coords.length >= 3) {
          coords = coords.concat([coords[0]]);
          features.push({ type: 'Feature', properties: { kind: 'active' }, geometry: { type: 'Polygon', coordinates: [coords] } });
        } else {
          features.push({ type: 'Feature', properties: { kind: 'active' }, geometry: { type: 'LineString', coordinates: coords } });
        }
      } else {
        features.push({ type: 'Feature', properties: { kind: 'active' }, geometry: { type: 'LineString', coordinates: coords } });
      }
    }

    src.setData({ type: 'FeatureCollection', features: features });
  }

  function clearSketch() {
    state.points = [];
    state.lines = [];
    state.polygons = [];
    state.sketch = [];
    state.sketchHover = null;
    state.sketchKind = null;
    refreshSketch();
    updateLayerList();
    setStatus('Editor Sketch cleared.');
  }

  function generateContours() {
    if (!state.dem) return flash('Hãy mở DEM trước.', 'warn');
    if (!window.d3 || !d3.contours) return flash('d3-contour chưa tải được.', 'error');

    var suggested = Math.max(1, Math.round((state.dem.stats.p98 - state.dem.stats.p02) / 20));
    var interval = Number(prompt('Khoảng cao đều (m):', String(suggested)));
    if (!Number.isFinite(interval) || interval <= 0) return;

    setBusy(true, 'Đang tạo contours...');

    setTimeout(function () {
      try {
        var d = state.dem;
        var scale = Math.min(1, 700 / Math.max(d.width, d.height));
        var w = Math.max(2, Math.round(d.width * scale));
        var h = Math.max(2, Math.round(d.height * scale));
        var values = new Float32Array(w * h);
        var fill = Number.isFinite(d.stats.min) ? d.stats.min - interval * 10 : -1e9;

        for (var y = 0; y < h; y++) {
          var sy = Math.min(d.height - 1, Math.floor(y / scale));
          for (var x = 0; x < w; x++) {
            var sx = Math.min(d.width - 1, Math.floor(x / scale));
            var v = C.sourceValue(d, sx, sy);
            values[x + y * w] = Number.isFinite(v) ? v : fill;
          }
        }

        var start = Math.ceil(d.stats.p02 / interval) * interval;
        var end = Math.floor(d.stats.p98 / interval) * interval;
        var thresholds = [];

        for (var z = start; z <= end && thresholds.length < 250; z += interval) thresholds.push(z);

        var contours = d3.contours().size([w, h]).thresholds(thresholds)(values);
        var features = [];

        contours.forEach(function (contour) {
          var coords = contour.coordinates.map(function (poly) {
            return poly.map(function (ring) {
              return ring.map(function (point) {
                var wx = d.bbox[0] + point[0] / w * (d.bbox[2] - d.bbox[0]);
                var wy = d.bbox[3] - point[1] / h * (d.bbox[3] - d.bbox[1]);
                return C.toWgs84(wx, wy, d.crs) || [0, 0];
              });
            });
          });

          features.push({
            type: 'Feature',
            properties: { elev: contour.value },
            geometry: { type: 'MultiPolygon', coordinates: coords }
          });
        });

        drawContours({ type: 'FeatureCollection', features: features });
        setStatus('CONTOUR: ' + features.length + ' levels · interval ' + interval + ' m');
      } catch (err) {
        console.error(err);
        flash('Contour lỗi: ' + err.message, 'error');
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  function drawContours(fc) {
    if (!state.map) return;

    try { if (state.map.getLayer(CONTOUR_LINE)) state.map.removeLayer(CONTOUR_LINE); } catch (_) {}
    try { if (state.map.getSource(CONTOUR_SOURCE)) state.map.removeSource(CONTOUR_SOURCE); } catch (_) {}

    state.map.addSource(CONTOUR_SOURCE, { type: 'geojson', data: fc });
    state.map.addLayer({
      id: CONTOUR_LINE,
      type: 'line',
      source: CONTOUR_SOURCE,
      paint: {
        'line-color': '#8b5f36',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 14, 1.15],
        'line-opacity': 0.78
      }
    });

    updateLayerList();
  }

  function applyCrs() {
    if (!state.dem) return;
    var code = C.normalizeEpsg(el.propCrs.value) || 'LOCAL';
    state.dem.crs = code;
    updateProperties();
    renderDem(true);
    setStatus('CRS set to ' + code + '.');
  }

  function checkTerrainContract() {
    fetch(OPENMAP_ROOT + '/terrain/manifest.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (m) {
        var ready = m.status === 'ready' && m.data_ready === true;
        el.terrainDot.className = 'status-dot ' + (ready ? 'ready' : 'wait');
        el.terrainStatus.textContent = ready ? 'READY · ' + (m.dataset_version || 'dataset') : 'AWAITING DATA';
      })
      .catch(function () {
        el.terrainDot.className = 'status-dot error';
        el.terrainStatus.textContent = 'UNAVAILABLE';
      });
  }

  function renderEngines() {
    var f = state.engineFilter.trim().toLowerCase();
    var groups = {};

    capabilities.forEach(function (cap, index) {
      var haystack = (cap[0] + ' ' + cap[1]).toLowerCase();
      if (f && haystack.indexOf(f) < 0) return;
      if (!groups[cap[0]]) groups[cap[0]] = [];
      groups[cap[0]].push({ cap: cap, index: index });
    });

    var html = '';
    Object.keys(groups).forEach(function (group) {
      html += '<div class="engine-group"><button>' + escapeHtml(group) + '</button><div class="engine-items">';
      groups[group].forEach(function (item) {
        var cap = item.cap;
        html += '<div class="engine-item" data-cap="' + item.index + '"><span>' + escapeHtml(cap[1]) + '</span><small class="' + cap[2] + '">' +
          (cap[2] === 'browser' ? 'BROWSER' : 'ADAPTER') + '</small></div>';
      });
      html += '</div></div>';
    });

    el.engineList.innerHTML = html;

    all('.engine-item', el.engineList).forEach(function (node) {
      node.addEventListener('click', function () {
        runCapability(capabilities[Number(node.dataset.cap)]);
      });
    });
  }

  function runCapability(cap) {
    if (cap[3]) {
      if (cap[3].indexOf('render:') === 0) setRenderMode(cap[3].split(':')[1]);
      else runAction(cap[3]);
      return;
    }
    if (cap[4]) return setTool(cap[4]);

    flash(cap[1] + ': đã giữ slot trong Adapter Layer; cần nối engine phù hợp để xử lý production.', 'warn');
    setStatus('ADAPTER REQUIRED: ' + cap[1]);
  }

  var commands = [
    ['OPEN','Mở GeoTIFF / ASC','open-dem'],
    ['GEOTIFF','Xuất GeoTIFF','save-geotiff'],
    ['ASC','Xuất ASCII Grid','save-asc'],
    ['CSV','Xuất CSV samples','save-csv'],
    ['CLIP','Clip rectangle','tool:clip-rect'],
    ['MASK','Clip polygon','tool:clip-poly'],
    ['POINT','Chấm điểm','tool:point'],
    ['LINE','Vẽ polyline','tool:polyline'],
    ['POLYGON','Vẽ polygon','tool:polygon'],
    ['ELEVATION','Lấy cao độ','tool:elevation'],
    ['HILLSHADE','Render hillshade','render:hillshade'],
    ['SLOPE','Render slope','render:slope'],
    ['ASPECT','Render aspect','render:aspect'],
    ['DEM','Render elevation','render:elevation'],
    ['CONTOUR','Tạo đường đồng mức','contours'],
    ['EXTENT','Zoom DEM','zoom-dem'],
    ['UNDO','Undo raster edit','undo'],
    ['REDO','Redo raster edit','redo'],
    ['PRINT','In bản đồ','print'],
    ['CLEAR','Xóa sketch','clear-sketch']
  ];

  function executeCommand(raw) {
    var name = String(raw || '').trim().split(/\s+/)[0].toUpperCase();
    if (!name) return;

    var cmd = commands.find(function (c) { return c[0] === name; });
    if (!cmd) return flash('Unknown command: ' + name, 'warn');

    if (cmd[2].indexOf('tool:') === 0) setTool(cmd[2].split(':')[1]);
    else if (cmd[2].indexOf('render:') === 0) setRenderMode(cmd[2].split(':')[1]);
    else runAction(cmd[2]);

    setStatus('Command: ' + name);
  }

  function renderPalette(filter) {
    var f = String(filter || '').toLowerCase();
    var results = commands.filter(function (c) {
      return !f || (c[0] + ' ' + c[1]).toLowerCase().indexOf(f) >= 0;
    }).slice(0, 12);

    el.paletteResults.innerHTML = results.map(function (c, i) {
      return '<div class="palette-result ' + (i === 0 ? 'is-selected' : '') + '" data-cmd="' + c[0] + '"><span>' + c[0] + '</span><small>' + escapeHtml(c[1]) + '</small></div>';
    }).join('');

    all('.palette-result', el.paletteResults).forEach(function (node) {
      node.addEventListener('click', function () {
        executeCommand(node.dataset.cmd);
        closePalette();
      });
    });
  }

  function openPalette() {
    el.paletteBackdrop.hidden = false;
    el.paletteInput.value = '';
    renderPalette('');
    setTimeout(function () { el.paletteInput.focus(); }, 0);
  }

  function closePalette() {
    el.paletteBackdrop.hidden = true;
  }

  async function runAction(action) {
    try {
      if (action === 'open-dem') return el.fileInput.click();
      if (action === 'save-geotiff') {
        if (!state.dem) return flash('Hãy mở DEM trước.', 'warn');
        setBusy(true, 'Đang ghi GeoTIFF không nén...');
        await IO.saveGeoTiff(state.dem);
        return setStatus('GeoTIFF exported.');
      }
      if (action === 'save-asc') {
        if (!state.dem) return flash('Hãy mở DEM trước.', 'warn');
        IO.saveAscii(state.dem);
        return setStatus('ASCII Grid exported.');
      }
      if (action === 'save-csv') {
        if (!state.dem) return flash('Hãy mở DEM trước.', 'warn');
        var step = IO.saveCsv(state.dem);
        return setStatus('CSV sample exported · stride ' + step + '.');
      }
      if (action === 'contours') return generateContours();
      if (action === 'undo') return undo();
      if (action === 'redo') return redo();
      if (action === 'zoom-dem') return fitDem();
      if (action === 'clear-sketch') return clearSketch();
      if (action === 'print') return window.print();
      if (action === 'apply-crs') return applyCrs();
      if (action === 'open-command-palette') return openPalette();
      if (action === 'about') return el.about.showModal();

      flash('Action ' + action + ' chưa được nối.', 'warn');
    } catch (err) {
      console.error(err);
      flash(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  all('[data-action]').forEach(function (b) {
    b.addEventListener('click', function () { runAction(b.dataset.action); });
  });

  all('[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.dataset.tool); });
  });

  all('[data-render]').forEach(function (b) {
    b.addEventListener('click', function () { setRenderMode(b.dataset.render); });
  });

  all('.dock-tab').forEach(function (b) {
    b.addEventListener('click', function () {
      all('.dock-tab').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      all('.dock-panel').forEach(function (x) { x.classList.toggle('is-active', x.dataset.panel === b.dataset.dock); });
    });
  });

  all('[data-menu]').forEach(function (b) {
    b.addEventListener('click', function () {
      all('[data-menu]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      if (b.dataset.menu === 'analyze' || b.dataset.menu === 'hydro' || b.dataset.menu === 'lidar') {
        var tab = document.querySelector('[data-dock="analysis"]');
        if (tab) tab.click();
      }
      if (b.dataset.menu === 'output') openPalette();
    });
  });

  el.fileInput.addEventListener('change', function () {
    var f = el.fileInput.files && el.fileInput.files[0];
    if (f) loadFile(f);
    el.fileInput.value = '';
  });

  el.opacity.addEventListener('input', function () {
    el.opacityValue.textContent = Math.round(Number(el.opacity.value) * 100) + '%';
    if (state.map && state.map.getLayer(DEM_LAYER)) {
      state.map.setPaintProperty(DEM_LAYER, 'raster-opacity', Number(el.opacity.value));
    }
  });

  el.commandInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      executeCommand(el.commandInput.value);
      el.commandInput.select();
    }
    if (e.key === 'Escape') setTool('pan');
  });

  el.engineSearch.addEventListener('input', function () {
    state.engineFilter = el.engineSearch.value;
    renderEngines();
  });

  el.paletteInput.addEventListener('input', function () {
    renderPalette(el.paletteInput.value);
  });

  el.paletteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePalette();
    if (e.key === 'Enter') {
      var first = el.paletteResults.querySelector('.palette-result');
      if (first) {
        executeCommand(first.dataset.cmd);
        closePalette();
      }
    }
  });

  el.paletteBackdrop.addEventListener('click', function (e) {
    if (e.target === el.paletteBackdrop) closePalette();
  });

  ['dragenter','dragover'].forEach(function (type) {
    el.stage.addEventListener(type, function (e) {
      e.preventDefault();
      el.dropZone.classList.add('is-visible');
    });
  });

  ['dragleave','drop'].forEach(function (type) {
    el.stage.addEventListener(type, function (e) {
      e.preventDefault();
      el.dropZone.classList.remove('is-visible');
    });
  });

  el.stage.addEventListener('drop', function (e) {
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  document.addEventListener('keydown', function (e) {
    var key = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && key === 'o') {
      e.preventDefault();
      runAction('open-dem');
    }
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
    if ((e.ctrlKey || e.metaKey) && key === 'p') {
      e.preventDefault();
      window.print();
    }
    if ((e.ctrlKey || e.metaKey) && key === 'k') {
      e.preventDefault();
      openPalette();
    }

    if (e.key === 'Escape') {
      if (!el.paletteBackdrop.hidden) closePalette();
      else setTool('pan');
    }

    if (e.key === 'Enter' && ['polyline','polygon','clip-poly'].indexOf(state.tool) >= 0) {
      finishSketch();
    }
  });

  renderEngines();
  checkTerrainContract();
  setTool('pan');
})();
