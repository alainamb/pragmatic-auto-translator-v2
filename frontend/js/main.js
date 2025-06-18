// =====================================
// PRAGMATIC AUTO-TRANSLATOR MAIN
// =====================================

import config from './config.js';
import { debugLog, truncateText } from './utils.js';
import { initializeCorpusLegacyFormat, getDocumentTitle } from './corpora-retrieval.js';
import { 
  loadEmbeddingModel, 
  createUserInputEmbedding, 
  isEmbeddingModelReady,
  getEmbeddingModelStatus,
  setJinaApiKey,
  storeApiKeyLocally, 
  getApiKeyStatus
} from './embedding-jina.js';
import { findSimilarContext } from './similarity.js';
import { 
  translateWithContext, 
  setDeepSeekApiKey, 
  storeDeepSeekApiKeyLocally, 
  isDeepSeekApiReady,
  testDeepSeekConnection 
} from './translation.js';

/**
 * Convert markdown-style formatting to HTML
 * @param {string} text - Text with markdown formatting
 * @returns {string} HTML formatted text
 */
function formatMarkdownText(text) {
    return text
        // Headers (do these first, in reverse order so ### doesn't get caught by #)
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')         // #### → <h4>
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')          // ### → <h3>
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')           // ## → <h2>
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')            // # → <h1>
        // Bold and italic (do these after headers)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold** → <strong>bold</strong>
        .replace(/\*(.*?)\*/g, '<em>$1</em>');            // *italic* → <em>italic</em>
}

// =====================================
// GLOBAL VARIABLES (matching your existing structure)
// =====================================

let vectorData = {
    documents: [],
    paragraphs: [],
    sections: []
};

let documentDatabase = {
    english: {},
    spanish: {}
};

let currentSourceLang = 'en';

// =====================================
// DOM ELEMENTS (matching your existing structure)
// =====================================

const languageOptions = document.querySelectorAll('.language-option');
const targetLanguageSpan = document.getElementById('targetLanguage');
const sourceTextArea = document.getElementById('sourceText');
const translateButton = document.getElementById('translateButton');
const statusIndicator = document.getElementById('statusIndicator');
const translationOutput = document.getElementById('translationOutput');
const contextInfo = document.getElementById('contextInfo');

// =====================================
// STATUS INDICATOR SYSTEM
// =====================================

/**
 * Show status message to user with configurable delay
 * @param {string} message - Status message
 * @param {string} type - Status type ('loading', 'success', 'error')
 * @param {number} duration - How long to show the message (ms)
 */
function showStatus(message, type = 'info', duration = null) {
    if (!statusIndicator) return;
    
    statusIndicator.textContent = message;
    statusIndicator.className = `status-indicator status-${type}`;
    statusIndicator.classList.remove('hidden');
    
    // Set default durations based on message type
    if (duration === null) {
        switch (type) {
            case 'loading':
                duration = 0; // Don't auto-hide loading messages
                break;
            case 'success':
                duration = 4000; // Show success for 4 seconds
                break;
            case 'error':
                duration = 6000; // Show errors for 6 seconds (more time to read)
                break;
            default:
                duration = 3000; // Default 3 seconds
        }
    }
    
    // Auto-hide after duration (unless it's 0)
    if (duration > 0) {
        setTimeout(() => {
            if (statusIndicator.textContent === message) { // Only hide if message hasn't changed
                statusIndicator.classList.add('hidden');
            }
        }, duration);
    }
    
    debugLog(`Status: ${message} (${type}, ${duration}ms)`, type === 'error' ? 'error' : 'info');
}

/**
 * Show a sequence of status messages with delays between them
 * @param {Array} messages - Array of {message, type, delay} objects
 */
