// =====================================
// PRAGMATIC AUTO-TRANSLATOR UTILITIES
// =====================================

import config from './config.js';

// =====================================
// VECTOR OPERATIONS
// =====================================

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA - First vector
 * @param {number[]} vectorB - Second vector
 * @returns {number} Similarity score (0-1, higher = more similar)
 */
export function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
    debugLog('Vector dimension mismatch or invalid vectors', 'error');
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) {
    debugLog('Zero magnitude vector detected', 'warn');
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Normalize a vector to unit length
 * @param {number[]} vector - Input vector
 * @returns {number[]} Normalized vector
 */
export function normalizeVector(vector) {
  if (!vector || vector.length === 0) {
    return [];
  }

  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    return vector.slice(); // Return copy of original if zero magnitude
  }

  return vector.map(val => val / magnitude);
}

/**
 * Validate vector dimensions match expected model output
 * @param {number[]} vector - Vector to validate
 * @param {number} expectedDimension - Expected dimension (from config)
 * @returns {boolean} True if valid
 */
export function validateVectorDimension(vector, expectedDimension = config.MODELS.EMBEDDING.dimension) {
  return Array.isArray(vector) && vector.length === expectedDimension;
}

// =====================================
// SIMILARITY SEARCH HELPERS
// =====================================

/**
 * Sort similarity results by score (descending)
 * @param {Array} results - Array of {item, score} objects
 * @returns {Array} Sorted results
 */
export function sortBySimilarity(results) {
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Filter results by minimum threshold
 * @param {Array} results - Array of {item, score} objects  
 * @param {number} threshold - Minimum similarity score
 * @returns {Array} Filtered results
 */
export function filterByThreshold(results, threshold) {
  return results.filter(result => result.score >= threshold);
}

/**
 * Get top K results from similarity search
 * @param {Array} results - Array of {item, score} objects
 * @param {number} k - Number of top results to return
 * @returns {Array} Top K results
 */
export function getTopK(results, k) {
  return sortBySimilarity(results).slice(0, k);
}

// =====================================
// TEXT PROCESSING
// =====================================

/**
 * Truncate text to maximum length, preserving word boundaries
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum character length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Find last space before the limit to avoid cutting words
  const truncated = text.substring(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + suffix;
  }
  
  return truncated + suffix;
}

/**
 * Combine multiple text passages within length limit
 * @param {Array} passages - Array of text strings
 * @param {number} maxLength - Maximum total character length
 * @param {string} separator - Separator between passages (default: '\n\n')
 * @returns {string} Combined text within limit
 */
export function combineTextWithinLimit(passages, maxLength, separator = '\n\n') {
  if (!passages || passages.length === 0) {
    return '';
  }

  let combined = '';
  const sepLength = separator.length;

  for (let i = 0; i < passages.length; i++) {
    const passage = passages[i];
    const addition = (i === 0) ? passage : separator + passage;
    
    if (combined.length + addition.length <= maxLength) {
      combined += addition;
    } else {
      // Try to fit a truncated version of this passage
      const remainingSpace = maxLength - combined.length - (i === 0 ? 0 : sepLength);
      if (remainingSpace > 50) { // Only if we have meaningful space left
        const truncated = truncateText(passage, remainingSpace);
        combined += (i === 0) ? truncated : separator + truncated;
      }
      break;
    }
  }

  return combined;
}

/**
 * Clean and sanitize input text
 * @param {string} text - Input text
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[\r\n]+/g, '\n'); // Normalize line endings
}

// =====================================
// LANGUAGE CODE UTILITIES
// =====================================

/**
 * Convert 3-letter ISO code to 2-letter API code
 * @param {string} threeLetterCode - ISO 3-letter code (eng, esp)
 * @returns {string} 2-letter API code (en, es)
 */
export function toApiLanguageCode(threeLetterCode) {
  return config.LANGUAGE_MAPPING.TO_API_CODES[threeLetterCode] || threeLetterCode;
}

/**
 * Convert 2-letter API code to 3-letter ISO code
 * @param {string} twoLetterCode - API 2-letter code (en, es)
 * @returns {string} 3-letter ISO code (eng, esp)
 */
export function fromApiLanguageCode(twoLetterCode) {
  return config.LANGUAGE_MAPPING.FROM_API_CODES[twoLetterCode] || twoLetterCode;
}

/**
 * Get opposite language direction for translation
 * @param {string} sourceCode - Source language code (2 or 3 letter)
 * @returns {string} Target language code (same format as input)
 */
export function getOppositeLanguage(sourceCode) {
  const twoLetterCode = sourceCode.length === 3 ? toApiLanguageCode(sourceCode) : sourceCode;
  const opposite = twoLetterCode === 'en' ? 'es' : 'en';
  return sourceCode.length === 3 ? fromApiLanguageCode(opposite) : opposite;
}

// =====================================
// DEBUGGING & LOGGING
// =====================================

/**
 * Conditional logging based on debug flag
 * @param {any} message - Message to log
 * @param {string} level - Log level ('log', 'warn', 'error', 'info')
 */
export function debugLog(message, level = 'log') {
  if (config.DEV.DEBUG) {
    // Ensure level is a valid console method
    const validLevels = ['log', 'warn', 'error', 'info'];
    const logLevel = validLevels.includes(level) ? level : 'log';
    console[logLevel](`[Pragmatic Translator] ${message}`);
  }
}

/**
 * Log similarity search results for debugging
 * @param {Array} results - Search results with scores
 * @param {string} searchType - Type of search ('document', 'section', 'paragraph')
 */
export function logSimilarityResults(results, searchType) {
  if (config.DEV.SHOW_SIMILARITY_SCORES) {
    debugLog(`${searchType} similarity results:`, 'info');
    results.forEach((result, index) => {
      debugLog(`  ${index + 1}. Score: ${result.score.toFixed(3)} - ${result.item.title || result.item.id}`, 'info');
    });
  }
}

// =====================================
// ERROR HANDLING
// =====================================

/**
 * Create standardized error object
 * @param {string} type - Error type (from config.ERRORS)
 * @param {string} details - Additional error details
 * @param {Error} originalError - Original error object (optional)
 * @returns {Object} Standardized error
 */
export function createError(type, details = '', originalError = null) {
  return {
    type,
    message: config.ERRORS[type] || 'Unknown error',
    details,
    originalError,
    timestamp: new Date().toISOString()
  };
}

/**
 * Safe async function wrapper with error handling
 * @param {Function} asyncFn - Async function to wrap
 * @param {string} errorType - Error type for failures
 * @returns {Function} Wrapped function
 */
export function safeAsync(asyncFn, errorType) {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      debugLog(`Error in ${asyncFn.name}: ${error.message}`, 'error');
      throw createError(errorType, error.message, error);
    }
  };
}

