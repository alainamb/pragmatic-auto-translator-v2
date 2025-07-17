// visualizations.js - Dynamic display of vector visualizations with automatic JSON loading

// Highlight active navigation item
document.addEventListener('DOMContentLoaded', function() {
    const visualizationsLink = document.querySelector('a[href="visualizations.html"]');
    if (visualizationsLink) {
        visualizationsLink.style.color = 'var(--gray-900)';
    }
    
    // Load the visualization data
    loadVisualizationData();
});

// Configuration for data loading
const VISUALIZATION_CONFIG = {
    // Load the specific file
    dataFile: 'data/gai_vector-visualization_data_20250711_153240.json'
};

// Function to load the visualization JSON file
async function loadVisualizationData() {
    try {
        console.log(`🔍 Loading visualization data from: ${VISUALIZATION_CONFIG.dataFile}`);
        
        const response = await fetch(VISUALIZATION_CONFIG.dataFile);
        
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Visualization data loaded successfully');
        console.log('📊 Data summary:', {
            generated: data.metadata.generated_readable,
            totalVectors: data.corpus_statistics.total_vectors,
            totalDocuments: data.corpus_statistics.total_documents,
            coverage: data.corpus_statistics.coverage_percent + '%'
        });
        
        // Update all visualizations with the loaded data
        updateVisualizationsFromData(data);
        
    } catch (error) {
        console.error('❌ Error loading visualization data:', error);
        showDataLoadError(error.message);
    }
}

// Main function to update all visualizations from loaded JSON data
function updateVisualizationsFromData(data) {
    console.log('📊 Updating visualizations with data:', {
        generated: data.metadata.generated_readable,
        totalVectors: data.corpus_statistics.total_vectors,
        chartsAvailable: Object.keys(data.charts)
    });
    
    // Update metadata and model info
    updateModelInfo(
        data.metadata.model,
        data.metadata.dimensions,
        data.metadata.task
    );
    
    // Update corpus statistics
    updateCorpusStatistics(data.corpus_statistics);
    
    // Update timestamp
    updateTimestamp(data.metadata.generated_readable);
    
    // Create all charts with proper error handling
    try {
        if (data.charts.pca_2d) {
            create2DVisualization(data.charts.pca_2d);
        } else {
            console.warn('❌ No 2D chart data available');
        }
        
        if (data.charts.pca_3d) {
            create3DVisualization(data.charts.pca_3d);
        } else {
            console.warn('❌ No 3D chart data available');
        }
        
        if (data.charts.language_distribution) {
            createLanguageDistribution(data.charts.language_distribution);
        } else {
            console.warn('❌ No language distribution data available');
        }
        
        console.log('✅ All visualizations updated successfully');
        
    } catch (error) {
        console.error('❌ Error creating visualizations:', error);
    }
}

// Function to update model information
function updateModelInfo(modelName, dimensions, task) {
    document.getElementById('model-name').textContent = modelName;
    document.getElementById('vector-dimension').textContent = dimensions;
    document.getElementById('task-optimization').textContent = task;
}

// Function to update corpus statistics within card layout
function updateCorpusStatistics(stats) {
    // Total Documents (full width)
    document.getElementById('stat-documents').textContent = stats.total_documents.toLocaleString();
    
    // Language breakdown (3 cards in a row)
    document.getElementById('stat-eng-docs').textContent = stats.languages.eng || 0;
    document.getElementById('stat-esp-docs').textContent = stats.languages.esp || 0;
    document.getElementById('stat-chn-docs').textContent = stats.languages.zho || 0;
    
    // Total Vectors (full width)
    document.getElementById('stat-total-vectors').textContent = stats.total_vectors.toLocaleString();
    
    // Vector type breakdown (3 cards in a row)
    document.getElementById('stat-document-vectors').textContent = stats.document_vectors.toLocaleString();
    document.getElementById('stat-section-vectors').textContent = stats.section_vectors.toLocaleString();
    document.getElementById('stat-paragraph-vectors').textContent = stats.paragraph_vectors.toLocaleString();
    
    // Coverage (full width)
    document.getElementById('stat-coverage').textContent = stats.coverage_percent + '%';
}