async function showStatusSequence(messages) {
    for (let i = 0; i < messages.length; i++) {
        const { message, type = 'info', delay = 0, duration = null } = messages[i];
        
        showStatus(message, type, duration);
        
        // Wait before showing next message (except for last message)
        if (delay > 0 && i < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// =====================================
// LANGUAGE TOGGLE 
// =====================================

/**
 * Setup language toggle functionality
 */
function setupLanguageToggle() {
    if (!languageOptions.length) {
        debugLog('Language toggle elements not found', 'warn');
        return;
    }
    
    languageOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            languageOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            option.classList.add('active');
            
            // Update current source language
            currentSourceLang = option.dataset.lang;
            
            // Update target language display
            if (targetLanguageSpan) {
                targetLanguageSpan.textContent = currentSourceLang === 'en' ? 'Spanish' : 'English';
            }
            
            // Update placeholder text
            if (sourceTextArea) {
                if (currentSourceLang === 'en') {
                    sourceTextArea.placeholder = 'Enter your English text here for translation to Spanish...';
                } else {
                    sourceTextArea.placeholder = 'Ingrese su texto en español aquí para traducir al inglés...';
                }
            }
            
            debugLog(`Language direction changed: ${currentSourceLang} → ${currentSourceLang === 'en' ? 'es' : 'en'}`, 'info');
        });
    });
    
    debugLog('Language toggle setup complete', 'info');
}

// =====================================
// CORPUS LOADING (using our modular approach)
// =====================================

/**
 * Load vector data and document databases with improved status messages
 */
async function loadCorpusData() {
    console.log('Loading corpus data using modular approach...');
    showStatus('Loading corpus vector data...', 'loading');
    
    try {
        // Add delay so user can see the loading message
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Use our modular loading function
        const corpusData = await initializeCorpusLegacyFormat();
        
        // Assign to global variables (matching existing structure)
        vectorData = corpusData.vectorData;
        documentDatabase = corpusData.documentDatabase;
        
        const totalVectors = vectorData.documents.length + vectorData.paragraphs.length + vectorData.sections.length;
        
        // Clean success message with proper format
        const message = `✅ Corpus: ${vectorData.documents.length} documents, ${vectorData.sections.length} sections, ${vectorData.paragraphs.length} paragraphs loaded`;
        console.log(`${message} (Total: ${totalVectors} vectors)`); // Keep detailed count in console
        showStatus(message, 'success', 3000); // Show for 3 seconds
        
        // Log sample for debugging (console only)
        console.log('Sample vector data:', {
            documents: vectorData.documents[0],
            sections: vectorData.sections[0],
            paragraphs: vectorData.paragraphs[0]
        });
        
        return true;
        
    } catch (error) {
        console.error('Error loading corpus data:', error);
        showStatus('Failed to load corpus data', 'error', 5000);
        return false;
    }
}

// =====================================
// EMBEDDING STATUS CHECK
// =====================================

/**
 * Check embedding API status during initialization - IMPROVED
 */
