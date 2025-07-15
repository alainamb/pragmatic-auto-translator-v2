// =====================================
// JINA EMBEDDINGS - ROBUST DUAL ENVIRONMENT
// =====================================

import config from './config.js';
import { debugLog, createError, safeAsync, startTimer, cleanText } from './utils.js';

// Will hold static import result
let STATIC_API_CONFIG = null;
let staticImportAttempted = false;

// =====================================
// ENVIRONMENT & CONFIG
// =====================================

/**
 * Detect current environment
 */
function detectEnvironment() {
  if (window.location.hostname.includes('github.io') || 
      window.location.hostname.includes('github.com')) {
    return 'github_pages';
  }
  return 'local_development';
}

/**
 * Get API config with multiple fallback strategies
 */
async function getApiConfig() {
  // Strategy 1: Try static import first (if not already attempted)
  if (!staticImportAttempted) {
    staticImportAttempted = true;
    try {
      const staticImport = await import('./api-config.js');
      STATIC_API_CONFIG = staticImport.default;
      debugLog('✅ Static API config import successful', 'info');
    } catch (error) {
      debugLog('ℹ️ Static API config import failed (normal for some environments)', 'info');
    }
  }
  
  // Use static import result if available
  if (STATIC_API_CONFIG) {
    debugLog('Using static API config import', 'info');
    return STATIC_API_CONFIG;
  }
  
  // Strategy 2: Try dynamic import as fallback
  try {
    const module = await import('./api-config.js');
    debugLog('✅ Dynamic API config import successful', 'info');
    return module.default;
  } catch (error) {
    debugLog(`❌ Could not load api-config.js: ${error.message}`, 'warn');
    return null;
  }
}

// =====================================
// JINA API CONFIGURATION
// =====================================

const JINA_CONFIG = {
  EMBEDDING_URL: 'https://api.jina.ai/v1/embeddings',
  MODEL: 'jina-embeddings-v3',
  DIMENSIONS: 1024,
  API_KEY: null,  // Will be set via functions below
  MAX_INPUT_LENGTH: 8192,
  TIMEOUT: 30000,
  DEFAULT_OPTIONS: {
    normalized: true,
    embedding_type: 'float'
  }
};

// =====================================
// API KEY MANAGEMENT
// =====================================

/**
 * Set JINA API key manually
 */
export function setJinaApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key provided');
  }
  JINA_CONFIG.API_KEY = apiKey;
  debugLog('JINA API key set manually', 'info');
}

/**
 * Store API key in localStorage for local development
 */
export function storeApiKeyLocally(apiKey) {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('jina_api_key', apiKey);
    setJinaApiKey(apiKey); // Also set in memory
    debugLog('API key stored in localStorage', 'info');
  } else {
    throw new Error('localStorage not available');
  }
}

/**
 * Get API key with multiple fallback strategies
 */
async function getApiKey() {
  const environment = detectEnvironment();
  debugLog(`Getting API key for environment: ${environment}`, 'info');
  
  // Strategy 1: Check manually set key first (highest priority)
  if (JINA_CONFIG.API_KEY) {
    debugLog('✅ Using manually set API key', 'info');
    return JINA_CONFIG.API_KEY;
  }
  
  // Strategy 2: Check localStorage (for local development convenience)
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedKey = localStorage.getItem('jina_api_key');
    if (storedKey && storedKey !== 'null' && storedKey.length > 10) {
      debugLog('✅ Using API key from localStorage', 'info');
      return storedKey;
    }
  }
  
  // Strategy 3: Try loading from api-config.js file
  try {
    const apiConfig = await getApiConfig();
    if (apiConfig?.JINA_CONFIG?.API_KEY) {
      const key = apiConfig.JINA_CONFIG.API_KEY;
      // Validate the key isn't a placeholder
      if (key && key !== 'your-jina-api-key-here' && key !== 'jina_API-KEY' && key.length > 10) {
        debugLog(`✅ Using API key from api-config.js (${environment})`, 'info');
        return key;
      } else {
        debugLog('⚠️ API key in api-config.js appears to be a placeholder', 'warn');
      }
    } else {
      debugLog('⚠️ No JINA_CONFIG.API_KEY found in api-config.js', 'warn');
    }
  } catch (error) {
    debugLog(`❌ Error accessing api-config.js: ${error.message}`, 'error');
  }
  
  debugLog('❌ No valid API key found from any source', 'error');
  return null;
}

/**
 * Get API key status with environment info
 */
export async function getApiKeyStatus() {
  const environment = detectEnvironment();
  const key = await getApiKey();
  
  let source = 'none';
  let details = 'No API key available';
  
  if (key) {
    if (JINA_CONFIG.API_KEY && key === JINA_CONFIG.API_KEY) {
      source = 'manual';
      details = 'Set via setJinaApiKey()';
    } else if (localStorage.getItem('jina_api_key') === key) {
      source = 'localStorage';
      details = 'Stored in browser localStorage';
    } else {
      source = environment === 'github_pages' ? 'github_actions' : 'api_config_file';
      details = environment === 'github_pages' ? 'Injected by GitHub Actions' : 'Loaded from api-config.js';
    }
  }
  
  return {
    hasKey: !!key,
    source: source,
    details: details,
    keyPreview: key ? `${key.substring(0, 10)}...` : null,
    environment: environment,
    isProduction: environment === 'github_pages'
  };
}

