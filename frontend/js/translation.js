// =====================================
// CORPUS-INFORMED TRANSLATION MODULE
// =====================================

import config from './config.js';
import { debugLog, createError, safeAsync, startTimer } from './utils.js';
import { getDocumentTitle } from './corpora-retrieval.js';

// =====================================
// DEEPSEEK API CONFIGURATION
// =====================================

// Local API configuration (loaded dynamically)
let localApiConfig = null;

/**
 * Load local API configuration if available (follows JINA pattern)
 */
async function loadLocalApiConfig() {
  if (localApiConfig !== null) {
    return; // Already loaded
  }
  
  try {
    const importedConfig = await import('./api-config.js');
    localApiConfig = importedConfig.DEEPSEEK_CONFIG;
    debugLog('Local DeepSeek API config loaded successfully', 'info');
  } catch (error) {
    localApiConfig = false; // Mark as attempted but not found
    debugLog('No local API config found (this is normal for production)', 'info');
  }
}

const DEEPSEEK_CONFIG = {
  // DeepSeek API endpoint
  baseUrl: 'https://api.deepseek.com/v1/chat/completions',
  
  // Model configuration
  model: 'deepseek-chat',
  
  // Request configuration
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  
  // Generation parameters for translation
  parameters: {
    temperature: 0.3,        // Low temperature for consistent translation
    max_tokens: 4096,        // Generous token limit for translations
    top_p: 0.9,             // Focused sampling for quality
    frequency_penalty: 0.0,  // No penalty for repetition in translation
    presence_penalty: 0.0    // No penalty for presence
  }
};

// =====================================
// API KEY MANAGEMENT (following JINA pattern)
// =====================================

let deepseekApiKey = null;

/**
 * Set DeepSeek API key (follows the same pattern as setJinaApiKey)
 * @param {string} apiKey - DeepSeek API key
 */
export function setDeepSeekApiKey(apiKey) {
  deepseekApiKey = apiKey;
  debugLog('DeepSeek API key set', 'info');
}

/**
 * Store DeepSeek API key locally (follows localStorage pattern)
 * @param {string} apiKey - DeepSeek API key
 */
export function storeDeepSeekApiKeyLocally(apiKey) {
  try {
    localStorage.setItem('deepseek_api_key', apiKey);
    setDeepSeekApiKey(apiKey);
    debugLog('DeepSeek API key stored locally', 'info');
  } catch (error) {
    debugLog('Failed to store DeepSeek API key locally', 'error');
  }
}

/**
 * Get DeepSeek API key from local config, environment, or localStorage (following JINA pattern)
 * @returns {Promise<string|null>} API key if available
 */
async function getDeepSeekApiKey() {
  // Ensure local config is loaded
  await loadLocalApiConfig();
  
  // Priority 1: Local API config file (for development)
  if (localApiConfig && localApiConfig.API_KEY && localApiConfig.API_KEY !== 'your-deepseek-api-key-here') {
    debugLog('Using DeepSeek API key from local config file', 'info');
    return localApiConfig.API_KEY;
  }
  
  // Priority 2: Environment variable (for GitHub Actions)
  if (window.DEEPSEEK_API_KEY) {
    debugLog('Using DeepSeek API key from environment variable', 'info');
    return window.DEEPSEEK_API_KEY;
  }
  
  // Priority 3: Previously set key in memory
  if (deepseekApiKey) {
    debugLog('Using DeepSeek API key from memory', 'info');
    return deepseekApiKey;
  }
  
  // Priority 4: localStorage (user input)
  try {
    const storedKey = localStorage.getItem('deepseek_api_key');
    if (storedKey) {
      deepseekApiKey = storedKey;
      debugLog('Using DeepSeek API key from localStorage', 'info');
      return deepseekApiKey;
    }
  } catch (error) {
    debugLog('Could not access localStorage for DeepSeek API key', 'warn');
  }
  
  return null;
}

/**
 * Check if DeepSeek API is ready (follows isEmbeddingModelReady pattern)
 * @returns {Promise<boolean>} True if API key is available
 */
export async function isDeepSeekApiReady() {
  const apiKey = await getDeepSeekApiKey();
  return !!apiKey;
}

// =====================================
// TRANSLATION PROMPT ENGINEERING
// =====================================

