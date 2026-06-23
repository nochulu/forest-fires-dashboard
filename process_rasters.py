import os
import rasterio
import matplotlib.pyplot as plt
import numpy as np
import json

print("Запуск массовой обработки космических снимков (50+ файлов)...")

script_dir = os.path.dirname(os.path.abspath(__file__))
# Путь к папке с растрами
raster_dir = os.path.join(script_dir, "data", "_Лесные районы", "_Лесные районы")
output_dir = os.path.join(script_dir, "data")

cmap = plt.get_cmap('RdYlGn')
tif_files = [f for f in os.listdir(raster_dir) if f.lower().endswith(('.tif', '.tiff'))]

# Словарь, куда мы запишем координаты для каждого файла
metadata = {}

if not tif_files:
    print(f"Растровые файлы .tif не найдены в папке {raster_dir}")
else:
    print(f"Найдено файлов для обработки: {len(tif_files)}")
    
    for idx, tif_name in enumerate(tif_files, 1):
        tif_path = os.path.join(raster_dir, tif_name)
        png_name = os.path.splitext(tif_name)[0] + ".png"
        png_path = os.path.join(output_dir, png_name)
        
        print(f"[{idx}/{len(tif_files)}] Обработка: {tif_name}")
        
        try:
            with rasterio.open(tif_path) as src:
                # 1. Читаем и конвертируем в PNG
                raster_data = src.read(1)
                raster_data = np.where(raster_data == src.nodata, np.nan, raster_data)
                
                vmin, vmax = -0.1, 0.8
                normalized_data = (raster_data - vmin) / (vmax - vmin)
                normalized_data = np.clip(normalized_data, 0, 1)
                
                rgba_image = cmap(normalized_data)
                rgba_image[np.isnan(raster_data), 3] = 0
                
                plt.imsave(png_path, rgba_image)
                
                # 2. Вытаскиваем координаты углов
                bounds = src.bounds
                # Формат Leaflet: [[юг, запад], [север, восток]]
                leaflet_bounds = [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]
                
                # Сохраняем в наш общий словарь
                metadata[png_name] = {
                    "bounds": leaflet_bounds
                }
                
        except Exception as e:
            print(f"Ошибка при обработке файла {tif_name}: {e}")

    # Сохраняем итоговый JSON-файл со всеми координатами
    json_path = os.path.join(output_dir, "rasters_metadata.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)
        
    print(f"\nУспешно! Все файлы обработаны.")
    print(f"Итоговый файл с координатами сохранен в: data/rasters_metadata.json")