async function checkEmbeddingStatus() {
    console.log('Checking embedding API status...');
    showStatus('Checking embedding API...', 'loading');
    
    try {
        // Add a small delay so user can see the loading message
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const status = await getEmbeddingModelStatus();
        
        if (status.ready) {
            // Clean message without sensitive details
            const message = `✅ Embedding API ready`;
            console.log(`${message} (${status.source}: ${status.keyPreview})`); // Keep details in console for debugging
            showStatus(message, 'success', 3000); // Show for 3 seconds
            
            // Log additional details for debugging (console only)
            console.log('Embedding API details:', {
                model: status.modelName,
                dimensions: status.dimensions,
                environment: status.environment,
                source: status.source
            });
            
            return true;
        } else {
            // Clean error message without revealing internals
            const message = `Embedding API configuration needed`;
            console.log(`Embedding API not ready: ${status.message || 'Unknown issue'}`); // Keep details in console
            showStatus(message, 'error', 5000); // Show for 5 seconds
            
            // Show helpful message based on the issue (console only)
            if (status.status === 'api_key_missing') {
                console.log('💡 To fix: Add your JINA API key to api-config.js or call PragmaticTranslator.setJinaApiKey("your-key")');
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('Error checking embedding status:', error);
        showStatus('Error checking embedding API', 'error', 5000);
        return false;
    }
}

// =====================================
// TRANSLATION SETUP
// =====================================

/**
 * Setup translate button
 */
function setupTranslateButton() {
    if (!translateButton) {
        debugLog('Translate button not found', 'warn');
        return;
    }
    
    translateButton.addEventListener('click', async () => {
        await handleTranslation();
    });
    
    debugLog('Translate button setup complete', 'info');
}

/**
 * Handle the complete translation process with improved status flow
 */
async function handleTranslation() {
    const sourceText = sourceTextArea?.value.trim();
    
    if (!sourceText) {
        showStatus('Please enter some text to translate', 'error', 3000);
        return;
    }

    if (translationOutput) {
        translationOutput.innerHTML = '<p style="color: var(--gray-500); font-style: italic;">Your translation will appear here...</p>';
    }
    if (contextInfo) {
        contextInfo.innerHTML = '<p style="color: var(--gray-500); font-style: italic;">Similar content from the corpus that will inform your translation will be shown here...</p>';
    }
    
    try {
        // Step 1: Show start message with delay
        showStatus('Starting translation process...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Step 2: Ensure embedding API is ready
        const isReady = await isEmbeddingModelReady();
        if (!isReady) {
            showStatus('Preparing embedding API...', 'loading');
            await new Promise(resolve => setTimeout(resolve, 1000));
            await loadEmbeddingModel();
            showStatus('Embedding API ready', 'success', 2000);
            await new Promise(resolve => setTimeout(resolve, 1200));
        }
        
        // Step 3: Create embedding for user input
        showStatus('Analyzing your text...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 800));
        const userEmbedding = await createUserInputEmbedding(sourceText);
        
        showStatus('Text analysis complete', 'success', 1500);
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugLog(`Created embedding for user text (${userEmbedding.dimension} dimensions)`, 'info');
        
        // Step 4: Get UI options for similarity search
        const useAdvanced = document.getElementById('advancedScoring')?.checked !== false;
        const priorityStrategy = document.getElementById('priorityStrategy')?.value || 'balanced';
        
        // Step 5: Search for similar context
        showStatus('Searching corpus for relevant context...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const contextResults = await findSimilarContext(userEmbedding.embedding, vectorData, {
            useAdvancedScoring: useAdvanced,
            priorityStrategy: priorityStrategy,
            maxContextLength: 8000
        });
        
        // Step 6: Show similarity search results
        const resultCount = contextResults.metadata.totalResults;
        const contextLength = contextResults.metadata.contextLength;
        
        if (resultCount > 0) {
            showStatus(`Found ${resultCount} relevant passages`, 'success', 2000);
            await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
            showStatus('No relevant context found - translating without corpus', 'error', 3000);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Step 7: Check translation API readiness
        showStatus('Connecting to translation service...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const translationReady = await isDeepSeekApiReady();
        
        if (!translationReady) {
            showStatus('Translation API key required', 'error', 5000);
            
            // Show API key input prompt
            const apiKey = prompt('Please enter your DeepSeek API key:');
            if (apiKey) {
                setDeepSeekApiKey(apiKey);
                storeDeepSeekApiKeyLocally(apiKey);
                showStatus('API key configured successfully', 'success', 2000);
                await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
                showStatus('Translation cancelled - API key required', 'error', 4000);
                return;
            }
        }

        // Step 8: PERFORM TRANSLATION WITH CONTEXT
        showStatus('Translating with context...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const languageDirection = getCurrentLanguageDirection();
        const translationResult = await translateWithContext(
            sourceText, 
            contextResults, 
            languageDirection,
            documentDatabase
        );
        
        // Step 9: Display translation results
        showStatus('✅ Translation completed successfully!', 'success', 4000);
        
        // Use existing updateTranslationOutput function
        updateTranslationOutput(
            translationResult.translatedText, 
            translationResult.contextUsed.details || []
        );
        
        // Log translation metadata for debugging
        if (config.DEV.DEBUG) {
            console.log('Translation metadata:', translationResult.metadata);
        }
        
    } catch (error) {
        console.error('Translation process failed:', error);
        
        // Enhanced error handling with longer display time
        if (error.message.includes('DeepSeek API')) {
            showStatus('Translation service error - check your API key', 'error', 6000);
        } else if (error.message.includes('embedding server')) {
            showStatus('Embedding server issue - check configuration', 'error', 6000);
        } else if (error.message.includes('No relevant context')) {
            showStatus('No relevant context found in corpus', 'error', 4000);
        } else {
            showStatus(`Translation failed: ${error.message}`, 'error', 6000);
        }
    }
}

/**
 * Setup info tooltips for similarity options
 */
function setupSimilarityInfoTooltips() {
    const scoringInfo = document.getElementById('scoringInfo');
    const strategyInfo = document.getElementById('strategyInfo');
    
    if (scoringInfo) {
        scoringInfo.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`Advanced Similarity Scoring:

When enabled, the system uses different strategies for each level:
• Documents: Focuses on discourse and functional similarity
• Sections: Balances topical and stylistic similarity  
• Paragraphs: Emphasizes conceptual and terminological similarity

When disabled, uses basic cosine similarity for all levels.`);
        });
    }
    
    if (strategyInfo) {
        strategyInfo.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`Context Strategy Options:

• Balanced: Mixes different types of context for well-rounded translation
• Documents First: Prioritizes document-level context for better discourse understanding
• Paragraphs First: Prioritizes paragraph-level context for better terminology

Recommendation: Use "Balanced" for most translations.`);
        });
    }
}

