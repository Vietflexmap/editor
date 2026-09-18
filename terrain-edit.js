/* Vietflex Terrain Editor - raster edit helpers */
(function (global) {
  'use strict';

  var C = global.VFTerrainCore;

  function pointInPolygon(x, y, poly) {
    var inside = false;

    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];

      var hit = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi + 1e-30) + xi);

      if (hit) inside = !inside;
    }

    return inside;
  }

  function clipWorldBbox(dem, bbox) {
    if (!dem) throw new Error('Chưa có DEM.');

    var b = dem.bbox;
    var minX = Math.max(b[0], bbox[0]);
    var minY = Math.max(b[1], bbox[1]);
    var maxX = Math.min(b[2], bbox[2]);
    var maxY = Math.min(b[3], bbox[3]);

    if (minX >= maxX || minY >= maxY) throw new Error('Vùng clip không giao DEM.');

    var c0 = Math.max(0, Math.floor((minX - b[0]) / (b[2] - b[0]) * dem.width));
    var c1 = Math.min(dem.width, Math.ceil((maxX - b[0]) / (b[2] - b[0]) * dem.width));
    var r0 = Math.max(0, Math.floor((b[3] - maxY) / (b[3] - b[1]) * dem.height));
    var r1 = Math.min(dem.height, Math.ceil((b[3] - minY) / (b[3] - b[1]) * dem.height));

    if (c1 <= c0 || r1 <= r0) throw new Error('Vùng clip quá nhỏ.');

    var width = c1 - c0;
    var height = r1 - r0;
    var data = new Float32Array(width * height);

    for (var r = 0; r < height; r++) {
      var start = (r0 + r) * dem.width + c0;
      data.set(dem.data.subarray(start, start + width), r * width);
    }

    var dx = (b[2] - b[0]) / dem.width;
    var dy = (b[3] - b[1]) / dem.height;

    var out = Object.assign({}, dem, {
      width: width,
      height: height,
      data: data,
      bbox: [
        b[0] + c0 * dx,
        b[3] - r1 * dy,
        b[0] + c1 * dx,
        b[3] - r0 * dy
      ]
    });

    out.stats = C.computeStats(out.data, out.nodata);
    return out;
  }

  function clipWgs84Bbox(dem, wgsBbox) {
    var p1 = C.fromWgs84(wgsBbox[0], wgsBbox[1], dem.crs);
    var p2 = C.fromWgs84(wgsBbox[2], wgsBbox[3], dem.crs);

    if (!p1 || !p2) throw new Error('CRS hiện tại chưa chuyển đổi được để clip.');

    return clipWorldBbox(dem, [
      Math.min(p1[0], p2[0]),
      Math.min(p1[1], p2[1]),
      Math.max(p1[0], p2[0]),
      Math.max(p1[1], p2[1])
    ]);
  }

  function clipPolygon(dem, wgsPoly) {
    if (!dem) throw new Error('Chưa có DEM.');
    if (!wgsPoly || wgsPoly.length < 3) throw new Error('Polygon cần ít nhất 3 đỉnh.');

    var poly = wgsPoly.map(function (p) {
      return C.fromWgs84(p[0], p[1], dem.crs);
    });

    for (var i = 0; i < poly.length; i++) {
      if (!poly[i]) throw new Error('CRS hiện tại chưa chuyển polygon được.');
    }

    var xs = poly.map(function (p) { return p[0]; });
    var ys = poly.map(function (p) { return p[1]; });
    var worldBbox = [
      Math.min.apply(null, xs),
      Math.min.apply(null, ys),
      Math.max.apply(null, xs),
      Math.max.apply(null, ys)
    ];

    var cropped = clipWorldBbox(dem, worldBbox);
    var nodata = Number.isFinite(cropped.nodata) ? cropped.nodata : -9999;
    var out = C.cloneDem(cropped);
    out.nodata = nodata;

    for (var r = 0; r < out.height; r++) {
      for (var c = 0; c < out.width; c++) {
        var xy = C.pixelToWorld(out, c, r);
        if (!pointInPolygon(xy[0], xy[1], poly)) {
          out.data[c + r * out.width] = nodata;
        }
      }
    }

    out.stats = C.computeStats(out.data, out.nodata);
    return out;
  }

  global.VFTerrainEdit = Object.freeze({
    pointInPolygon: pointInPolygon,
    clipWorldBbox: clipWorldBbox,
    clipWgs84Bbox: clipWgs84Bbox,
    clipPolygon: clipPolygon
  });
})(window);