/**
 * Create a context-informed translation prompt
 * @param {string} sourceText - Text to translate
 * @param {string} sourceLang - Source language code (en/es)
 * @param {string} targetLang - Target language code (en/es)
 * @param {string} contextText - Relevant corpus context
 * @param {Object} contextMetadata - Context metadata for prompt engineering
 * @returns {string} Formatted prompt for DeepSeek
 */
function createTranslationPrompt(sourceText, sourceLang, targetLang, contextText, contextMetadata) {
  const sourceLanguageName = sourceLang === 'en' ? 'English' : 'Spanish';
  const targetLanguageName = targetLang === 'en' ? 'English' : 'Spanish';
  
  // Create context quality indicator
  const contextQuality = contextMetadata.totalResults > 0 ? 'high' : 'low';
  const contextStrength = contextMetadata.totalResults >= 5 ? 'strong' : 
                         contextMetadata.totalResults >= 2 ? 'moderate' : 'limited';
  
  let prompt = `You are a professional translator specializing in document-level, context-aware translation. Translate the following ${sourceLanguageName} text to ${targetLanguageName}.

TRANSLATION GUIDELINES:
1. Maintain natural, idiomatic expression in the target language
2. Consider the broader document context provided below
3. Preserve the style, tone, and register of the original
4. Use terminology consistent with the domain context
5. Ensure coherence with the surrounding document context
6. Provide translation notes as applicable
7. Visitors can't interact with you after you've provided the translation output so please don't ask for feedback about the translation

CONTEXT INFORMATION:
- Context quality: ${contextQuality} (${contextMetadata.totalResults} relevant passages found)
- Context strength: ${contextStrength}
- Domain: ${config.CORPUS.DOMAIN.toUpperCase()}`;

  // Add context breakdown if available
  if (contextMetadata.resultCounts) {
    prompt += `
- Context sources: ${contextMetadata.resultCounts.documents} documents, ${contextMetadata.resultCounts.sections} sections, ${contextMetadata.resultCounts.paragraphs} paragraphs`;
  }

  // Add relevant context if available
  if (contextText && contextText.trim().length > 0) {
    prompt += `

RELEVANT CONTEXT FROM CORPUS:
${contextText}

---`;
  }

  prompt += `

TEXT TO TRANSLATE:
${sourceText}

TRANSLATION (preserve paragraph structure and formatting):`;

  return prompt;
}

/**
 * Create a fallback prompt when no context is available
 * @param {string} sourceText - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {string} Basic translation prompt
 */
function createFallbackTranslationPrompt(sourceText, sourceLang, targetLang) {
  const sourceLanguageName = sourceLang === 'en' ? 'English' : 'Spanish';
  const targetLanguageName = targetLang === 'en' ? 'English' : 'Spanish';
  
  return `You are a professional translator. Translate the following ${sourceLanguageName} text to ${targetLanguageName}.

GUIDELINES:
1. Maintain natural, idiomatic expression
2. Preserve style, tone, and register
3. Ensure accuracy and fluency

TEXT TO TRANSLATE:
${sourceText}

TRANSLATION:`;
}

// =====================================
// DEEPSEEK API INTERACTION
// =====================================

/**
 * Call DeepSeek API for translation
 * @param {string} prompt - Complete translation prompt
 * @returns {Promise<string>} Translated text
 */
const callDeepSeekAPI = safeAsync(async (prompt) => {
  const endTimer = startTimer('DeepSeek API call');
  
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) {
    throw createError('TRANSLATION_API', 'DeepSeek API key not found. Please set your API key.');
  }
  
  debugLog('Sending translation request to DeepSeek API...', 'info');
  
  try {
    const response = await fetch(DEEPSEEK_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        ...DEEPSEEK_CONFIG.headers,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        ...DEEPSEEK_CONFIG.parameters
      })
    });
    
    if (!response.ok) {
      let errorMessage = `DeepSeek API error: ${response.status} ${response.statusText}`;
      
      // Handle specific error codes
      if (response.status === 402) {
        errorMessage = 'DeepSeek API requires payment. Please add funds to your account at platform.deepseek.com';
      } else if (response.status === 401) {
        errorMessage = 'DeepSeek API key is invalid. Please check your API key.';
      } else if (response.status === 429) {
        errorMessage = 'DeepSeek API rate limit exceeded. Please try again in a moment.';
      } else {
        try {
          const errorData = await response.json();
          if (errorData.error && errorData.error.message) {
            errorMessage = `DeepSeek API error: ${errorData.error.message}`;
          }
        } catch (e) {
          // Use the default error message if we can't parse the response
        }
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('DeepSeek API returned no translation choices');
    }
    
    const translatedText = data.choices[0].message.content.trim();
    
    if (!translatedText) {
      throw new Error('DeepSeek API returned empty translation');
    }
    
    endTimer();
    debugLog(`Translation received: ${translatedText.length} characters`, 'info');
    
    return translatedText;
    
  } catch (error) {
    endTimer();
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw createError('NETWORK', 'Network error connecting to DeepSeek API. Please check your connection.');
    }
    
    throw createError('TRANSLATION_API', error.message);
  }
}, 'DEEPSEEK_API');

