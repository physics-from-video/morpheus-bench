window.HELP_IMPROVE_VIDEOJS = false;

const GENERATED_VIDEO_ROOT = 'static/videos/generated_videos';
const REAL_WORLD_VIDEO_ROOT = 'static/videos/real-world';

const VIDEO_EXPERIMENT_IDS = [
    'falling-ball',
    'falling-apple',
    'falling-marker',
    'falling-tape',
    'bouncing-ball',
    'projectile',
    'holonomic-pendulum',
    'non-holonomic-pendulum',
    'double-pendulum',
    'rolling-empty-can',
    'rolling-full-can',
    'rolling-orange',
    'sliding-book',
    'collision-big-hits-small',
    'collision-equal',
    'collision-small-hits-big',
    'spring'
];

const MODEL_CONDITIONINGS = {
    'CogVideo': ['single_frame_conditioning', 'multi_frame_conditioning', 'keyframe_interpolation'],
    'COSMOS-predict1': ['single_frame_conditioning', 'multi_frame_conditioning'],
    'COSMOS-predict2': ['single_frame_conditioning', 'multi_frame_conditioning'],
    'LTX': ['single_frame_conditioning', 'multi_frame_conditioning'],
    'PyramidalFlow': ['single_frame_conditioning', 'multi_frame_conditioning'],
    'Veo3': ['single_frame_conditioning'],
    'Veo3-fast': ['single_frame_conditioning'],
    'WAN-2.1': ['single_frame_conditioning', 'keyframe_interpolation']
};

const MODEL_PROMPTS = {
    'CogVideo': ['plain', 'enhanced'],
    'COSMOS-predict1': ['plain', 'enhanced'],
    'COSMOS-predict2': ['plain', 'enhanced'],
    'LTX': ['plain', 'enhanced'],
    'PyramidalFlow': ['plain', 'enhanced'],
    'Veo3': ['enhanced'],
    'Veo3-fast': ['enhanced'],
    'WAN-2.1': ['plain', 'enhanced']
};

const UNAVAILABLE_EXPERIMENTS = {
    'PyramidalFlow': {
        'multi_frame_conditioning': {
            'enhanced': ['bouncing_ball']
        },
        'single_frame_conditioning': {
            'plain': ['spring'],
            'enhanced': ['spring']
        }
    }
};

const REAL_WORLD_EXPERIMENTS = new Set([
    'falling_ball',
    'falling_apple',
    'falling_marker',
    'falling_tape',
    'bouncing_ball',
    'projectile',
    'holonomic_pendulum',
    'non_holonomic_pendulum',
    'double_pendulum',
    'rolling_empty_can',
    'rolling_full_can',
    'rolling_orange',
    'sliding_book',
    'spring',
    'collision_equal',
    'collision_small_hits_big',
    'collision_big_hits_small'
]);

const videoPathCache = new Map();

const MODEL_COLORS = {
    'COSMOS-predict1': '#3A86FF',
    'COSMOS-predict2': '#5A96FF',
    'CogVideo': '#FFBE0B',
    'LTX': '#8338EC',
    'PyramidalFlow': '#FB5607',
    'Veo3': '#FF006E',
    'Veo3-fast': '#FF4081',
    'WAN-2.1': '#45B7D1'
};

function adjustColorBrightness(color, factor = 0.2) {
    const base = d3.color(color);
    if (!base) return color;
    const clamp = value => Math.max(0, Math.min(255, value));
    const newR = clamp(factor >= 0 ? base.r + (255 - base.r) * factor : base.r * (1 + factor));
    const newG = clamp(factor >= 0 ? base.g + (255 - base.g) * factor : base.g * (1 + factor));
    const newB = clamp(factor >= 0 ? base.b + (255 - base.b) * factor : base.b * (1 + factor));
    return d3.rgb(newR, newG, newB).formatHex();
}

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
        loadingText.textContent = 'Loading aggregated score breakdown...';
    }

    return fetch('static/data/score_breakdown_aggregated_scores.csv', {
        headers: {
            'Cache-Control': 'no-cache'
        }
    })
        .then(response => response.text())
        .then(text => d3.csvParse(text, row => ({
            model: row.model,
            conditioning: row.conditioning,
            statisticalMean: parseFloat(row.statistical_score_mean) || 0,
            physicalMean: parseFloat(row.physical_score_mean) || 0,
            total: parseFloat(row.score_sum_mean) || 0,
            statisticalProportion: parseFloat(row.statistical_proportion) || 0,
            physicalProportion: parseFloat(row.physical_proportion) || 0
        })));
}