// =====================================
// INITIALIZATION
// =====================================

/**
 * Initialize the application with improved status flow
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Pragmatic Auto-Translator initializing...');
    
    try {
        // Setup UI components
        setupLanguageToggle();
        setupTranslateButton();
        setupSimilarityInfoTooltips();
        
        // Show initialization sequence with delays
        await showStatusSequence([
            { message: 'Initializing system...', type: 'loading', delay: 1000 },
            { message: 'Loading corpus data...', type: 'loading', delay: 0 }
        ]);
        
        // Load corpus data
        const corpusLoaded = await loadCorpusData();
        
        // Small delay before checking embedding API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check embedding API status
        const embeddingReady = await checkEmbeddingStatus();
        
        // Small delay before final status
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Final initialization status
        if (corpusLoaded && embeddingReady) {
            console.log('✅ Initialization complete - ready for translation');
            showStatus('🚀 System ready for translation', 'success', 4000);
        } else if (corpusLoaded) {
            console.log('⚠️ Initialization complete with warnings - corpus loaded but embedding API issues');
            showStatus('⚠️ Corpus loaded, embedding API needs setup', 'error', 6000);
        } else {
            console.log('❌ Initialization complete with errors - some features may not work');
            showStatus('❌ System loaded with errors', 'error', 6000);
        }
        
    } catch (error) {
        console.error('Initialization failed:', error);
        showStatus('❌ Application initialization failed', 'error', 8000);
    }
});

// =====================================
// UTILITY FUNCTIONS (for future modules to use)
// =====================================

/**
 * Get current translation direction
 * @returns {Object} Source and target language codes
 */
export function getCurrentLanguageDirection() {
    return {
        source: currentSourceLang,
        target: currentSourceLang === 'en' ? 'es' : 'en'
    };
}

/**
 * Get loaded vector data (for other modules to access)
 * @returns {Object} Current vectorData
 */
export function getVectorData() {
    return vectorData;
}

/**
 * Get document database (for other modules to access)
 * @returns {Object} Current documentDatabase
 */
export function getDocumentDatabase() {
    return documentDatabase;
}

/**
 * Update translation output (for translation module to use)
 * @param {string} translatedText - Translated text to display
 * @param {Array} contextUsed - Context passages used (optional)
 */
export function updateTranslationOutput(translatedText, contextUsed = []) {
    if (translationOutput) {
        // Display the translation
        translationOutput.innerHTML = `
            <div class="translation-result">
                <h3>Translation:</h3>
                <div class="translated-text" style="white-space: pre-line; line-height: 1.6;">${formatMarkdownText(translatedText)}</div>
            </div>
        `;
    }
    
    // Display context information if available
    if (contextUsed && contextUsed.length > 0 && contextInfo) {
        let contextHTML = `
            <div class="context-summary">
                <h4>Context Sources Used:</h4>
            </div>
            <div class="context-items">
        `;

        contextUsed.forEach((context, index) => {
            const score = context.score.toFixed(2);
            const priorityLabel = context.priority === 'document-coherent' ? 'THEMATIC MATCH' : 'HIGH SIMILARITY';
            
            // Special handling for document-level matches
            let textExcerpt;
            if (context.level === 'document') {
                textExcerpt = `Used to identify relevant sections and paragraphs`;
            } else {
                textExcerpt = context.text ? context.text.split('\n')[0].substring(0, 120) + (context.text.length > 120 ? '...' : '') : 'No text available';
            }
            
            contextHTML += `
                <div class="context-item" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-200);">
                    <div style="margin-bottom: 0.25rem;"><strong>Title:</strong> "${context.title}"</div>
                    <div style="margin-bottom: 0.25rem;"><strong>Level:</strong> ${context.level.toUpperCase()}</div>
                    <div style="margin-bottom: 0.25rem;"><strong>Type of Match:</strong> ${priorityLabel}</div>
                    <div style="margin-bottom: 0.25rem;"><strong>Cosine Similarity:</strong> ${score}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Text excerpt:</strong> ${textExcerpt}</div>
                </div>
            `;
        });
        
        contextHTML += `</div>`;
        contextInfo.innerHTML = contextHTML;
        
    } else if (contextInfo) {
        // Show message when no context is available
        contextInfo.innerHTML = `
            <p style="color: var(--gray-500); font-style: italic;">
                No relevant context found in corpus for this translation.
            </p>
        `;
    }
    
    debugLog(`✅ Translation and context display updated`, 'info');
}

