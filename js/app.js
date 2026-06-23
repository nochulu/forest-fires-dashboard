let viData = [];
let firesMetadata = {};

async function loadViData() {
    return new Promise(resolve => {
        Papa.parse('data/vi_wide_format.csv', {
            download: true, header: true,
            complete({ data }) {
                viData = data.filter(r => r.fire_id && r.year);
                resolve();
            }
        });
    });
}

async function loadMetadata() {
    return new Promise(resolve => {
        Papa.parse('data/dashboard_fires_metadata.csv', {
            download: true, header: true,
            complete({ data }) {
                data.forEach(r => { if (r.fire_id) firesMetadata[r.fire_id] = r; });
                resolve();
            }
        });
    });
}

function initFireDropdown() {
    const sel = document.getElementById('filter-fire');
    Papa.parse('data/dashboard_fires_metadata.csv', {
        download: true, header: true,
        complete({ data }) {
            data.filter(r => r.fire_id).forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.fire_id;
                opt.textContent = 'ID ' + r.fire_id +
                    (r.Area ? ' (' + Math.round(parseFloat(r.Area)).toLocaleString('ru') + ' га)' : '');
                sel.appendChild(opt);
            });
        }
    });
    sel.addEventListener('change', () => {
        const fireId = sel.value;
        if (fireId) {
            EventBus.emit('fire:selected', { fireId });
        } else {
            EventBus.emit('fire:deselected');
            hideAnalytics();
        }
    });
}

function initYearDropdown() {
    const sel = document.getElementById('filter-year');
    for (let y = 2000; y <= 2025; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        sel.appendChild(opt);
    }
}

function getFilters() {
    return {
        forestry:   document.getElementById('filter-forestry').value,
        index:      document.getElementById('filter-index').value,
        year:       document.getElementById('filter-year').value,
        period:     document.getElementById('filter-period').value,
        area:       parseInt(document.getElementById('filter-area').value),
        vegetation: document.getElementById('filter-vegetation').value
    };
}

function bindFilters() {
    ['filter-forestry','filter-index','filter-year','filter-period','filter-vegetation']
        .forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                EventBus.emit('filter:change', getFilters());
            });
        });

    const slider = document.getElementById('filter-area');
    const label  = document.getElementById('area-max-label');
    slider.addEventListener('input', () => {
        label.textContent = parseInt(slider.value).toLocaleString('ru');
        EventBus.emit('filter:change', getFilters());
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        document.getElementById('filter-fire').value      = '';
        document.getElementById('filter-forestry').value  = '';
        document.getElementById('filter-index').value     = 'NDVI';
        document.getElementById('filter-year').value      = '';
        document.getElementById('filter-period').value    = 'all';
        document.getElementById('filter-area').value      = 500000;
        document.getElementById('filter-vegetation').value = '';
        label.textContent = '500 000';
        EventBus.emit('filter:change', getFilters());
        EventBus.emit('fire:deselected');
        hideAnalytics();
    });
}

function calcDuration(dt_first, dt_last) {
    if (!dt_first || !dt_last) return null;
    const days = Math.round(
        (new Date(dt_last) - new Date(dt_first)) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? days : 1;
}

function showAnalytics(fireId) {
    const meta     = firesMetadata[fireId];
    const rows     = viData.filter(r => r.fire_id == fireId);
    const idx      = document.getElementById('filter-index').value || 'NDVI';
    const key      = idx + '_median';
    const before   = rows.find(r => r.year == '2004');
    const after    = rows.find(r => r.year == '2006');
    const beforeVal = before ? parseFloat(before[key]) : null;
    const afterVal  = after  ? parseFloat(after[key])  : null;
    const change    = (beforeVal && afterVal)
        ? (((afterVal - beforeVal) / Math.abs(beforeVal)) * 100).toFixed(1)
        : null;
    const duration  = meta ? calcDuration(meta.dt_first, meta.dt_last) : null;

    document.getElementById('stat-id').textContent       = fireId;
    document.getElementById('stat-area').textContent     = meta?.Area
        ? Math.round(parseFloat(meta.Area)).toLocaleString('ru') + ' га' : '—';
    document.getElementById('stat-duration').textContent = duration
        ? duration + ' дней' : '—';
    document.getElementById('stat-before').textContent   = beforeVal?.toFixed(4) ?? '—';
    document.getElementById('stat-after').textContent    = afterVal?.toFixed(4)  ?? '—';

    const changeEl = document.getElementById('stat-change');
    if (change !== null) {
        changeEl.textContent = (change > 0 ? '+' : '') + change + '%';
        changeEl.style.color = change < 0 ? '#e07b39' : '#4caf82';
    } else {
        changeEl.textContent = '—';
    }

    document.getElementById('analytics-placeholder').style.display = 'none';
    document.getElementById('analytics-content').style.display     = 'block';
}

function hideAnalytics() {
    document.getElementById('analytics-placeholder').style.display = 'block';
    document.getElementById('analytics-content').style.display     = 'none';
}

// Пожар выбран — передать данные графикам через отдельное событие
EventBus.on('fire:selected', ({ fireId }) => {
    const rows = viData.filter(r => r.fire_id == fireId);
    EventBus.emit('fire:data', { fireId, rows }); // не fire:selected!
    showAnalytics(fireId);
});

document.addEventListener('DOMContentLoaded', async () => {
    initFireDropdown();
    initYearDropdown();
    bindFilters();
    await Promise.all([loadViData(), loadMetadata()]);
    Charts.loadGlobal();
});