// Helper function to define legend order
function getLegendOrder() {
    return [
        'ENG Document',
        'ESP Document', 
        'ZHO Document',
        'ENG Section (L0)',
        'ENG Section (L1+)',
        'ESP Section (L0)',
        'ESP Section (L1+)',
        'ZHO Section (L0)',
        'ZHO Section (L1+)',
        'ENG Paragraph',
        'ESP Paragraph',
        'ZHO Paragraph'
    ];
}

// Helper function to format text for popups with language-specific limits
function formatTextForPopup(text) {
    if (!text) return text;
    
    // Language-specific character limits
    if (/[\u4e00-\u9fff]/.test(text)) {
        // Chinese: 40 characters max (denser language)
        const chineseMaxLength = 40;
        let truncated = text.length > chineseMaxLength ? 
            text.substring(0, chineseMaxLength) + '...' : text;
        
        // Smart line breaks that respect English words embedded in Chinese
        return addSmartLineBreaks(truncated);
    } else {
        // English/Spanish: 80 characters max
        const westernMaxLength = 80;
        if (text.length > westernMaxLength) {
            return text.substring(0, westernMaxLength) + '...';
        }
    }
    
    return text;
}

// Helper function to add line breaks intelligently for Chinese text with embedded English
function addSmartLineBreaks(text) {
    let result = '';
    let position = 0;
    const lineLength = 15;
    
    for (let i = 0; i < text.length; i++) {
        result += text[i];
        position++;
        
        // Check if we need a line break
        if (position >= lineLength && i < text.length - 1) {
            // Look ahead to see if we're in the middle of an English word
            let isInEnglishWord = /[a-zA-Z]/.test(text[i]) && /[a-zA-Z]/.test(text[i + 1]);
            
            if (!isInEnglishWord) {
                // Safe to break here
                result += '<br>';
                position = 0;
            }
            // If we're in an English word, wait for a better break point
        }
    }
    
    return result;
}

// Function to create 2D visualization
function create2DVisualization(chartData) {
    const data = chartData.data;
    const variance = chartData.variance_explained;
    
    console.log('📊 Creating 2D visualization...');
    
    // Clear the container first
    const container = document.getElementById('plot-2d-container');
    container.innerHTML = '';
    container.className = 'plot-container';
    
    // Group data by language and type for better legend
    const traces = {};
    
    data.forEach(point => {
        const key = `${point.language} ${point.type}`;
        if (!traces[key]) {
            traces[key] = {
                x: [],
                y: [],
                mode: 'markers',
                type: 'scatter',
                name: key,
                marker: { color: point.color, size: 10, line: { width: 1, color: 'white' }, opacity: 0.7 },
                text: [],
                customdata: [],
                hovertemplate: '%{customdata}<extra></extra>'
            };
        }
        
        traces[key].x.push(point.x);
        traces[key].y.push(point.y);
        traces[key].text.push(point.label);
        
        // Format popup with consistent and readable structure
        let popup = '';
        if (point.popup.type === 'DOCUMENT') {
            const formattedTitle = formatTextForPopup(point.popup.document_title);
            popup = `<b>DOCUMENT</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${formattedTitle}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}`;
        } else if (point.popup.type === 'SECTION') {
            const formattedTitle = formatTextForPopup(point.popup.document_title);
            const formattedSectionTitle = formatTextForPopup(point.popup.section_title);
            const formattedExcerpt = formatTextForPopup(point.popup.excerpt);
            popup = `<b>SECTION</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${formattedTitle}<br>Section ID: ${point.popup.section_id}<br>Section title: ${formattedSectionTitle}<br>Excerpt: ${formattedExcerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}`;
        } else if (point.popup.type === 'PARAGRAPH') {
            const formattedTitle = formatTextForPopup(point.popup.document_title);
            const formattedSectionTitle = formatTextForPopup(point.popup.section_title);
            const formattedExcerpt = formatTextForPopup(point.popup.excerpt);
            popup = `<b>PARAGRAPH</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${formattedTitle}<br>Paragraph ID: ${point.popup.paragraph_id}<br>Section title: ${formattedSectionTitle}<br>Excerpt: ${formattedExcerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}`;
        }
        
        traces[key].customdata.push(popup);
    });
    
    // Sort traces according to desired legend order
    const legendOrder = getLegendOrder();
    const sortedTraces = [];
    legendOrder.forEach(key => {
        if (traces[key]) {
            sortedTraces.push(traces[key]);
        }
    });
    
    const layout = {
        title: chartData.title,
        xaxis: { title: `X-axis (${(variance[0]*100).toFixed(1)}% variance)` },
        yaxis: { title: `Y-axis (${(variance[1]*100).toFixed(1)}% variance)` },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'white',
            bordercolor: 'gray',
            font: { size: 12, family: 'Arial, sans-serif' },
            align: 'left',
            namelength: -1,
            // Constrain hover box size and handle line breaks
            borderwidth: 1,
            maxwidth: 300
        }
    };
    
    const config = { 
        displayModeBar: true, 
        responsive: true,
        modeBarButtonsToRemove: ['autoScale2d']
    };
    
    Plotly.newPlot('plot-2d-container', sortedTraces, layout, config);
    console.log('✅ 2D visualization created');
}

