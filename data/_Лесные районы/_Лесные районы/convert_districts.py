import geopandas as gpd

print("Начало конвертации лесных районов...")

# Читаем шейп-файл
districts = gpd.read_file("data/_Лесные районы/_Лесные районы/raioni_fin_2018.shp")

# Переводим в географическую систему координат WGS84 для веб-карт
districts = districts.to_crs(epsg=4326)

# Оставляем только нужную напарнику информацию: название района и его геометрию
districts = districts[['Name', 'geometry']]

# Сохраняем в GeoJSON
districts.to_file("data/_Лесные районы/_Лесные районы/forest_districts.geojson", driver="GeoJSON")

print("Успешно! Файл forest_districts.geojson готов.")