function prepareChartData(data) {
    const conditioningMap = {
        'single_frame_conditioning': 'single',
        'multi_frame_conditioning': 'multi',
        'keyframe_interpolation': 'keyframe'
    };

    const conditioningLabels = {
        single: 'single frame',
        multi: 'multiple frames',
        keyframe: 'first&last frame'
    };

    return data
        .filter(d => conditioningMap[d.conditioning])
        .map(d => ({
            model: d.model,
            conditioning: conditioningMap[d.conditioning],
            conditioningLabel: conditioningLabels[conditioningMap[d.conditioning]],
            label: `${d.model} (${conditioningMap[d.conditioning]})`,
            total: d.total,
            statisticalContribution: d.total * d.statisticalProportion,
            physicalContribution: d.total * d.physicalProportion,
            statisticalMean: d.statisticalMean,
            physicalMean: d.physicalMean,
            statisticalProportion: d.statisticalProportion,
            physicalProportion: d.physicalProportion
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
        .sort((a, b) => (b.total - a.total) || (b.physicalContribution - a.physicalContribution));
    const multiData = chartData.filter(d => d.conditioning !== 'single')
        .sort((a, b) => (b.total - a.total) || (b.physicalContribution - a.physicalContribution));

    const stacked = [...singleData, ...multiData];

    const patternConfig = {
        single: '\\',
        multi: '\\',
        keyframe: '\\'
    };

    const labels = stacked.map(d => `${d.model}<br>(${d.conditioning})`);
    const statisticalValues = stacked.map(d => d.statisticalContribution);
    const physicalValues = stacked.map(d => d.physicalContribution);
    const totals = stacked.map(d => d.total);

    const baseColors = stacked.map(d => MODEL_COLORS[d.model] || '#999999');
    const statisticalFills = baseColors.map(color => adjustColorBrightness(color, -0.15));

    const clamp01 = value => Math.max(0, Math.min(1, value));

    const statisticalTrace = {
        x: labels,
        y: statisticalValues,
        name: 'Dynamical Score',
        type: 'bar',
        marker: {
            color: statisticalFills,
            line: { color: baseColors, width: 1 }
        },
        legendgroup: 'score-types',
        legendgrouptitle: { text: 'Score Types' },
        legendrank: 1,
        customdata: stacked.map(d => [
            d.model,
            d.conditioningLabel,
            d.statisticalMean,
            d.statisticalProportion,
            d.total
        ]),
        hovertemplate: 'Model: %{customdata[0]}<br>' +
            'Conditioning: %{customdata[1]}<br>' +
            'Dynamical score: %{customdata[2]*2:.3f} (mean: %{customdata[2]:.3f})<br>' +
            'Contribution to total: %{y:.3f}<br>' +
            'Proportion: %{customdata[3]:.1%}<br>' +
            'Avg. score: %{customdata[4]:.3f}<extra></extra>'
    };

    const physicalColors = baseColors.map(color => adjustColorBrightness(color, 0.35));
    const fillMode = stacked.some(d => d.conditioning === 'keyframe') ? 'overlay' : 'replace';
    const physicalPatternShape = stacked.map(d => patternConfig[d.conditioning] || patternConfig.multi);

    const physicalTrace = {
        x: labels,
        y: physicalValues,
        name: 'Physical Score',
        type: 'bar',
        marker: {
            color: physicalColors,
            line: { color: baseColors, width: 1 },
            pattern: {
                shape: physicalPatternShape,
                fgcolor: baseColors,
                bgcolor: physicalColors,
                size: 6,
                spacing: 4,
                fillmode: fillMode,
                solidity: stacked.map(d => clamp01(d.physicalProportion))
            }
        },
        legendgroup: 'score-types',
        legendrank: 2,
        customdata: stacked.map(d => [
            d.model,
            d.conditioningLabel,
            d.physicalMean,
            d.physicalProportion,
            d.total
        ]),
        hovertemplate: 'Model: %{customdata[0]}<br>' +
            'Conditioning: %{customdata[1]}<br>' +
            'Physical score: %{customdata[2]*2:.3f} (mean: %{customdata[2]:.3f})<br>' +
            'Contribution to total: %{y:.3f}<br>' +
            'Proportion: %{customdata[3]:.1%}<br>' +
            'Avg. score: %{customdata[4]:.3f}<extra></extra>'
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

    const traces = [statisticalTrace, physicalTrace];

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
                y: statisticalValues[idx] + physicalValues[idx] + offset,
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

function loadDiscardData() {
    const loadingText = document.getElementById('discard-chart-loading');
    if (loadingText) {
        loadingText.textContent = 'Loading discard breakdown...';
    }

    return fetch('static/data/discard_stats_summary.csv', {
        headers: {
            'Cache-Control': 'no-cache'
        }
    })
        .then(response => response.text())
        .then(text => d3.csvParse(text, row => ({
            model: row.model,
            conditioning: row.conditioning,
            disappearanceRate: parseFloat(row.disappearance_rate) || 0,
            duplicateRate: parseFloat(row.duplicate_rate) || 0,
            stillnessRate: parseFloat(row.stillness_rate) || 0,
            discardRate: parseFloat(row.discard_rate) || 0,
            disappearanceProportion: parseFloat(row.disappearance_proportion) || 0,
            duplicateProportion: parseFloat(row.duplicate_proportion) || 0,
            stillnessProportion: parseFloat(row.stillness_proportion) || 0
        })));
}

function prepareDiscardData(data) {
    const conditioningMap = {
        'single_frame_conditioning': 'single',
        'multi_frame_conditioning': 'multi',
        'keyframe_interpolation': 'keyframe'
    };

    const conditioningLabels = {
        single: 'single frame',
        multi: 'multiple frames',
        keyframe: 'first&last frame'
    };

    return data
        .filter(d => conditioningMap[d.conditioning])
        .map(d => ({
            model: d.model,
            conditioning: conditioningMap[d.conditioning],
            conditioningLabel: conditioningLabels[conditioningMap[d.conditioning]],
            label: `${d.model} (${conditioningMap[d.conditioning]})`,
            discardRate: d.discardRate,
            disappearanceContribution: d.discardRate * d.disappearanceProportion,
            duplicateContribution: d.discardRate * d.duplicateProportion,
            stillnessContribution: d.discardRate * d.stillnessProportion,
            disappearanceRate: d.disappearanceRate,
            duplicateRate: d.duplicateRate,
            stillnessRate: d.stillnessRate,
            proportions: {
                disappearance: d.disappearanceProportion,
                duplicate: d.duplicateProportion,
                stillness: d.stillnessProportion
            }
        }));
}

function renderDiscardChart(data) {
    const loadingText = document.getElementById('discard-chart-loading');
    const chartData = prepareDiscardData(data);

    if (!chartData.length) {
        if (loadingText) {
            loadingText.style.display = 'block';
            loadingText.textContent = 'No data available.';
        }
        return;
    }

    const singleData = chartData.filter(d => d.conditioning === 'single')
        .sort((a, b) => (a.discardRate - b.discardRate) || (a.stillnessContribution - b.stillnessContribution));
    const multiData = chartData.filter(d => d.conditioning !== 'single')
        .sort((a, b) => (a.discardRate - b.discardRate) || (a.stillnessContribution - b.stillnessContribution));

    const stacked = [...singleData, ...multiData];

    const labels = stacked.map(d => `${d.model}<br>(${d.conditioning})`);
    const disappearanceValues = stacked.map(d => d.disappearanceContribution);
    const duplicateValues = stacked.map(d => d.duplicateContribution);
    const stillnessValues = stacked.map(d => d.stillnessContribution);
    const totals = stacked.map(d => d.discardRate);

    const baseColors = stacked.map(d => MODEL_COLORS[d.model] || '#999999');

    const disappearanceColors = baseColors.map(color => adjustColorBrightness(color, -0.2));
    const duplicateColors = baseColors.map(color => adjustColorBrightness(color, 0.05));
    const stillnessColors = baseColors.map(color => adjustColorBrightness(color, 0.18));

    const clamp01 = value => Math.max(0, Math.min(1, value));

    const disappearanceTrace = {
        x: labels,
        y: disappearanceValues,
        name: 'Disappearance',
        type: 'bar',
        marker: {
            color: disappearanceColors,
            line: { color: baseColors, width: 1 },
            pattern: {
                shape: '/',
                fgcolor: baseColors,
                bgcolor: disappearanceColors,
                size: 6,
                spacing: 4,
                solidity: stacked.map(d => clamp01(d.proportions.disappearance)),
                fillmode: 'overlay'
            }
        },
        legendgroup: 'discard-types',
        legendgrouptitle: { text: 'Discard Reasons' },
        legendrank: 1,
        customdata: stacked.map(d => [
            d.model,
            d.conditioningLabel,
            d.disappearanceRate,
            d.proportions.disappearance,
            d.discardRate
        ]),
        hovertemplate: 'Model: %{customdata[0]}<br>' +
            'Conditioning: %{customdata[1]}<br>' +
            'Disappearance rate: %{customdata[2]:.2f}<br>' +
            'Contribution to discard: %{y:.2f}<br>' +
            'Proportion: %{customdata[3]:.1%}<br>' +
            'Discard rate: %{customdata[4]:.2f}<extra></extra>'
    };

    const duplicateTrace = {
        x: labels,
        y: duplicateValues,
        name: 'Duplication',
        type: 'bar',
        marker: {
            color: duplicateColors,
            line: { color: baseColors, width: 1 },
            pattern: {
                shape: '\\',
                fgcolor: baseColors,
                bgcolor: duplicateColors,
                size: 6,
                spacing: 4,
                solidity: stacked.map(d => clamp01(d.proportions.duplicate)),
                fillmode: 'overlay'
            }
        },
        legendgroup: 'discard-types',
        legendrank: 2,
        customdata: stacked.map(d => [
            d.model,
            d.conditioningLabel,
            d.duplicateRate,
            d.proportions.duplicate,
            d.discardRate
        ]),
        hovertemplate: 'Model: %{customdata[0]}<br>' +
            'Conditioning: %{customdata[1]}<br>' +
            'Duplication rate: %{customdata[2]:.2f}<br>' +
            'Contribution to discard: %{y:.2f}<br>' +
            'Proportion: %{customdata[3]:.1%}<br>' +
            'Discard rate: %{customdata[4]:.2f}<extra></extra>'
    };

    const stillnessTrace = {
        x: labels,
        y: stillnessValues,
        name: 'Stillness',
        type: 'bar',
        marker: {
            color: stillnessColors,
            line: { color: baseColors, width: 1 },
            pattern: {
                shape: 'x',
                fgcolor: baseColors,
                bgcolor: stillnessColors,
                size: 6,
                spacing: 4,
                solidity: stacked.map(d => clamp01(d.proportions.stillness)),
                fillmode: 'overlay'
            }
        },
        legendgroup: 'discard-types',
        legendrank: 3,
        customdata: stacked.map(d => [
            d.model,
            d.conditioningLabel,
            d.stillnessRate,
            d.proportions.stillness,
            d.discardRate
        ]),
        hovertemplate: 'Model: %{customdata[0]}<br>' +
            'Conditioning: %{customdata[1]}<br>' +
            'Stillness rate: %{customdata[2]:.2f}<br>' +
            'Contribution to discard: %{y:.2f}<br>' +
            'Proportion: %{customdata[3]:.1%}<br>' +
            'Discard rate: %{customdata[4]:.2f}<extra></extra>'
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
            title: 'Discard Rate (lower is better)',
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

    const traces = [disappearanceTrace, duplicateTrace, stillnessTrace];

    Plotly.newPlot('discard-chart', traces, layout, config)
        .then(() => {
            if (loadingText) {
                loadingText.style.display = 'none';
            }

            const maxTotal = Math.max(...totals);
            const offset = Math.max(maxTotal * 0.02, 0.02);
            const totalAnnotations = totals.map((value, idx) => ({
                x: labels[idx],
                y: disappearanceValues[idx] + duplicateValues[idx] + stillnessValues[idx] + offset,
                text: value.toFixed(2),
                showarrow: false,
                font: { size: 12, color: '#333', family: 'sans-serif', weight: 'bold' }
            }));

            Plotly.relayout('discard-chart', {
                annotations: totalAnnotations,
                shapes: layout.shapes
            });
        })
        .catch(err => {
            console.error('Error rendering discard chart:', err);
            if (loadingText) {
                loadingText.style.display = 'block';
                loadingText.textContent = `Failed to render chart: ${err && err.message ? err.message : err}`;
            }
        });
}

function initDiscardChart() {
    loadDiscardData()
        .then(data => {
            renderDiscardChart(data);
        })
        .catch(err => {
            console.error('Failed to load discard data:', err);
        });
}

function populateConditioningOptions(model, conditioningSelect) {
    const allowedConditionings = MODEL_CONDITIONINGS[model] || [];
    Array.from(conditioningSelect.options).forEach(option => {
        if (option.value === 'keyframe_interpolation' && model === 'real-world') {
            option.disabled = true;
        } else {
            option.disabled = !allowedConditionings.includes(option.value);
        }
    });

    if (conditioningSelect.disabled || !allowedConditionings.includes(conditioningSelect.value)) {
        conditioningSelect.value = allowedConditionings[0] || 'single_frame_conditioning';
    }
}

function populatePromptOptions(model, promptSelect) {
    const allowedPrompts = MODEL_PROMPTS[model] || [];
    Array.from(promptSelect.options).forEach(option => {
        option.disabled = allowedPrompts.length > 0 && !allowedPrompts.includes(option.value);
    });

    if (!allowedPrompts.includes(promptSelect.value)) {
        promptSelect.value = allowedPrompts[0] || 'plain';
    }
}

function isExperimentAvailable(model, conditioning, prompt, experimentId) {
    if (!UNAVAILABLE_EXPERIMENTS[model]) {
        return true;
    }
    const conditioningMap = UNAVAILABLE_EXPERIMENTS[model][conditioning];
    if (!conditioningMap) {
        return true;
    }
    const unavailable = conditioningMap[prompt];
    return !(unavailable && unavailable.includes(experimentId));
}

function getVideoPath({ model, conditioning, promptType, experimentId }) {
    const cacheKey = `${model}|${conditioning}|${promptType}|${experimentId}`;
    if (videoPathCache.has(cacheKey)) {
        const cached = videoPathCache.get(cacheKey);
        if (cached !== null) {
            return Promise.resolve(cached);
        }
        videoPathCache.delete(cacheKey);
    }

    if (model === 'real-world') {
         if (!REAL_WORLD_EXPERIMENTS.has(experimentId)) {
             return Promise.resolve(null);
         }
 
        const realPath = `${REAL_WORLD_VIDEO_ROOT}/${experimentId}.webm`;
        videoPathCache.set(cacheKey, realPath);
        return Promise.resolve(realPath);
    }

    if (!isExperimentAvailable(model, conditioning, promptType, experimentId)) {
         return Promise.resolve(null);
     }
 
     const experimentFolder = experimentId.replace(/-/g, '_');
     const directPath = `${GENERATED_VIDEO_ROOT}/${conditioning}/${model}/${promptType}/${experimentFolder}/output_video.webm`;
     const fallbackPath = `${GENERATED_VIDEO_ROOT}/${conditioning}/${model}/${promptType}/${experimentFolder}/video_0/output_video.webm`;

     return fetch(directPath, { method: 'HEAD' })
         .then(response => {
             if (response.ok) {
                 videoPathCache.set(cacheKey, directPath);
                 return directPath;
             }
             return fetch(fallbackPath, { method: 'HEAD' })
                 .then(res => {
                     if (res.ok) {
                         videoPathCache.set(cacheKey, fallbackPath);
                         return fallbackPath;
                     }
                     return null;
                 })
                 .catch(() => null);
         })
         .catch(() => null);
 }

function setVideoSource(player, source, path) {
    if (!path) {
        source.removeAttribute('src');
        player.load();
        return Promise.resolve();
    }

    source.src = path;
    player.load();
    return player.play().catch(() => undefined);
}

function markVideoAvailability(player, path) {
    const wrapper = player.closest('.video-wrapper');
    if (!wrapper) return;
    wrapper.classList.toggle('is-missing', !path);
}

function updateVideoSources() {
    const modelSelect = document.getElementById('model-select');
    const conditioningSelect = document.getElementById('conditioning-select');
    const promptSelect = document.getElementById('prompt-select');

    const model = modelSelect.value;
    const isRealWorld = model === 'real-world';

    if (isRealWorld) {
        conditioningSelect.disabled = true;
        promptSelect.disabled = true;
    } else {
        conditioningSelect.disabled = false;
        promptSelect.disabled = false;
        populateConditioningOptions(model, conditioningSelect);
        populatePromptOptions(model, promptSelect);
    }

    const promptType = promptSelect.value;
    const conditioning = conditioningSelect.value;

    const videoUpdatePromises = VIDEO_EXPERIMENT_IDS.map(async id => {
        const player = document.getElementById(id);
        if (!player) {
            return;
        }
        const source = player.querySelector('source');
        if (!source) {
            return;
        }

        const experimentId = id.replace(/-/g, '_');
        const path = await getVideoPath({ model, conditioning, promptType, experimentId });

        player.classList.toggle('is-unavailable', !path);

        markVideoAvailability(player, path);

        if (!path) {
            source.removeAttribute('src');
            player.load();
            return;
        }

        return setVideoSource(player, source, path);
    });

    return Promise.all(videoUpdatePromises);
}

document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    initScoresChart();
    initDiscardChart();

    const modelSelect = document.getElementById('model-select');
    const conditioningSelect = document.getElementById('conditioning-select');
    const promptSelect = document.getElementById('prompt-select');

    updateVideoSources();

    modelSelect.addEventListener('change', updateVideoSources);
    conditioningSelect.addEventListener('change', updateVideoSources);
    promptSelect.addEventListener('change', updateVideoSources);
});

window.onerror = function(msg, url, line) {
    console.error('JavaScript error:', msg);
    console.error('File:', url);
    console.error('Line:', line);
};
