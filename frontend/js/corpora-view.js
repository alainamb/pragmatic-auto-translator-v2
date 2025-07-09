// corpora-view.js - Dynamic loading and display of corpus sources

document.addEventListener('DOMContentLoaded', function() {
    loadCorpusSources();
});

async function loadCorpusSources() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const englishSection = document.getElementById('englishCorpus');
    const spanishSection = document.getElementById('spanishCorpus');
    const chineseSection = document.getElementById('chineseCorpus');

    try {
        console.log('Attempting to load corpus data...');
        
        // Load both corpus databases - using absolute paths for GitHub Pages
        const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? '../corpora/gai/' 
            : '/pragmatic-auto-translator-v2/corpora/gai/';
            
        const [englishData, spanishData, chineseData] = await Promise.all([
            fetchCorpusData(baseUrl + 'eng/gai-eng_corpus-database.json'),
            fetchCorpusData(baseUrl + 'esp/gai-esp_corpus-database.json'),
            fetchCorpusData(baseUrl + 'zho/gai-zho_corpus-database.json')
        ]);
        
        console.log('English data loaded:', englishData);
        console.log('Spanish data loaded:', spanishData);
        console.log('Chinese data loaded:', chineseData);

        // Hide loading indicator
        loadingIndicator.classList.add('hidden');

        // Display English sources
        if (englishData && Object.keys(englishData.documents).length > 0) {
            displayCorpusItems('englishCards', englishData.documents, 'English');
            englishSection.classList.remove('hidden');
        }

        // Display Spanish sources
        if (spanishData && Object.keys(spanishData.documents).length > 0) {
            displayCorpusItems('spanishCards', spanishData.documents, 'Spanish');
            spanishSection.classList.remove('hidden');
        }

        // Display Chinese sources
        if (chineseData && Object.keys(chineseData.documents).length > 0) {
            displayCorpusItems('chineseCards', chineseData.documents, 'Simplified Chinese');
            chineseSection.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error loading corpus data:', error);
        loadingIndicator.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

async function fetchCorpusData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}

function displayCorpusItems(containerId, documents, language) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    // Clear any existing content
    container.innerHTML = '';

    // Convert documents object to array and sort by publication year (newest first)
    const documentsArray = Object.values(documents).sort((a, b) => {
        const yearA = parseInt(a.document_metadata.publication_year) || 0;
        const yearB = parseInt(b.document_metadata.publication_year) || 0;
        return yearB - yearA;
    });

    documentsArray.forEach(doc => {
        const card = createCorpusCard(doc.document_metadata, language);
        container.appendChild(card);
    });
}

function createCorpusCard(metadata, language) {
    const card = document.createElement('div');
    card.className = 'corpus-card';

    // Format authors
    const authorsText = formatAuthors(metadata.authors);
    
    // Format topics
    const topicsText = metadata.topics ? metadata.topics.join(', ') : '';
    
    // Create language variant display
    const languageVariant = formatLanguageVariant(metadata.language_variant, language);

    card.innerHTML = `
        <div class="corpus-card-header">
            <h3 class="corpus-title">${escapeHtml(metadata.title)}</h3>
            <span class="corpus-language">${languageVariant}</span>
        </div>
        
        <div class="corpus-authors">
            <strong>Authors:</strong> ${authorsText}
        </div>
        
        <div class="corpus-publication">
            <strong>Published:</strong> ${escapeHtml(metadata.publisher)}, ${metadata.publication_year}
        </div>
        
        <div class="corpus-type">
            <strong>Type:</strong> ${escapeHtml(metadata.text_type)}
        </div>
        
        ${topicsText ? `<div class="corpus-topics">
            <strong>Topics:</strong> ${escapeHtml(topicsText)}
        </div>` : ''}
    `;

    return card;
}

function formatAuthors(authors) {
    if (!authors || authors.length === 0) {
        return 'Unknown';
    }

    const authorNames = authors.map(author => {
        if (typeof author === 'string') {
            return author;
        } else if (author.name) {
            return author.name;
        } else {
            return 'Unknown';
        }
    });

    if (authorNames.length === 1) {
        return escapeHtml(authorNames[0]);
    } else if (authorNames.length === 2) {
        return `${escapeHtml(authorNames[0])} and ${escapeHtml(authorNames[1])}`;
    } else {
        const lastAuthor = authorNames.pop();
        return `${authorNames.map(escapeHtml).join(', ')}, and ${escapeHtml(lastAuthor)}`;
    }
}

function formatLanguageVariant(variant, language) {
    const variantMap = {
        'usa': 'US English',
        'eur': 'European English',
        'mex': 'Mexican Spanish',
        'esp': 'European Spanish',
        'syr': 'Syrian English',
        'chn': 'Simplified Chinese'
    };

    return variantMap[variant] || `${language} (${variant})`;
}

function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}