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
    dataFile: 'data/gai_visualization_data_20250706_155702.json'
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
    document.getElementById('stat-chn-docs').textContent = stats.languages['zho-chn'] || 0;
    
    // Total Vectors (full width)
    document.getElementById('stat-total-vectors').textContent = stats.total_vectors.toLocaleString();
    
    // Vector type breakdown (3 cards in a row)
    document.getElementById('stat-document-vectors').textContent = stats.document_vectors.toLocaleString();
    document.getElementById('stat-section-vectors').textContent = stats.section_vectors.toLocaleString();
    document.getElementById('stat-paragraph-vectors').textContent = stats.paragraph_vectors.toLocaleString();
    
    // Coverage (full width)
    document.getElementById('stat-coverage').textContent = stats.coverage_percent + '%';
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
            popup = `<b>DOCUMENT</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${point.popup.document_title}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}`;
        } else if (point.popup.type === 'SECTION') {
            popup = `<b>SECTION</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${point.popup.document_title}<br>Section ID: ${point.popup.section_id}<br>Section title: ${point.popup.section_title}<br>Excerpt: ${point.popup.excerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}`;
        } else if (point.popup.type === 'PARAGRAPH') {
            popup = `<b>PARAGRAPH</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${point.popup.document_title}<br>Paragraph ID: ${point.popup.paragraph_id}<br>Section title: ${point.popup.section_title}<br>Excerpt: ${point.popup.excerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}`;
        }
        
        traces[key].customdata.push(popup);
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
            align: 'left'
        }
    };
    
    const config = { 
        displayModeBar: true, 
        responsive: true,
        modeBarButtonsToRemove: ['autoScale2d']
    };
    
    Plotly.newPlot('plot-2d-container', Object.values(traces), layout, config);
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
            popup = `<b>DOCUMENT</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${point.popup.document_title}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}<br>Z: ${point.z.toFixed(3)}`;
        } else if (point.popup.type === 'SECTION') {
            popup = `<b>SECTION</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${point.popup.document_title}<br>Section ID: ${point.popup.section_id}<br>Section title: ${point.popup.section_title}<br>Excerpt: ${point.popup.excerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}<br>Z: ${point.z.toFixed(3)}`;
        } else if (point.popup.type === 'PARAGRAPH') {
            popup = `<b>PARAGRAPH</b><br>Corpus item: ${point.popup.corpus_item}<br>Title: ${point.popup.document_title}<br>Paragraph ID: ${point.popup.paragraph_id}<br>Section title: ${point.popup.section_title}<br>Excerpt: ${point.popup.excerpt}<br><br><b>Coordinates:</b><br>X: ${point.x.toFixed(3)}<br>Y: ${point.y.toFixed(3)}<br>Z: ${point.z.toFixed(3)}`;
        }
        
        traces[key].customdata.push(popup);
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
            align: 'left'
        }
    };
    
    const config = { 
        displayModeBar: true, 
        responsive: true 
    };
    
    Plotly.newPlot('plot-3d-container', Object.values(traces), layout, config);
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
        hovertemplate: '<b>%{x}</b><br>Vectors: %{y}<extra></extra>'
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
            tickfont: { size: 12 }
        },
        yaxis: { 
            title: 'Number of Vectors',
            titlefont: { size: 14 },
            tickfont: { size: 12 }
        },
        margin: { l: 80, r: 40, t: 60, b: 60 },
        height: 280,
        showlegend: false
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