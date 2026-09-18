/* Vietflex Terrain Editor - DEM core */
(function (global) {
  'use strict';

  function normalizeEpsg(code) {
    var s = String(code || '').trim().toUpperCase();
    if (!s) return null;
    if (/^\d+$/.test(s)) return 'EPSG:' + s;
    var m = s.match(/EPSG\s*[: ]\s*(\d+)/);
    return m ? 'EPSG:' + m[1] : s;
  }

  function ensureProjection(code) {
    code = normalizeEpsg(code);
    if (!code || code === 'LOCAL') return false;
    if (global.proj4 && proj4.defs(code)) return true;

    // VN-2000 / UTM zone 48N and 49N (EPSG:3405 / EPSG:3406).
    // These definitions use the published seven-parameter transformation to WGS84.
    if (global.proj4 && code === 'EPSG:3405') {
      proj4.defs(code, '+proj=utm +zone=48 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs +type=crs');
      return true;
    }
    if (global.proj4 && code === 'EPSG:3406') {
      proj4.defs(code, '+proj=utm +zone=49 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs +type=crs');
      return true;
    }

    var m = code.match(/^(EPSG:)?(326|327)(\d{2})$/);
    if (m && global.proj4) {
      var zone = Number(m[2]);
      var south = m[1] === '327' ? ' +south' : '';
      proj4.defs(code, '+proj=utm +zone=' + zone + south + ' +datum=WGS84 +units=m +no_defs +type=crs');
      return true;
    }
    return false;
  }

  function inferCrs(geoKeys, bbox) {
    var projected = geoKeys && Number(geoKeys.ProjectedCSTypeGeoKey);
    var geographic = geoKeys && Number(geoKeys.GeographicTypeGeoKey);
    if (projected > 0 && projected !== 32767) return 'EPSG:' + projected;
    if (geographic > 0 && geographic !== 32767) return 'EPSG:' + geographic;
    if (bbox && bbox[0] >= -180 && bbox[2] <= 180 && bbox[1] >= -90 && bbox[3] <= 90) return 'EPSG:4326';
    return 'LOCAL';
  }

  function toWgs84(x, y, crs) {
    var code = normalizeEpsg(crs);
    if (code === 'EPSG:4326') return [x, y];
    if (!global.proj4) return null;
    if (code === 'EPSG:3857') return proj4('EPSG:3857', 'EPSG:4326', [x, y]);
    if (ensureProjection(code)) return proj4(code, 'EPSG:4326', [x, y]);
    return null;
  }

  function fromWgs84(lon, lat, crs) {
    var code = normalizeEpsg(crs);
    if (code === 'EPSG:4326') return [lon, lat];
    if (!global.proj4) return null;
    if (code === 'EPSG:3857') return proj4('EPSG:4326', 'EPSG:3857', [lon, lat]);
    if (ensureProjection(code)) return proj4('EPSG:4326', code, [lon, lat]);
    return null;
  }

  function isNoData(v, nodata) {
    if (!Number.isFinite(Number(v))) return true;
    return Number.isFinite(Number(nodata)) && Math.abs(Number(v) - Number(nodata)) < 1e-12;
  }

  function computeStats(data, nodata) {
    var n = data.length;
    var step = Math.max(1, Math.floor(n / 250000));
    var min = Infinity, max = -Infinity, sum = 0, sum2 = 0, count = 0;
    var sample = [];

    for (var i = 0; i < n; i += step) {
      var v = Number(data[i]);
      if (isNoData(v, nodata)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      sum2 += v * v;
      count += 1;
      if (sample.length < 60000) sample.push(v);
    }

    if (!count) return { min: NaN, max: NaN, mean: NaN, std: NaN, p02: NaN, p98: NaN };
    sample.sort(function (a, b) { return a - b; });

    function pick(p) {
      var j = Math.max(0, Math.min(sample.length - 1, Math.round((sample.length - 1) * p)));
      return sample[j];
    }

    var mean = sum / count;
    return {
      min: min,
      max: max,
      mean: mean,
      std: Math.sqrt(Math.max(0, sum2 / count - mean * mean)),
      p02: pick(0.02),
      p98: pick(0.98)
    };
  }

  function cloneDem(dem) {
    if (!dem) return null;
    return {
      name: dem.name,
      sourceName: dem.sourceName,
      sourceType: dem.sourceType,
      width: dem.width,
      height: dem.height,
      data: new Float32Array(dem.data),
      bbox: dem.bbox.slice(),
      resolution: dem.resolution ? dem.resolution.slice() : null,
      crs: dem.crs,
      nodata: dem.nodata,
      geoKeys: dem.geoKeys ? Object.assign({}, dem.geoKeys) : null,
      metadata: dem.metadata || null,
      stats: dem.stats ? Object.assign({}, dem.stats) : null
    };
  }

  function worldToPixel(dem, x, y) {
    var b = dem.bbox;
    var col = Math.floor((x - b[0]) / (b[2] - b[0]) * dem.width);
    var row = Math.floor((b[3] - y) / (b[3] - b[1]) * dem.height);
    if (col < 0 || row < 0 || col >= dem.width || row >= dem.height) return null;
    return [col, row];
  }

  function pixelToWorld(dem, col, row) {
    var b = dem.bbox;
    var x = b[0] + (col + 0.5) / dem.width * (b[2] - b[0]);
    var y = b[3] - (row + 0.5) / dem.height * (b[3] - b[1]);
    return [x, y];
  }

  function sampleElevation(dem, lon, lat) {
    if (!dem) return null;
    var p = fromWgs84(lon, lat, dem.crs);
    if (!p) return null;
    var px = worldToPixel(dem, p[0], p[1]);
    if (!px) return null;
    var v = Number(dem.data[px[0] + px[1] * dem.width]);
    return isNoData(v, dem.nodata) ? null : v;
  }

  function cornersWgs84(dem) {
    if (!dem) return null;
    var b = dem.bbox;
    var pts = [
      toWgs84(b[0], b[3], dem.crs),
      toWgs84(b[2], b[3], dem.crs),
      toWgs84(b[2], b[1], dem.crs),
      toWgs84(b[0], b[1], dem.crs)
    ];
    for (var i = 0; i < pts.length; i++) if (!pts[i]) return null;
    return pts;
  }

  function sourceValue(dem, x, y) {
    x = Math.max(0, Math.min(dem.width - 1, x));
    y = Math.max(0, Math.min(dem.height - 1, y));
    var v = Number(dem.data[x + y * dem.width]);
    return isNoData(v, dem.nodata) ? NaN : v;
  }

  function cellMetrics(dem) {
    var dx = Math.abs((dem.bbox[2] - dem.bbox[0]) / dem.width);
    var dy = Math.abs((dem.bbox[3] - dem.bbox[1]) / dem.height);
    if (normalizeEpsg(dem.crs) === 'EPSG:4326') {
      var lat = (dem.bbox[1] + dem.bbox[3]) * 0.5 * Math.PI / 180;
      return [dx * 111320 * Math.cos(lat), dy * 110540];
    }
    return [dx, dy];
  }

  function gradientAt(dem, x, y) {
    var z1 = sourceValue(dem, x - 1, y - 1);
    var z2 = sourceValue(dem, x, y - 1);
    var z3 = sourceValue(dem, x + 1, y - 1);
    var z4 = sourceValue(dem, x - 1, y);
    var z6 = sourceValue(dem, x + 1, y);
    var z7 = sourceValue(dem, x - 1, y + 1);
    var z8 = sourceValue(dem, x, y + 1);
    var z9 = sourceValue(dem, x + 1, y + 1);
    var vals = [z1, z2, z3, z4, z6, z7, z8, z9];
    for (var i = 0; i < vals.length; i++) if (!Number.isFinite(vals[i])) return null;

    var m = cellMetrics(dem);
    if (!m[0] || !m[1]) return null;

    var dzdx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * m[0]);
    var dzdy = ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8 * m[1]);
    return [dzdx, dzdy];
  }

  function colorRamp(t) {
    t = Math.max(0, Math.min(1, t));
    var stops = [
      [0, [22, 79, 124]],
      [0.12, [53, 126, 160]],
      [0.24, [80, 154, 112]],
      [0.42, [152, 177, 89]],
      [0.58, [210, 188, 112]],
      [0.72, [172, 125, 79]],
      [0.86, [121, 91, 78]],
      [1, [244, 241, 232]]
    ];

    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var p0 = stops[i - 1][0], p1 = stops[i][0];
        var c0 = stops[i - 1][1], c1 = stops[i][1];
        var k = (t - p0) / (p1 - p0);
        return [
          Math.round(c0[0] + (c1[0] - c0[0]) * k),
          Math.round(c0[1] + (c1[1] - c0[1]) * k),
          Math.round(c0[2] + (c1[2] - c0[2]) * k)
        ];
      }
    }
    return stops[stops.length - 1][1];
  }

  function hsvToRgb(h, s, v) {
    var r = 0, g = 0, b = 0;
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function renderCanvas(dem, mode, maxDim) {
    maxDim = maxDim || 1400;
    if (!dem.stats) dem.stats = computeStats(dem.data, dem.nodata);

    var scale = Math.min(1, maxDim / Math.max(dem.width, dem.height));
    var w = Math.max(1, Math.round(dem.width * scale));
    var h = Math.max(1, Math.round(dem.height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    var ctx = canvas.getContext('2d', { alpha: true });
    var img = ctx.createImageData(w, h);
    var out = img.data;
    var lo = Number.isFinite(dem.stats.p02) ? dem.stats.p02 : dem.stats.min;
    var hi = Number.isFinite(dem.stats.p98) ? dem.stats.p98 : dem.stats.max;

    for (var oy = 0; oy < h; oy++) {
      var sy = Math.min(dem.height - 1, Math.floor(oy / scale));
      for (var ox = 0; ox < w; ox++) {
        var sx = Math.min(dem.width - 1, Math.floor(ox / scale));
        var idx = (ox + oy * w) * 4;
        var z = sourceValue(dem, sx, sy);
        if (!Number.isFinite(z)) {
          out[idx + 3] = 0;
          continue;
        }

        var rgb = [180, 180, 180];
        if (mode === 'elevation') {
          rgb = colorRamp((z - lo) / Math.max(1e-12, hi - lo));
        } else {
          var gr = gradientAt(dem, sx, sy);
          if (!gr) {
            out[idx + 3] = 0;
            continue;
          }

          var gx = gr[0], gy = gr[1];
          var slope = Math.atan(Math.sqrt(gx * gx + gy * gy));

          if (mode === 'slope') {
            var deg = slope * 180 / Math.PI;
            var v = Math.round(255 * Math.min(1, deg / 60));
            rgb = [v, Math.round(v * 0.78), Math.round(255 - v * 0.65)];
          } else if (mode === 'aspect') {
            var a = Math.atan2(gy, -gx) * 180 / Math.PI;
            if (a < 0) a += 360;
            rgb = hsvToRgb(a / 360, 0.72, 0.92);
          } else {
            var aspect = Math.atan2(gy, -gx);
            var az = 315 * Math.PI / 180;
            var alt = 45 * Math.PI / 180;
            var hs = Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect);
            var shade = Math.round(255 * Math.max(0.08, Math.min(1, (hs + 1) / 2)));
            rgb = [shade, shade, shade];
          }
        }

        out[idx] = rgb[0];
        out[idx + 1] = rgb[1];
        out[idx + 2] = rgb[2];
        out[idx + 3] = 245;
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  global.VFTerrainCore = Object.freeze({
    normalizeEpsg: normalizeEpsg,
    ensureProjection: ensureProjection,
    inferCrs: inferCrs,
    toWgs84: toWgs84,
    fromWgs84: fromWgs84,
    isNoData: isNoData,
    computeStats: computeStats,
    cloneDem: cloneDem,
    worldToPixel: worldToPixel,
    pixelToWorld: pixelToWorld,
    sampleElevation: sampleElevation,
    cornersWgs84: cornersWgs84,
    sourceValue: sourceValue,
    cellMetrics: cellMetrics,
    gradientAt: gradientAt,
    renderCanvas: renderCanvas
  });
})(window);
