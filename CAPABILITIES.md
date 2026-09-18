# Vietflex Terrain Editor — Capability Matrix

Trạng thái:
- **BROWSER**: đã có engine JavaScript chạy trực tiếp trong V0.1.
- **PARTIAL**: đã có phần nền tảng nhưng chưa phải workflow production đầy đủ.
- **ADAPTER**: giao diện/kiến trúc đã chừa cổng; cần nối engine chuyên dụng (GDAL/PDAL/RichDEM/xDEM/WASM/.NET/service).
- **ROADMAP**: chưa triển khai engine.

| # | Capability | V0.1 | Ghi chú / engine đích |
|---:|---|---|---|
| 1 | Ghi DEM ra GeoTIFF | BROWSER | geotiff.js writer; TIFF hiện ghi không nén |
| 2 | Đọc DEM từ ASCII Grid (.asc) | BROWSER | ESRI ASCII Grid |
| 3 | Xuất DEM ra ASCII Grid | BROWSER | ESRI ASCII Grid |
| 4 | Đọc dữ liệu SRTM | ADAPTER | GDAL/COG/STAC/fetch service |
| 5 | Đọc LiDAR LAS/LAZ | ADAPTER | PDAL / laz-perf / WASM |
| 6 | Xuất point cloud LAS/LAZ | ADAPTER | PDAL |
| 7 | Chuyển đổi raster DEM | ADAPTER | GDAL/WASM/backend |
| 8 | Đọc metadata CRS/transform | BROWSER | GeoKeys, bbox, resolution, NoData |
| 9 | Ghi metadata địa lý | PARTIAL | GeoTIFF tiepoint/pixel scale/EPSG/NoData |
| 10 | Cắt DEM bounding box | BROWSER | crop raster |
| 11 | Cắt DEM polygon | BROWSER | crop + mask |
| 12 | Ghép nhiều DEM | ADAPTER | GDAL buildvrt/warp |
| 13 | Blend nhiều DEM | ADAPTER | GDAL/xDEM |
| 14 | Resample DEM | ADAPTER | GDAL/WASM |
| 15 | Reproject DEM | PARTIAL | tọa độ hiển thị/clip có proj4; raster reprojection cần GDAL |
| 16 | Fill sinks | ADAPTER | RichDEM/Whitebox/GRASS |
| 17 | Loại nhiễu | ADAPTER | GDAL/scipy/OpenCV |
| 18 | Làm mượt DEM | ADAPTER | native/WASM |
| 19 | Hiệu chỉnh độ cao đứng | ADAPTER | xDEM + vertical datum grids |
| 20 | Slope | BROWSER | Horn 3×3 preview |
| 21 | Aspect | BROWSER | gradient 3×3 preview |
| 22 | Hillshade | BROWSER | analytical hillshade preview |
| 23 | Curvature | ADAPTER | terrain engine |
| 24 | Roughness | ADAPTER | terrain engine |
| 25 | TPI | ADAPTER | terrain engine |
| 26 | TRI | ADAPTER | terrain engine |
| 27 | TWI | ADAPTER | hydrology engine |
| 28 | SPI | ADAPTER | hydrology engine |
| 29 | Relative elevation | ADAPTER | terrain engine |
| 30 | Mean slope | ADAPTER | zonal terrain stats |
| 31 | Max slope | ADAPTER | zonal terrain stats |
| 32 | Directional slope | ADAPTER | terrain engine |
| 33 | Gradient | PARTIAL | nội bộ dùng cho slope/aspect/hillshade |
| 34 | Laplacian | ADAPTER | raster kernel |
| 35 | Flow direction D8 | ADAPTER | RichDEM/GRASS/Whitebox |
| 36 | Flow direction D-infinity | ADAPTER | hydrology engine |
| 37 | Flow direction MFD | ADAPTER | hydrology engine |
| 38 | Flow accumulation | ADAPTER | hydrology engine |
| 39 | Stream extraction | ADAPTER | hydrology engine |
| 40 | Watershed | ADAPTER | hydrology engine |
| 41 | Basin subdivision | ADAPTER | hydrology engine |
| 42 | Flow length | ADAPTER | hydrology engine |
| 43 | Distance to channel | ADAPTER | raster/vector distance |
| 44 | Flow connectivity index | ADAPTER | hydrology engine |
| 45 | Simple flood simulation | ADAPTER | flood engine |
| 46 | Surface runoff | ADAPTER | hydrology engine |
| 47 | Peak detection | ADAPTER | geomorphology engine |
| 48 | Divide/ridge detection | ADAPTER | geomorphology engine |
| 49 | Contours | BROWSER | d3-contour preview |
| 50 | 3D model from DEM | ADAPTER | MapLibre terrain / three.js |
| 51 | glTF export | ADAPTER | mesh pipeline |
| 52 | STL export | ADAPTER | mesh pipeline |
| 53 | Triangular mesh | ADAPTER | Delaunay/terrain mesh |
| 54 | Terrain volume | ADAPTER | cut/fill engine |
| 55 | Surface area | ADAPTER | mesh/raster engine |
| 56 | Euclidean distance | ADAPTER | raster distance |
| 57 | Manhattan distance | ADAPTER | raster distance |
| 58 | Viewshed | ADAPTER | GDAL/GRASS/WASM |
| 59 | Solar analysis | ADAPTER | GRASS/SAGA/custom |
| 60 | Shadow analysis | ADAPTER | 3D/solar engine |
| 61 | Terrain classification | ADAPTER | rules/ML |
| 62 | Landform segmentation | ADAPTER | geomorphology/ML |
| 63 | Slope detection | PARTIAL | slope surface available |
| 64 | Valley detection | ADAPTER | geomorphology |
| 65 | Plateau detection | ADAPTER | geomorphology |
| 66 | Plain detection | ADAPTER | geomorphology |
| 67 | Depression detection | ADAPTER | hydrology/geomorphology |
| 68 | Terrain break/fault detection | ADAPTER | multiscale derivatives/ML |
| 69 | DEM temporal change | ADAPTER | xDEM/DoD |
| 70 | Compare two DEMs | ADAPTER | xDEM |
| 71 | Elevation change | ADAPTER | DoD |
| 72 | DEM error | ADAPTER | QA/statistics |
| 73 | Checkpoint correction | ADAPTER | xDEM / regression |
| 74 | Interpolate points → DEM | ADAPTER | GDAL/PDAL/scipy |
| 75 | LiDAR → DEM | ADAPTER | PDAL |
| 76 | LiDAR → DSM | ADAPTER | PDAL |
| 77 | LiDAR → CHM | ADAPTER | PDAL/raster algebra |
| 78 | Ground filtering | ADAPTER | PDAL/CSF/SMRF |
| 79 | Point-cloud classification | ADAPTER | PDAL/ML |
| 80 | RGB-D elevation model | ADAPTER | FastDEM/robotics engine |
| 81 | Multi-source DEM fusion | ADAPTER | CUDEM/GDAL/xDEM |
| 82 | DEM tiling | ADAPTER | GDAL/rio-tiler/terrain-rgb |
| 83 | DEM tile streaming | ADAPTER | COG/tiles/object storage |
| 84 | Web DEM display | BROWSER | Vietflex OpenMap + MapLibre image raster |
| 85 | Interactive 3D DEM | ADAPTER | OpenMap terrain contract / three.js |
| 86 | Measure on DEM | PARTIAL | X/Y/Z cursor + sketch; terrain distance/profile roadmap |
| 87 | Elevation query at coordinate | BROWSER | cursor/point Z |
| 88 | Sample along line | ROADMAP | profile tool |
| 89 | Sample by region | ROADMAP | zonal stats |
| 90 | Elevation point grid | ROADMAP | sampling engine |
| 91 | DEM → CSV | BROWSER | sampled CSV |
| 92 | DEM → JSON | ROADMAP | streaming/size guard required |
| 93 | DEM → GeoJSON | ROADMAP | point/contour export preferred |
| 94 | DEM → point cloud | ADAPTER | PDAL |
| 95 | Point cloud → DEM | ADAPTER | PDAL |
| 96 | Slope index | ADAPTER | terrain metrics |
| 97 | Elevation index | ADAPTER | terrain metrics |
| 98 | Geomorphology index | ADAPTER | terrain/ML |
| 99 | C++ / Python / Rust / JS / .NET APIs | ARCHITECTURE | Adapter Layer; browser JS is first implementation |

## CRS V0.1

- EPSG:4326 WGS84.
- EPSG:3857 Web Mercator.
- WGS84 UTM zones EPSG:326xx / EPSG:327xx.
- VN-2000 / UTM zone 48N EPSG:3405.
- VN-2000 / UTM zone 49N EPSG:3406.
- Các hệ VN-2000 địa phương dùng kinh tuyến trục/múi 3° cần profile CRS riêng thay vì gán nhầm EPSG.

## Nguyên tắc production

Browser engine ưu tiên **preview, QA và thao tác nhanh**. Mosaic lớn, reprojection raster, hydrology, LiDAR, viewshed, 3D export và DEM fusion nên chạy qua adapter native/WASM/backend có quản lý RAM, tiling, provenance và kiểm thử số học.
