/* Vietflex Terrain Editor - browser raster I/O */
(function (global) {
  'use strict';

  var C = global.VFTerrainCore;

  function addSuffix(name, suffix) {
    var s = String(name || 'dem');
    var i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) + suffix + s.slice(i) : s + suffix;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function loadGeoTiff(file) {
    if (!global.GeoTIFF) throw new Error('geotiff.js chưa tải được.');

    var buffer = await file.arrayBuffer();
    var tiff = await GeoTIFF.fromArrayBuffer(buffer);
    var image = await tiff.getImage();
    var raster = await image.readRasters({ samples: [0] });
    var source = raster[0];
    var data = source instanceof Float32Array ? new Float32Array(source) : Float32Array.from(source, Number);

    var bbox;
    try {
      bbox = image.getBoundingBox().map(Number);
    } catch (_) {
      bbox = [0, 0, image.getWidth(), image.getHeight()];
    }

    var resolution = null;
    try {
      resolution = image.getResolution().map(Number);
    } catch (_) {}

    var geoKeys = image.getGeoKeys ? image.getGeoKeys() : null;
    var crs = C.inferCrs(geoKeys, bbox);
    var nodata = image.getGDALNoData ? Number(image.getGDALNoData()) : NaN;
    var gdalMetadata = null;

    try {
      if (image.getGDALMetadata) gdalMetadata = await image.getGDALMetadata();
    } catch (_) {}

    return {
      name: file.name,
      sourceName: file.name,
      sourceType: 'GeoTIFF',
      width: image.getWidth(),
      height: image.getHeight(),
      data: data,
      bbox: bbox,
      resolution: resolution || [
        (bbox[2] - bbox[0]) / image.getWidth(),
        (bbox[3] - bbox[1]) / image.getHeight()
      ],
      crs: crs,
      nodata: Number.isFinite(nodata) ? nodata : NaN,
      geoKeys: geoKeys,
      metadata: gdalMetadata,
      stats: C.computeStats(data, Number.isFinite(nodata) ? nodata : NaN)
    };
  }

  async function loadAsciiGrid(file) {
    var text = await file.text();
    var lines = text.replace(/\r/g, '').split('\n').filter(function (x) { return x.trim().length; });
    var header = {};
    var dataStart = 0;

    for (var i = 0; i < Math.min(12, lines.length); i++) {
      var p = lines[i].trim().split(/\s+/);
      var k = p[0].toLowerCase();

      if ([
        'ncols', 'nrows', 'xllcorner', 'yllcorner',
        'xllcenter', 'yllcenter', 'cellsize',
        'nodata_value', 'dx', 'dy'
      ].indexOf(k) >= 0) {
        header[k] = Number(p[1]);
        dataStart = i + 1;
      } else {
        break;
      }
    }

    var width = header.ncols;
    var height = header.nrows;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error('ASCII Grid thiếu ncols/nrows hợp lệ.');
    }

    var cellX = Number.isFinite(header.cellsize) ? header.cellsize : header.dx;
    var cellY = Number.isFinite(header.cellsize) ? header.cellsize : header.dy;
    if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) {
      throw new Error('ASCII Grid thiếu cellsize/dx/dy.');
    }

    var xll = Number.isFinite(header.xllcorner) ? header.xllcorner : header.xllcenter - cellX / 2;
    var yll = Number.isFinite(header.yllcorner) ? header.yllcorner : header.yllcenter - cellY / 2;
    if (!Number.isFinite(xll) || !Number.isFinite(yll)) {
      throw new Error('ASCII Grid thiếu xll/yll.');
    }

    var data = new Float32Array(width * height);
    var cursor = 0;

    for (var row = dataStart; row < lines.length && cursor < data.length; row++) {
      var parts = lines[row].trim().split(/\s+/);
      for (var j = 0; j < parts.length; j++) {
        if (cursor >= data.length) break;
        data[cursor++] = Number(parts[j]);
      }
    }

    if (cursor < data.length) {
      throw new Error('ASCII Grid thiếu dữ liệu: ' + cursor + '/' + data.length + ' cells.');
    }

    var bbox = [xll, yll, xll + width * cellX, yll + height * cellY];
    var crs = bbox[0] >= -180 && bbox[2] <= 180 && bbox[1] >= -90 && bbox[3] <= 90 ? 'EPSG:4326' : 'LOCAL';
    var nodata = Number.isFinite(header.nodata_value) ? header.nodata_value : -9999;

    return {
      name: file.name,
      sourceName: file.name,
      sourceType: 'ASCII Grid',
      width: width,
      height: height,
      data: data,
      bbox: bbox,
      resolution: [cellX, cellY],
      crs: crs,
      nodata: nodata,
      geoKeys: null,
      metadata: header,
      stats: C.computeStats(data, nodata)
    };
  }

  async function open(file) {
    var ext = String(file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'tif' || ext === 'tiff') return loadGeoTiff(file);
    if (ext === 'asc' || ext === 'txt') return loadAsciiGrid(file);
    throw new Error('Định dạng chưa hỗ trợ. Dùng GeoTIFF (.tif/.tiff) hoặc ASCII Grid (.asc).');
  }

  function saveAscii(dem) {
    if (!dem) throw new Error('Chưa có DEM.');

    var dx = (dem.bbox[2] - dem.bbox[0]) / dem.width;
    var dy = (dem.bbox[3] - dem.bbox[1]) / dem.height;
    var nodata = Number.isFinite(dem.nodata) ? dem.nodata : -9999;

    var head = '';
    head += 'ncols ' + dem.width + '\n';
    head += 'nrows ' + dem.height + '\n';
    head += 'xllcorner ' + dem.bbox[0] + '\n';
    head += 'yllcorner ' + dem.bbox[1] + '\n';

    if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 1e-12) {
      head += 'cellsize ' + Math.abs(dx) + '\n';
    } else {
      head += 'dx ' + Math.abs(dx) + '\n';
      head += 'dy ' + Math.abs(dy) + '\n';
    }

    head += 'NODATA_value ' + nodata + '\n';

    var rows = [];
    for (var r = 0; r < dem.height; r++) {
      var vals = [];
      var base = r * dem.width;

      for (var c = 0; c < dem.width; c++) {
        var v = dem.data[base + c];
        vals.push(C.isNoData(v, dem.nodata) ? nodata : Number(v).toFixed(4).replace(/\.0+$/, ''));
      }

      rows.push(vals.join(' '));
    }

    var filename = String(dem.name || 'dem').replace(/\.(tif|tiff|asc|txt)$/i, '') + '.asc';
    downloadBlob(new Blob([head, rows.join('\n')], { type: 'text/plain;charset=utf-8' }), filename);
  }

  async function saveGeoTiff(dem) {
    if (!dem) throw new Error('Chưa có DEM.');
    if (!global.GeoTIFF || typeof GeoTIFF.writeArrayBuffer !== 'function') {
      throw new Error('GeoTIFF writer chưa sẵn sàng.');
    }

    var dx = (dem.bbox[2] - dem.bbox[0]) / dem.width;
    var dy = (dem.bbox[3] - dem.bbox[1]) / dem.height;
    var meta = {
      width: dem.width,
      height: dem.height,
      ModelPixelScale: [Math.abs(dx), Math.abs(dy), 0],
      ModelTiepoint: [0, 0, 0, dem.bbox[0], dem.bbox[3], 0]
    };

    var code = C.normalizeEpsg(dem.crs);
    var num = code && code.indexOf(':') > 0 ? Number(code.split(':')[1]) : NaN;

    if (code === 'EPSG:4326') meta.GeographicTypeGeoKey = 4326;
    else if (Number.isFinite(num) && num > 0) meta.ProjectedCSTypeGeoKey = num;

    if (Number.isFinite(dem.nodata)) meta.GDAL_NODATA = String(dem.nodata);

    var arrayBuffer = await GeoTIFF.writeArrayBuffer(dem.data, meta);
    var filename = String(dem.name || 'dem').replace(/\.(asc|txt|tiff)$/i, '.tif');
    if (!/\.tif$/i.test(filename)) filename += '.tif';

    downloadBlob(new Blob([arrayBuffer], { type: 'image/tiff' }), filename);
  }

  function saveCsv(dem, maxPoints) {
    if (!dem) throw new Error('Chưa có DEM.');
    maxPoints = maxPoints || 250000;

    var step = Math.max(1, Math.ceil(Math.sqrt(dem.data.length / maxPoints)));
    var rows = ['x,y,z'];

    for (var r = 0; r < dem.height; r += step) {
      for (var c = 0; c < dem.width; c += step) {
        var z = C.sourceValue(dem, c, r);
        if (!Number.isFinite(z)) continue;
        var xy = C.pixelToWorld(dem, c, r);
        rows.push(xy[0] + ',' + xy[1] + ',' + z);
      }
    }

    var filename = String(dem.name || 'dem').replace(/\.[^.]+$/, '') + '_samples.csv';
    downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }), filename);
    return step;
  }

  global.VFTerrainIO = Object.freeze({
    open: open,
    loadGeoTiff: loadGeoTiff,
    loadAsciiGrid: loadAsciiGrid,
    saveAscii: saveAscii,
    saveGeoTiff: saveGeoTiff,
    saveCsv: saveCsv,
    downloadBlob: downloadBlob,
    addSuffix: addSuffix
  });
})(window);