// =====================================
// PERFORMANCE UTILITIES
// =====================================

/**
 * Simple performance timing utility
 * @param {string} label - Label for the timing
 * @returns {Function} Function to call when operation completes
 */
export function startTimer(label) {
  const startTime = performance.now();
  debugLog(`Starting: ${label}`, 'info');
  
  return () => {
    const duration = performance.now() - startTime;
    debugLog(`Completed: ${label} (${duration.toFixed(2)}ms)`, 'info');
    return duration;
  };
}

// =====================================
// VALIDATION UTILITIES
// =====================================

/**
 * Check if text input is valid for translation
 * @param {string} text - Input text
 * @returns {boolean} True if valid
 */
export function isValidInput(text) {
  return text && 
         typeof text === 'string' && 
         text.trim().length > 0 && 
         text.trim().length <= 10000; // Reasonable length limit
}

/**
 * Check if a model name is compatible with jina-embeddings-v3
 * @param {string} modelName - Model name from vector metadata
 * @returns {boolean} True if compatible
 */
function isJinaV3Compatible(modelName) {
  // Accept various forms of the model name that match your config
  const compatibleNames = [
    config.MODELS.EMBEDDING.name,           // 'jina-embeddings-v3'
    config.MODELS.EMBEDDING.transformersId, // 'jinaai/jina-embeddings-v3'
    'jinaai/jina-embeddings-v3',
    'jina-embeddings-v3',
    'jinaai/jina-embeddings-v3.0'
  ];
  
  return compatibleNames.some(name => 
    modelName === name || 
    modelName.includes('jina-embeddings-v3')
  );
}

/**
 * Validate vector data structure matches expected schema - UPDATED for flexible validation
 * @param {Object} vectorData - Vector data object
 * @returns {boolean} True if valid structure
 */
