# Vietflex Terrain Editor

**CAD-style DEM & basic map editor for the web**

Vietflex Terrain Editor là giao diện biên tập bản đồ/DEM cơ bản theo phong cách AutoCAD, chạy trực tiếp trên trình duyệt và kế thừa renderer/core từ [Vietflex OpenMap](https://github.com/Vietflexmap/openmap).

## Mục tiêu

- Crosshair toàn màn hình để chấm điểm và đọc X/Y/Z.
- Mở DEM cục bộ từ GeoTIFF và ESRI ASCII Grid (.asc).
- Hiển thị DEM, color relief, hillshade, slope, aspect.
- Truy vấn cao độ tại con trỏ.
- Clip DEM theo rectangle/polygon.
- Contour nhanh trong trình duyệt.
- Undo/redo ở mức thao tác raster cơ bản.
- Xuất GeoTIFF, ASCII Grid, CSV/GeoJSON mẫu và in bản đồ.
- Dùng Vietflex OpenMap làm basemap/renderer; sẵn đường nối sang Vietflex terrain manifest.
- Kiến trúc adapter-first để nối GDAL/PDAL/RichDEM/xDEM/DEM.Net hoặc WASM/backend sau này.

## Kiến trúc

```text
                    VIETFLEX TERRAIN EDITOR
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          CAD UI         MAP/DRAW CORE      COMMAND CORE
             │                │                │
             └────────────────┼────────────────┘
                              │
                       DEM DOCUMENT MODEL
           raster + CRS + affine + nodata + provenance
                              │
        ┌───────────────┬─────┼─────┬─────────────────┐
        │               │           │                 │
     IO CORE         RASTER      TERRAIN          HYDRO/LIDAR
  TIFF/ASC/CSV     clip/resample slope/...       adapters
        │               │           │                 │
        └───────────────┴─────┬─────┴─────────────────┘
                              │
                         ADAPTER LAYER
       browser-js / WASM / local service / cloud API / MCP
                              │
     ┌────────────┬───────────┼──────────┬───────────────┐
     │            │           │          │               │
 geotiff.js     GDAL        PDAL      RichDEM/xDEM    DEM.Net
     │
 Vietflex OpenMap / MapLibre renderer
```

## Phạm vi V0.1

### Chạy trực tiếp trong browser

- GeoTIFF: read metadata, read band 1, render, query elevation.
- GeoTIFF: export bằng `geotiff.js writeArrayBuffer` (writer hiện ghi TIFF không nén).
- ASCII Grid: read/write.
- DEM render: elevation color relief / hillshade / slope / aspect.
- Basic edit: rectangle clip, polygon clip, clear, undo/redo.
- Analysis: contour preview, point elevation.
- Output: GeoTIFF, ASC, CSV sample, print.
- CAD UX: crosshair, coordinate/elevation HUD, command line, layer panel, properties panel.

### Adapter/roadmap

Các nhóm chức năng lớn được giữ ở lớp engine adapter thay vì nhồi tất cả vào bundle giao diện:

1. **IO & conversion** — GeoTIFF/COG, ASC, SRTM, format conversion.
2. **LiDAR/point cloud** — LAS/LAZ read/write, ground filter, classification, DEM/DSM/CHM.
3. **Raster processing** — mosaic, blend, resample, reprojection, sink fill, denoise, smooth, vertical correction.
4. **Terrain** — slope, aspect, hillshade, curvature, roughness, TPI, TRI, TWI, SPI, gradient/Laplacian.
5. **Hydrology** — D8, D-infinity, MFD, accumulation, streams, watershed, runoff/flooding.
6. **Geomorphology** — peaks, divides, valley/plateau/plain/depression/fault detection.
7. **3D** — mesh, terrain 3D, glTF/STL, volume, surface area, shadow/solar/viewshed.
8. **Change/QA** — DEM of Difference, vertical change, error, checkpoint correction.
9. **Interpolation/fusion** — points→DEM, LiDAR→DEM, RGB-D→elevation, multi-source fusion.
10. **Tiling/web** — DEM tiles, streaming, browser 3D, sampling/profile/API.

## Engine strategy

- **Browser baseline:** Vietflex OpenMap + MapLibre, geotiff.js, proj4js, d3-contour.
- **C/C++/native:** GDAL; RichDEM/GDEM/FastDEM có thể được bọc thành service/WASM tùy giấy phép và build target.
- **Python:** xDEM, GDAL/rasterio stack, các terrain/hydrology packages.
- **Point cloud:** PDAL là adapter ưu tiên cho LAS/LAZ và pipeline LiDAR.
- **Rust/WASM:** các thư viện terrain/raster phù hợp có thể đóng gói thành WebAssembly.
- **.NET:** DEM.Net/Pmad.Cartography phù hợp cho dịch vụ C# hoặc desktop companion.

## Nguyên tắc dữ liệu

- Không gắn nhãn một nguồn là “DEM Việt Nam chính thức” nếu chưa có dataset, license và provenance rõ ràng.
- `openmap/terrain/manifest.json` hiện là contract terrain; editor đọc lớp terrain qua OpenMap nhưng vẫn cho mở GeoTIFF/ASC local.
- Mọi dataset production cần ghi nguồn, phiên bản, CRS ngang, datum/cao độ đứng, độ phân giải, nodata và ngày cập nhật.

## Chạy

Mở `index.html` qua GitHub Pages hoặc một static web server. Không cần build step.

> Với DEM lớn, nên dùng COG/tiles hoặc engine backend/WASM. Việc đọc toàn bộ GeoTIFF vào RAM phù hợp cho DEM nhỏ-vừa và biên tập nhanh trên máy người dùng.


## V0.3 UX

- Mặc định dùng giao diện CAD sáng, trung tính và ít mỏi mắt.
- Sửa lỗi Command Palette backdrop có thể làm tối toàn màn hình khi thuộc tính `hidden` bị CSS ghi đè.
- F10: Focus Map; F3: SNAP; F8: ORTHO.
- Crosshair chạy theo `requestAnimationFrame`; truy vấn X/Y/Z được throttle để giảm tải CPU.
- Cập nhật sketch GeoJSON tối đa khoảng 30 FPS khi đang rê chuột.
- Preview DEM dùng Blob/Object URL thay cho base64 Data URL để giảm RAM.
- Bỏ `backdrop-filter` ở HUD để tránh compositing GPU liên tục.
- Có light/dark theme, mặc định light và ghi nhớ lựa chọn.