// Function to create 3D visualization
function create3DVisualization(chartData) {
    const data = chartData.data;
    const variance = chartData.variance_explained;
    
    console.log('📊 Creating 3D visualization...');
    
    // Clear the container first
    const container = document.getElementById('plot-3d-container');
    container.innerHTML = '';
    container.className = 'plot-container';
    
    // Group data by language and type
    const traces = {};
    
    data.forEach(point => {
        const key = `${point.language} ${point.type}`;
        if (!traces[key]) {
            traces[key] = {
                x: [],
                y: [],
                z: [],
                mode: 'markers',
                type: 'scatter3d',
                name: key,
                marker: { color: point.color, size: 8, line: { width: 1, color: 'white' }, opacity: 0.7 },
                text: [],
                customdata: [],
                hovertemplate: '%{customdata}<extra></extra>'
            };
        }
        
        traces[key].x.push(point.x);
        traces[key].y.push(point.y);
        traces[key].z.push(point.z);
        traces[key].text.push(point.label);
        
        // Format popup with consistent and readable structure and Z-axis
        let popup = '';
        if (point.popup.type === 'DOCUMENT') {
            const formattedTitle = formatTextForPopup(point.popup.document_title);
            popup = `<b>DOCUMENT</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${formattedTitle}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}<br>Z: ${point.z.toFixed(3)}`;
        } else if (point.popup.type === 'SECTION') {
            const formattedTitle = formatTextForPopup(point.popup.document_title);
            const formattedSectionTitle = formatTextForPopup(point.popup.section_title);
            const formattedExcerpt = formatTextForPopup(point.popup.excerpt);
            popup = `<b>SECTION</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${formattedTitle}<br>Section ID: ${point.popup.section_id}<br>Section title: ${formattedSectionTitle}<br>Excerpt: ${formattedExcerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}<br>Z: ${point.z.toFixed(3)}`;
        } else if (point.popup.type === 'PARAGRAPH') {
            const formattedTitle = formatTextForPopup(point.popup.document_title);
            const formattedSectionTitle = formatTextForPopup(point.popup.section_title);
            const formattedExcerpt = formatTextForPopup(point.popup.excerpt);
            popup = `<b>PARAGRAPH</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${formattedTitle}<br>Paragraph ID: ${point.popup.paragraph_id}<br>Section title: ${formattedSectionTitle}<br>Excerpt: ${formattedExcerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}<br>Z: ${point.z.toFixed(3)}`;
        }
        
        traces[key].customdata.push(popup);
    });
    
    // Sort traces according to desired legend order
    const legendOrder = getLegendOrder();
    const sortedTraces = [];
    legendOrder.forEach(key => {
        if (traces[key]) {
            sortedTraces.push(traces[key]);
        }
    });
    
    const layout = {
        title: chartData.title,
        scene: {
            xaxis: { title: `X-axis (${(variance[0]*100).toFixed(1)}%)` },
            yaxis: { title: `Y-axis (${(variance[1]*100).toFixed(1)}%)` },
            zaxis: { title: `Z-axis (${(variance[2]*100).toFixed(1)}%)` }
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'white',
            bordercolor: 'gray',
            font: { size: 12, family: 'Arial, sans-serif' },
            align: 'left',
            namelength: -1,
            borderwidth: 1,
            maxwidth: 300
        }
    };
    
    const config = { 
        displayModeBar: true, 
        responsive: true 
    };
    
    Plotly.newPlot('plot-3d-container', sortedTraces, layout, config);
    console.log('✅ 3D visualization created');
}

