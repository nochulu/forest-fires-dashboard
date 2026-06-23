const Charts = (() => {
    let lineChart = null;
    let barChart = null;
    let globalData = null;

    const INDEX_COLORS = {
        NDVI: '#4caf82',
        NBR:  '#e07b39',
        EVI:  '#5b9bd5',
        NDWI: '#9b59b6',
        SAVI: '#f1c40f'
    };

    const scaleStyle = {
        ticks: { color: '#8b90a8', font: { size: 10 }, maxRotation: 45 },
        grid: { color: '#363a57' }
    };

    function getIndex() {
        return document.getElementById('filter-index')?.value || 'NDVI';
    }

    function renderLine(labels, data, indexName) {
        const ctx = document.getElementById('chart-line').getContext('2d');
        if (lineChart) lineChart.destroy();
        const color = INDEX_COLORS[indexName] || '#4caf82';
        lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: indexName,
                    data,
                    borderColor: color,
                    backgroundColor: color + '22',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: scaleStyle, y: scaleStyle }
            }
        });
    }

    function renderBar(labels, data) {
        const ctx = document.getElementById('chart-bar').getContext('2d');
        if (barChart) barChart.destroy();
        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Площадь (га)',
                    data,
                    backgroundColor: '#4caf8255',
                    borderColor: '#4caf82',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: scaleStyle, y: scaleStyle }
            }
        });
    }

    // загружаем глобальные данные и рисуем оба графика
    async function loadGlobal() {
        const res = await fetch('data/dashboard_data.json');
        globalData = await res.json();
        renderGlobalLine();
        loadBarFromMetadata();
    }

    function renderGlobalLine() {
        if (!globalData) return;
        const idx = getIndex();
        const key = idx + '_median';
        const byYear = globalData.vi_by_year;
        renderLine(
            byYear.map(d => d.year),
            byYear.map(d => d[key] ?? null),
            idx
        );
    }

    function loadBarFromMetadata() {
        Papa.parse('data/dashboard_fires_metadata.csv', {
            download: true,
            header: true,
            complete({ data }) {
                const valid = data.filter(r => r.fire_id && r.Area);
                const top10 = valid
                    .sort((a, b) => parseFloat(b.Area) - parseFloat(a.Area))
                    .slice(0, 10);
                renderBar(
                    top10.map(r => 'ID ' + r.fire_id),
                    top10.map(r => Math.round(parseFloat(r.Area)))
                );
            }
        });
    }

    // пожар выбран на карте - показать его динамику
    EventBus.on('fire:data', ({ rows }) => {
        if (!rows?.length) return;
        const idx = getIndex();
        const key = idx + '_median';
        const sorted = [...rows].sort((a, b) => +a.year - +b.year);
        renderLine(
            sorted.map(r => r.year),
            sorted.map(r => parseFloat(r[key]) || null),
            idx
        );
    });

    // пожар снят - вернуть глобальный график
    EventBus.on('fire:deselected', () => renderGlobalLine());

    // сменили индекс - перерисовать
    EventBus.on('filter:change', () => renderGlobalLine());

    EventBus.on('forestry:data', ({ labels, values }) => {
        renderBar(labels, values);
    });

    return { loadGlobal };
})();