// =====================================
// CONTEXT FORMATTING FOR DISPLAY
// =====================================

/**
 * Format context data for UI display
 * @param {Object} contextResults - Results from similarity search
 * @param {Object} documentDatabase - Document database for titles
 * @returns {Object} Formatted context for display
 */
function formatContextForDisplay(contextResults, documentDatabase) {
  if (!contextResults || contextResults.metadata.totalResults === 0) {
    return {
      summary: 'No relevant context found in corpus',
      details: [],
      confidence: 'low',
      coverage: 'none'
    };
  }
  
  const metadata = contextResults.metadata;
  const similarityResults = contextResults.similarityResults;
  
  // Create summary
  const summary = `Found ${metadata.totalResults} relevant passages (${metadata.contextLength} characters) from ${metadata.resultCounts.documents} documents, ${metadata.resultCounts.sections} sections, ${metadata.resultCounts.paragraphs} paragraphs`;
  
  // Calculate confidence based on top scores and result count
  const maxScore = Math.max(metadata.topScores.document, metadata.topScores.section, metadata.topScores.paragraph);
  const confidence = maxScore >= 0.7 ? 'high' : maxScore >= 0.4 ? 'medium' : 'low';
  
  // Calculate coverage
  const coverage = metadata.totalResults >= 8 ? 'comprehensive' : 
                  metadata.totalResults >= 4 ? 'good' : 
                  metadata.totalResults >= 2 ? 'limited' : 'minimal';
  
  // Create detailed context items for display
  const details = [];
  
  // Process each level of results
  ['documents', 'sections', 'paragraphs'].forEach(level => {
    const results = similarityResults[level] || [];
    
    results.forEach((result, index) => {
      const item = result.item;
      const score = result.score;
      
      // Get document title if available
      const docTitle = getDocumentTitle(item.document_id || item.id, documentDatabase);

      details.push({
        level: level.slice(0, -1),
        score: parseFloat(score.toFixed(2)),
        title: docTitle?.title || item.title || (level.slice(0, -1) + ' ' + item.id),
        text: item.text ? item.text.substring(0, 200) + (item.text.length > 200 ? '...' : '') : '',
        documentId: item.document_id || item.id,
        id: item.id,
        priority: result.priority || 'standard' // Preserve the priority from similarity.js
  });
});
});
  
  // Sort by score descending
  details.sort((a, b) => b.score - a.score);
  
  return {
    summary,
    details: details.slice(0, 10), // Limit to top 10 for display
    confidence,
    coverage,
    metadata: {
      totalResults: metadata.totalResults,
      contextLength: metadata.contextLength,
      topScore: Math.round(maxScore * 100),
      resultBreakdown: metadata.resultCounts
    }
  };
}

// =====================================
// MAIN TRANSLATION FUNCTION
// =====================================

/**
 * Translate text with corpus context (main interface function)
 * @param {string} sourceText - Text to translate
 * @param {Object} contextResults - Results from similarity search
 * @param {Object} languageDirection - {source: 'en'|'es', target: 'en'|'es'}
 * @param {Object} documentDatabase - Document database for context formatting
 * @returns {Promise<Object>} Translation results with context info
 */