// Function to create language distribution chart
function createLanguageDistribution(chartData) {
    const distData = chartData.data;
    
    console.log('📊 Creating language distribution chart...');
    
    // Clear the container first
    const container = document.getElementById('plot-dist-container');
    container.innerHTML = '';
    container.className = 'plot-container-distribution';
    
    const trace = {
        x: distData.map(d => d.language),
        y: distData.map(d => d.count),
        type: 'bar',
        marker: { 
            color: distData.map(d => d.color),
            line: { color: 'white', width: 1 }
        },
        // Show only the vector count since language is already on x-axis
        hovertemplate: 'Vectors: %{y:,}<extra></extra>'
    };
    
    const layout = {
        title: {
            text: chartData.title,
            font: { size: 16 },
            pad: { t: 20, b: 20 }
        },
        xaxis: { 
            title: 'Language',
            titlefont: { size: 14 },
            tickfont: { size: 12 },
            showspikes: false
        },
        yaxis: { 
            title: 'Number of Vectors',
            titlefont: { size: 14 },
            tickfont: { size: 12 },
            showspikes: false
        },
        margin: { l: 80, r: 40, t: 60, b: 60 },
        height: 280,
        showlegend: false,
        // Hover only on data points (bars), not axes
        hovermode: 'closest',
        // Disable axis hover labels
        spikedistance: -1,
        dragmode: 'pan',
        hoverlabel: {
            bgcolor: 'white',
            bordercolor: 'gray',
            font: { size: 12, family: 'Arial, sans-serif' },
            align: 'left',
            borderwidth: 1,
            namelength: 0
        }
    };
    
    const config = { 
        displayModeBar: true, 
        responsive: true,
        modeBarButtonsToRemove: ['autoScale2d', 'lasso2d', 'select2d']
    };
    
    Plotly.newPlot('plot-dist-container', [trace], layout, config);
    console.log('✅ Language distribution chart created');
}

// Function to update timestamp
function updateTimestamp(timestamp) {
    document.getElementById('report-timestamp').textContent = `Visualization data last updated: ${timestamp}`;
}

// Error handling functions
function showDataNotAvailable() {
    const containers = ['plot-2d-container', 'plot-3d-container', 'plot-dist-container'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.className = id === 'plot-dist-container' ? 'plot-container-small' : 'plot-container';
            container.innerHTML = `
                <div class="plot-loading" style="border: 2px dashed var(--gray-300); border-radius: 0.5rem; height: 100%;">
                    <h3 style="color: var(--gray-400);">No visualization data found</h3>
                    <p>Expected file: <code>${VISUALIZATION_CONFIG.dataFile}</code></p>
                    <p style="font-size: 0.875rem;">Make sure the JSON file is in the correct location</p>
                </div>
            `;
        }
    });
}

function showDataLoadError(errorMessage = 'Unknown error') {
    const containers = ['plot-2d-container', 'plot-3d-container', 'plot-dist-container'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            const containerClass = id === 'plot-dist-container' ? 'plot-container-small' : 'plot-container';
            container.className = containerClass;
            container.innerHTML = `
                <div class="plot-loading" style="border: 2px dashed var(--gray-300); border-radius: 0.5rem; height: 100%;">
                    <h3 style="color: var(--red-400);">Error Loading Data</h3>
                    <p>File: <code>${VISUALIZATION_CONFIG.dataFile}</code></p>
                    <p style="font-size: 0.875rem; color: var(--gray-600);">${errorMessage}</p>
                    <p style="font-size: 0.875rem;">Check console for details</p>
                </div>
            `;
        }
    });
}

// Manual refresh function (can be called from console or button)
function refreshVisualizations() {
    console.log('🔄 Manually refreshing visualizations...');
    loadVisualizationData();
}

// Update the data file path (useful if you generate new data)
function updateDataFile(newFilename) {
    VISUALIZATION_CONFIG.dataFile = `data/${newFilename}`;
    console.log(`📝 Updated data file to: ${VISUALIZATION_CONFIG.dataFile}`);
    console.log('🔄 Reloading with new file...');
    loadVisualizationData();
}

// Make functions available globally
window.refreshVisualizations = refreshVisualizations;
window.updateDataFile = updateDataFile;