// =====================================
// API COMMUNICATION
// =====================================

const callJinaAPI = safeAsync(async (input, options = {}) => {
  const endTimer = startTimer('JINA API call');
  
  const apiKey = await getApiKey();
  if (!apiKey) {
    const status = await getApiKeyStatus();
    throw new Error(`JINA API key not available. Environment: ${status.environment}. ${status.details}. Use setJinaApiKey() or configure api-config.js.`);
  }
  
  const inputArray = Array.isArray(input) ? input : [input];
  
  inputArray.forEach((text, index) => {
    if (typeof text !== 'string') {
      throw new Error(`Input ${index} must be a string`);
    }
    if (text.length > JINA_CONFIG.MAX_INPUT_LENGTH) {
      debugLog(`Input ${index} truncated`, 'warn');
      inputArray[index] = text.substring(0, JINA_CONFIG.MAX_INPUT_LENGTH);
    }
  });
  
  const requestBody = {
    input: inputArray,
    model: JINA_CONFIG.MODEL,
    dimensions: JINA_CONFIG.DIMENSIONS,
    ...JINA_CONFIG.DEFAULT_OPTIONS,
    ...options
  };
  
  const response = await fetch(JINA_CONFIG.EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(JINA_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`JINA API error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Invalid response structure from JINA API');
  }
  
  endTimer();
  debugLog(`JINA API call successful: ${data.data.length} embeddings returned`, 'info');
  return data;
}, 'JINA_API_ERROR');

export const createUserInputEmbedding = safeAsync(async (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text is required and must be a string');
  }
  
  const cleanedText = cleanText(text);
  if (!cleanedText) {
    throw new Error('Input text is empty after cleaning');
  }
  
  const response = await callJinaAPI(cleanedText);
  const embeddingData = response.data[0];
  
  if (!embeddingData.embedding) {
    throw new Error('No embedding returned from JINA API');
  }
  
  const keyStatus = await getApiKeyStatus();
  
  return {
    originalText: text,
    preprocessedText: cleanedText,
    embedding: embeddingData.embedding,
    dimension: embeddingData.embedding.length,
    model: JINA_CONFIG.MODEL,
    apiType: 'jina',
    apiKeySource: keyStatus.source,
    environment: keyStatus.environment,
    usage: response.usage || null,
    timestamp: new Date().toISOString(),
    
    dimensionMismatch: {
      userEmbedding: embeddingData.embedding.length,
      corpusVectors: config.MODELS.EMBEDDING.dimension,
      note: embeddingData.embedding.length !== config.MODELS.EMBEDDING.dimension 
        ? 'Dimension mismatch - consider regenerating corpus'
        : 'Dimensions match'
    }
  };
}, 'EMBEDDING_CREATE_ERROR');

export const loadEmbeddingModel = safeAsync(async () => {
  const keyStatus = await getApiKeyStatus();
  if (!keyStatus.hasKey) {
    throw new Error(`JINA API key required. Environment: ${keyStatus.environment}. ${keyStatus.details}`);
  }
  
  await callJinaAPI('test');
  debugLog(`✅ JINA model ready via ${keyStatus.source}`, 'info');
  return keyStatus;
}, 'MODEL_LOAD_ERROR');

export const isEmbeddingModelReady = safeAsync(async () => {
  const keyStatus = await getApiKeyStatus();
  if (!keyStatus.hasKey) return false;
  
  try {
    await callJinaAPI('test');
    return true;
  } catch (error) {
    return false;
  }
}, 'MODEL_CHECK_ERROR');

export const getEmbeddingModelStatus = safeAsync(async () => {
  const keyStatus = await getApiKeyStatus();
  
  const baseStatus = {
    modelName: JINA_CONFIG.MODEL,
    dimensions: JINA_CONFIG.DIMENSIONS,
    apiType: 'jina',
    endpointUrl: JINA_CONFIG.EMBEDDING_URL,
    ...keyStatus
  };
  
  if (!keyStatus.hasKey) {
    return {
      ...baseStatus,
      status: 'api_key_missing',
      ready: false,
      message: `JINA API key required for ${keyStatus.environment}. ${keyStatus.details}`
    };
  }
  
  try {
    await callJinaAPI('test');
    return {
      ...baseStatus,
      status: 'ready',
      ready: true,
      testPassed: true
    };
  } catch (error) {
    return {
      ...baseStatus,
      status: 'error',
      ready: false,
      error: error.message
    };
  }
}, 'MODEL_STATUS_ERROR');

// Simple initialization
debugLog('JINA Embeddings loaded', 'info');
debugLog(`Environment: ${detectEnvironment()}`, 'info');