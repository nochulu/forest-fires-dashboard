const MapModule = (() => {
    let map = null;
    let firesLayer = null;
    let lesnLayer = null;
    let currentIndex = 'NDVI';
    let firesGeoJSON = null;
    let lesnData = null;

    // Цветовая шкала для индекса: от красного (низкий) до зелёного (высокий)
    function getColor(value, min, max) {
        if (value === null || value === undefined) return '#666';
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        const r = Math.round(255 * (1 - t));
        const g = Math.round(180 * t);
        return `rgb(${r},${g},30)`;
    }

    // Инициализация карты
    function init() {
        map = L.map('map', { center: [57.5, 103.5], zoom: 6 });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 18
        }).addTo(map);

        loadFires();
        loadLesnichestva();
    }

    // Загрузка полигонов пожаров
    function loadFires() {
        fetch('data/fires_2005_irk_filtered.geojson')
            .then(r => r.json())
            .then(geojson => {
                firesGeoJSON = geojson;
                renderFires();
            });
    }

    function renderFires(highlightIds = null) {
        if (firesLayer) map.removeLayer(firesLayer);

        firesLayer = L.geoJSON(firesGeoJSON, {
            style(feature) {
                const isHighlighted = !highlightIds ||
                    highlightIds.includes(String(feature.properties.fire_id));
                return {
                    color: '#ff6b35',
                    weight: isHighlighted ? 2 : 1,
                    fillColor: '#ff6b35',
                    fillOpacity: isHighlighted ? 0.5 : 0.15,
                    opacity: isHighlighted ? 1 : 0.4
                };
            },
            onEachFeature(feature, layer) {
                const p = feature.properties;

                // Подсказка при наведении
                layer.bindTooltip(
                    `ID: ${p.fire_id}<br>Площадь: ${Math.round(p.Area)} га`,
                    { sticky: true }
                );

                // Клик — выбрать пожар
                layer.on('click', () => {
                    EventBus.emit('fire:selected', {
                        fireId: String(p.fire_id)
                    });
                    highlightFire(String(p.fire_id));
                });
            }
        }).addTo(map);
    }

    // Подсветить один выбранный пожар
    function highlightFire(fireId) {
        firesLayer.eachLayer(layer => {
            const id = String(layer.feature.properties.fire_id);
            if (id === fireId) {
                layer.setStyle({
                    color: '#fff',
                    weight: 3,
                    fillOpacity: 0.7
                });
                layer.bringToFront();
            } else {
                layer.setStyle({
                    color: '#ff6b35',
                    weight: 1,
                    fillOpacity: 0.15,
                    opacity: 0.4
                });
            }
        });
    }

    // Загрузка лесничеств
    function loadLesnichestva() {
        fetch('data/lesnichestva.geojson')
            .then(r => r.json())
            .then(geojson => {
                lesnData = geojson;

                lesnLayer = L.geoJSON(geojson, {
                    style: {
                        color: '#4caf82',
                        weight: 1.5,
                        fillOpacity: 0,
                        dashArray: '4 4'
                    },
                    onEachFeature(feature, layer) {
                        if (feature.properties.name || feature.properties.NAME) {
                            layer.bindTooltip(
                                feature.properties.name || feature.properties.NAME
                            );
                        }
                    }
                }).addTo(map);

                doSpatialJoin();
            });
    }

    // Spatial join: определить в каком лесничестве каждый пожар
    function doSpatialJoin() {
        if (!firesGeoJSON || !lesnData) return;

        const byForestry = {};

        firesGeoJSON.features.forEach(fire => {
            const center = turf.centroid(fire);
            let foundName = 'Неизвестно';

            lesnData.features.forEach(lesn => {
                if (turf.booleanPointInPolygon(center, lesn)) {
                    foundName = lesn.properties.name ||
                                lesn.properties.NAME ||
                                lesn.properties.forestry ||
                                'Лесничество';
                }
            });

            // Сохраняем лесничество в свойства пожара
            fire.properties.forestry = foundName;

            const area = parseFloat(fire.properties.Area) || 0;
            byForestry[foundName] = (byForestry[foundName] || 0) + area;
        });

        // Передаём данные в столбчатую диаграмму
        const sorted = Object.entries(byForestry)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        EventBus.emit('forestry:data', {
            labels: sorted.map(e => e[0]),
            values: sorted.map(e => Math.round(e[1]))
        });

        // Наполнить дропдаун лесничеств
        populateForestryFilter(Object.keys(byForestry).sort());
    }

    function populateForestryFilter(names) {
        const sel = document.getElementById('filter-forestry');
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
        });
    }

    // Слушаем фильтры
    EventBus.on('filter:change', (filters) => {
        if (!firesGeoJSON) return;

        // Фильтр по лесничеству — подсветить нужные
        if (filters.forestry) {
            const ids = firesGeoJSON.features
                .filter(f => f.properties.forestry === filters.forestry)
                .map(f => String(f.properties.fire_id));
            renderFires(ids);
        } else {
            renderFires();
        }
    });

    // Снятие выбора пожара
    EventBus.on('fire:deselected', () => renderFires());

    return { init };
})();

// Запуск карты
MapModule.init();