window.HELP_IMPROVE_VIDEOJS = false;

function initCarousel() {
    var carousel = bulmaCarousel.attach('#video-carousel', {
        slidesToShow: 1,
        slidesToScroll: 1,
        loop: true,
        infinite: true,
        autoplay: false,
        duration: 300,
        pagination: true
    })[0];

    if (carousel) {
        carousel.on('before:show', () => {
            const videos = document.querySelectorAll('.carousel video');
            videos.forEach(video => {
                video.pause();
                video.currentTime = 0;
            });
        });
    }
}

function loadScoreData() {
    const loadingText = document.getElementById('scores-chart-loading');
    if (loadingText) {
        loadingText.textContent = 'Loading chart...';
    }
    return fetch('static/data/aggregated_scores.json', {
        headers: {
            'Cache-Control': 'no-cache'
        }
    })
        .then(response => response.json());
}

function prepareChartData(data) {
    const conditioningMap = {
        'single_frame_conditioning': 'single',
        'multi_frame_conditioning': 'multi',
        'keyframe_interpolation': 'keyframe'
    };

    return data
        .filter(d => conditioningMap[d.conditioning])
        .map(d => ({
            model: d.model,
            conditioning: conditioningMap[d.conditioning],
            label: `${d.model} (${conditioningMap[d.conditioning]})`,
            statistical: d.statistical,
            physical: d.physical,
            total: d.total
        }));
}

function renderChart(data) {
    const loadingText = document.getElementById('scores-chart-loading');
    const chartData = prepareChartData(data);

    if (!chartData.length) {
        if (loadingText) {
            loadingText.style.display = 'block';
            loadingText.textContent = 'No data available.';
        }
        return;
    }

    const singleData = chartData.filter(d => d.conditioning === 'single')
        .sort((a, b) => (b.total - a.total) || (b.physical - a.physical));
    const multiData = chartData.filter(d => d.conditioning !== 'single')
        .sort((a, b) => (b.total - a.total) || (b.physical - a.physical));

    const stacked = [...singleData, ...multiData];

    const modelColors = {
        'COSMOS-predict1': '#3A86FF',
        'COSMOS-predict2': '#5A96FF',
        'CogVideo': '#FFBE0B',
        'LTX': '#8338EC',
        'PyramidalFlow': '#FB5607',
        'Veo3': '#FF006E',
        'Veo3-fast': '#FF4081',
        'WAN-2.1': '#45B7D1'
    };

    const patternConfig = {
        single: '/',
        multi: '/',
        keyframe: '\\'
    };

    const adjustBrightness = (color, factor = 0.2) => {
        const c = d3.color(color);
        if (!c) return color;
        const clamp = value => Math.max(0, Math.min(255, value));
        const newR = clamp(c.r + (factor >= 0 ? (255 - c.r) * factor : c.r * factor));
        const newG = clamp(c.g + (factor >= 0 ? (255 - c.g) * factor : c.g * factor));
        const newB = clamp(c.b + (factor >= 0 ? (255 - c.b) * factor : c.b * factor));
        return d3.rgb(newR, newG, newB).formatHex();
    };

    const labels = stacked.map(d => `${d.model}<br>(${d.conditioning})`);
    const dynamicalValues = stacked.map(d => d.statistical);
    const physicalValues = stacked.map(d => d.physical);
    const totals = stacked.map(d => d.total);

    const baseColors = stacked.map(d => modelColors[d.model] || '#999999');
    const dynamicalFills = baseColors.map(color => adjustBrightness(color, -0.15));
    const physicalStyles = stacked.map(d => patternConfig[d.conditioning] || patternConfig.multi);

    const dynamicalTrace = {
        x: labels,
        y: dynamicalValues,
        name: 'Dynamical Score',
        type: 'bar',
        marker: {
            color: dynamicalFills,
            line: { color: baseColors, width: 1 }
        },
        legendgroup: 'score-types',
        legendgrouptitle: { text: 'Score Types' },
        legendrank: 1
    };

    const physicalColors = baseColors.map(color => adjustBrightness(color, 0.35));
    const physicalTrace = {
        x: labels,
        y: physicalValues,
        name: 'Physical Invariance Score',
        type: 'bar',
        marker: {
            color: physicalColors,
            line: { color: baseColors, width: 1 },
            pattern: {
                shape: stacked.map(d => patternConfig[d.conditioning] || '/'),
                fgcolor: baseColors,
                bgcolor: physicalColors,
                size: 6,
                solidity: 0.5,
                spacing: 4,
                fillmode: 'overlay'
            }
        },
        legendgroup: 'score-types',
        legendrank: 2
    };

    const layout = {
        barmode: 'stack',
        margin: { t: 20, l: 70, r: 30, b: 140 },
        legend: { orientation: 'h', y: 1.12, font: { size: 14 } },
        xaxis: {
            tickangle: -25,
            automargin: true,
            tickfont: { size: 13 },
            categoryorder: 'array',
            categoryarray: labels
        },
        yaxis: {
            title: 'Average Score (Dynamical + Physical) / 2',
            automargin: true,
            rangemode: 'tozero'
        },
        height: 520,
        shapes: singleData.length && multiData.length ? [{
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: singleData.length - 0.5,
            x1: singleData.length - 0.5,
            y0: 0,
            y1: 1,
            line: {
                color: '#666',
                width: 2,
                dash: 'dash'
            }
        }] : [],
        hovermode: 'closest',
        font: {
            family: 'Google Sans, Noto Sans, Arial, sans-serif',
            size: 14,
            color: '#222'
        }
    };

    const config = {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };

    const traces = [dynamicalTrace, physicalTrace];

    Plotly.newPlot('scores-chart', traces, layout, config)
        .then(() => {
            if (loadingText) {
                loadingText.style.display = 'none';
            }

            // Add total labels manually
            const maxTotal = Math.max(...totals);
            const offset = Math.max(maxTotal * 0.02, 0.02);
            const totalAnnotations = totals.map((value, idx) => ({
                x: labels[idx],
                y: dynamicalValues[idx] + physicalValues[idx] + offset,
                text: value.toFixed(2),
                showarrow: false,
                font: { size: 12, color: '#333', family: 'sans-serif', weight: 'bold' }
            }));

            Plotly.relayout('scores-chart', {
                annotations: totalAnnotations,
                shapes: layout.shapes
            });
        })
        .catch(err => {
            console.error('Error rendering Plotly chart:', err);
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = `Failed to render chart: ${err && err.message ? err.message : err}`;
            }
        });
}

function initScoresChart() {
    loadScoreData()
        .then(data => {
            renderChart(data);
        })
        .catch(err => {
            console.error('Failed to load score data:', err);
        });
}

document.addEventListener('DOMContentLoaded', function() {
    initCarousel();
    initScoresChart();
});

// Add global error handler
window.onerror = function(msg, url, line) {
    console.error('JavaScript error:', msg);
    console.error('File:', url);
    console.error('Line:', line);
};