export const translateWithContext = safeAsync(async (sourceText, contextResults, languageDirection, documentDatabase = {}) => {
  const endTimer = startTimer('Complete translation with context');
  
  debugLog(`Starting translation: ${sourceText.length} chars (${languageDirection.source} → ${languageDirection.target})`, 'info');
  
  // Validate inputs
  if (!sourceText || typeof sourceText !== 'string' || sourceText.trim().length === 0) {
    throw createError('INVALID_INPUT', 'Source text is required for translation');
  }
  
  if (!languageDirection || !languageDirection.source || !languageDirection.target) {
    throw createError('INVALID_INPUT', 'Language direction is required (source and target)');
  }
  
  // Check API readiness
  if (!isDeepSeekApiReady()) {
    throw createError('TRANSLATION_API', 'DeepSeek API key not set. Please configure your API key first.');
  }
  
  try {
    // Prepare context for translation
    const hasContext = contextResults && contextResults.metadata.totalResults > 0;
    const contextText = hasContext ? contextResults.combinedContext : '';
    const contextMetadata = hasContext ? contextResults.metadata : { totalResults: 0 };
    
    // Create appropriate prompt
    const prompt = hasContext 
      ? createTranslationPrompt(sourceText, languageDirection.source, languageDirection.target, contextText, contextMetadata)
      : createFallbackTranslationPrompt(sourceText, languageDirection.source, languageDirection.target);
    
    debugLog(`Translation prompt created: ${prompt.length} characters (context: ${hasContext ? 'yes' : 'no'})`, 'info');
    
    // Call DeepSeek API
    const translatedText = await callDeepSeekAPI(prompt);
    
    // Format context for display
    const contextForDisplay = formatContextForDisplay(contextResults, documentDatabase);
    
    endTimer();
    
    const result = {
      translatedText: translatedText,
      contextUsed: contextForDisplay,
      metadata: {
        sourceLength: sourceText.length,
        translatedLength: translatedText.length,
        languageDirection: languageDirection,
        contextAvailable: hasContext,
        contextLength: contextText.length,
        apiModel: DEEPSEEK_CONFIG.model,
        translationStrategy: hasContext ? 'context-informed' : 'standard'
      }
    };
    
    debugLog(`✅ Translation complete: ${translatedText.length} chars, ${contextForDisplay.confidence} context confidence`, 'info');
    
    return result;
    
  } catch (error) {
    endTimer();
    
    // Enhanced error handling
    debugLog(`Translation failed: ${error.message}`, 'error');
    
    // Re-throw with additional context
    if (error.code) {
      throw error; // Already a formatted error
    } else {
      throw createError('TRANSLATION_GENERAL', `Translation failed: ${error.message}`);
    }
  }
}, 'TRANSLATION_WITH_CONTEXT');

// =====================================
// UTILITY FUNCTIONS
// =====================================

/**
 * Test DeepSeek API connection
 * @returns {Promise<Object>} API status information
 */
export const testDeepSeekConnection = safeAsync(async () => {
  const apiKey = await getDeepSeekApiKey();
  
  if (!apiKey) {
    return {
      status: 'error',
      message: 'No API key configured',
      ready: false
    };
  }
  
  try {
    // Simple test translation
    const testPrompt = 'Translate "Hello" to Spanish. Reply only with the translation:';
    
    const response = await fetch(DEEPSEEK_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        ...DEEPSEEK_CONFIG.headers,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 10,
        temperature: 0
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: 'success',
        message: 'DeepSeek API connection successful',
        ready: true,
        model: DEEPSEEK_CONFIG.model,
        testResponse: data.choices?.[0]?.message?.content?.trim()
      };
    } else {
      return {
        status: 'error',
        message: `API error: ${response.status} ${response.statusText}`,
        ready: false
      };
    }
    
  } catch (error) {
    return {
      status: 'error',
      message: `Connection failed: ${error.message}`,
      ready: false
    };
  }
}, 'DEEPSEEK_TEST');

/**
 * Get translation statistics from recent translations (placeholder for future implementation)
 * @returns {Object} Translation statistics
 */
export function getTranslationStats() {
  // Placeholder for future implementation
  return {
    totalTranslations: 0,
    averageContextLength: 0,
    contextUtilizationRate: 0,
    averageConfidence: 0
  };
}

// =====================================
// EXPORTS
// =====================================

export default {
  // Main translation function
  translateWithContext,
  
  // API management
  setDeepSeekApiKey,
  storeDeepSeekApiKeyLocally,
  isDeepSeekApiReady,
  testDeepSeekConnection,
  
  // Utilities
  getTranslationStats,
  
  // Configuration
  DEEPSEEK_CONFIG
};