export function isValidVectorData(vectorData) {
  // Basic structure validation
  if (!vectorData) {
    debugLog('Vector data is null or undefined', 'error');
    return false;
  }
  
  if (!vectorData.metadata) {
    debugLog('Vector data missing metadata', 'error');
    return false;
  }
  
  if (!vectorData.vectors) {
    debugLog('Vector data missing vectors array', 'error');
    return false;
  }
  
  if (!Array.isArray(vectorData.vectors)) {
    debugLog('Vector data vectors is not an array', 'error');
    return false;
  }
  
  // Model validation - more flexible for jina-embeddings-v3
  if (!vectorData.metadata.model) {
    debugLog('Vector metadata missing model field', 'error');
    return false;
  }
  
  if (!isJinaV3Compatible(vectorData.metadata.model)) {
    debugLog(`Vector model "${vectorData.metadata.model}" is not compatible with jina-embeddings-v3`, 'error');
    debugLog(`Expected model containing "jina-embeddings-v3", got: ${vectorData.metadata.model}`, 'warn');
    return false;
  }
  
  // Dimension validation - check for 1024D
  if (!vectorData.metadata.dimension) {
    debugLog('Vector metadata missing dimension field', 'error');
    return false;
  }
  
  const expectedDimension = config.MODELS.EMBEDDING.dimension;
  if (vectorData.metadata.dimension !== expectedDimension) {
    debugLog(`Vector dimension mismatch. Expected: ${expectedDimension}, got: ${vectorData.metadata.dimension}`, 'error');
    return false;
  }
  
  // Validate that vectors actually have the right dimension
  if (vectorData.vectors.length > 0) {
    const firstVector = vectorData.vectors[0];
    if (firstVector.vector && Array.isArray(firstVector.vector)) {
      if (firstVector.vector.length !== expectedDimension) {
        debugLog(`First vector has wrong dimension. Expected: ${expectedDimension}, got: ${firstVector.vector.length}`, 'error');
        return false;
      }
    } else {
      debugLog('First vector missing or invalid vector array', 'error');
      return false;
    }
  }
  
  debugLog(`Vector data validation passed: ${vectorData.vectors.length} vectors, model: ${vectorData.metadata.model}, dimension: ${vectorData.metadata.dimension}`, 'info');
  return true;
}

/**
 * Enhanced validation with detailed error reporting
 * @param {Object} vectorData - Vector data object
 * @param {string} filePath - File path for error reporting
 * @returns {Object} Validation result with detailed messages
 */
export function validateVectorDataDetailed(vectorData, filePath = 'unknown') {
  const result = {
    isValid: false,
    errors: [],
    warnings: [],
    metadata: null
  };

  if (!vectorData) {
    result.errors.push('Vector data is null or undefined');
    return result;
  }

  if (!vectorData.metadata) {
    result.errors.push('Missing metadata object');
    return result;
  }

  if (!vectorData.vectors || !Array.isArray(vectorData.vectors)) {
    result.errors.push('Missing or invalid vectors array');
    return result;
  }

  result.metadata = vectorData.metadata;

  // Model validation - more flexible for jina-embeddings-v3
  if (!vectorData.metadata.model) {
    result.errors.push('Missing model field in metadata');
  } else if (!isJinaV3Compatible(vectorData.metadata.model)) {
    result.errors.push(`Incompatible model: ${vectorData.metadata.model} (expected jina-embeddings-v3 variant)`);
    // Show what we're comparing against for debugging
    debugLog(`Config model name: ${config.MODELS.EMBEDDING.name}`, 'info');
    debugLog(`Config transformers ID: ${config.MODELS.EMBEDDING.transformersId}`, 'info');
    debugLog(`Vector file model: ${vectorData.metadata.model}`, 'info');
  }

  // Dimension validation
  const expectedDimension = config.MODELS.EMBEDDING.dimension;
  if (!vectorData.metadata.dimension) {
    result.errors.push('Missing dimension field in metadata');
  } else if (vectorData.metadata.dimension !== expectedDimension) {
    result.errors.push(`Dimension mismatch: expected ${expectedDimension}, got ${vectorData.metadata.dimension}`);
    debugLog(`Config dimension: ${expectedDimension}`, 'info');
    debugLog(`Vector file dimension: ${vectorData.metadata.dimension}`, 'info');
  }

  // Vector content validation
  if (vectorData.vectors.length === 0) {
    result.warnings.push('No vectors found in file');
  } else {
    const sampleVector = vectorData.vectors[0];
    if (!sampleVector.vector || !Array.isArray(sampleVector.vector)) {
      result.errors.push('First vector missing or invalid vector array');
    } else if (sampleVector.vector.length !== expectedDimension) {
      result.errors.push(`Vector dimension mismatch: expected ${expectedDimension}, got ${sampleVector.vector.length}`);
    }
  }

  result.isValid = result.errors.length === 0;
  
  if (result.isValid) {
    debugLog(`✅ ${filePath} validation passed: ${vectorData.vectors.length} vectors`, 'info');
  } else {
    debugLog(`❌ ${filePath} validation failed:`, 'error');
    result.errors.forEach(error => debugLog(`  - ${error}`, 'error'));
    result.warnings.forEach(warning => debugLog(`  - ${warning}`, 'warn'));
  }

  return result;
}