// =====================================
// GLOBAL FUNCTIONS FOR MANUAL TESTING
// =====================================

// Make DeepSeek functions available globally with improved status messages
window.setDeepSeekApiKey = function(apiKey) {
    setDeepSeekApiKey(apiKey);
    storeDeepSeekApiKeyLocally(apiKey);
    showStatus('DeepSeek API key configured', 'success', 3000);
};

window.testDeepSeek = async function() {
    try {
        showStatus('Testing DeepSeek API...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const status = await testDeepSeekConnection();
        
        if (status.ready) {
            showStatus('DeepSeek API test successful', 'success', 3000);
            console.log('DeepSeek test result:', status);
        } else {
            showStatus('DeepSeek API test failed', 'error', 5000);
        }
        
        return status;
    } catch (error) {
        showStatus('DeepSeek API test failed', 'error', 5000);
        console.error('DeepSeek API test error:', error);
    }
};

// Add embedding test function with improved status messages
window.testEmbedding = async function() {
    try {
        showStatus('Testing JINA API...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const status = await getEmbeddingModelStatus();
        
        if (status.ready) {
            showStatus('JINA API test successful', 'success', 3000);
        } else {
            showStatus('JINA API test failed', 'error', 5000);
        }
        
        console.log('JINA API status:', status);
        return status;
    } catch (error) {
        showStatus('JINA API test failed', 'error', 5000);
        console.error('JINA API test error:', error);
    }
};

// Add function to update API URL with improved status
window.setJinaApiKey = function(apiKey) {
    setJinaApiKey(apiKey);
    showStatus('JINA API key configured', 'success', 3000);
};

window.storeJinaKey = function(apiKey) {
    storeApiKeyLocally(apiKey);
    showStatus('JINA API key stored locally', 'success', 3000);
};

// Feedback system function
window.submitFeedback = function() {
    showStatus('Feedback system coming soon...', 'success', 3000);
    debugLog('Feedback submitted (placeholder)', 'info');
};

// Make key functions available globally for debugging
if (config.DEV.DEBUG) {
    window.PragmaticTranslator = {
        vectorData: () => vectorData,
        documentDatabase: () => documentDatabase,
        currentLanguage: () => currentSourceLang,
        showStatus,
        loadCorpusData,
        // JINA embedding functions
        embeddingStatus: getEmbeddingModelStatus,
        testEmbedding: window.testEmbedding,
        loadEmbeddingModel: loadEmbeddingModel,
        setJinaApiKey: window.setJinaApiKey,
        storeJinaKey: window.storeJinaKey,
        // ADD THESE SIMILARITY FUNCTIONS:
        createUserInputEmbedding: createUserInputEmbedding,
        findSimilarContext: findSimilarContext,
        // UNCOMMENT AND UPDATE THESE DEEPSEEK FUNCTIONS:
        setDeepSeekApiKey: setDeepSeekApiKey,
        storeDeepSeekApiKeyLocally: storeDeepSeekApiKeyLocally,
        testDeepSeek: testDeepSeekConnection,
        isTranslationReady: isDeepSeekApiReady,
        translateWithContext: translateWithContext
    };
    debugLog('Debug helpers attached to window.PragmaticTranslator', 'info');
}