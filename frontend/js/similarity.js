// =====================================
// SIMPLIFIED CORPUS SIMILARITY SEARCH MODULE
// For Pragmatic Auto-Translator Workshop
// Based on cosine similarity calculations
// 
// WHAT IS COSINE SIMILARITY?
// Cosine similarity calculates the angle between two vectors in high-dimensional space. 
// The closer the angle is to 0°, the more similar the vectors are.
//
// Score Range
// 1.0 = Identical direction (most similar)
// 0.0 = Perpendicular (no similarity)
// -1.0 = Opposite direction (most dissimilar)
// For text embeddings, scores typically range from 0.0 to 1.0.
//
// DOCUMENT-AWARE STRATEGY:
// 1. Find top 2-3 similar documents (for thematic matches)
// 2. Prioritize sections/paragraphs from those documents 
// 3. Include exceptional global matches (highly similar: >70% similarity)
// 4. Create efficient context for translation (max characters defined in config.js)
// 
// Benefits:
// - More coherent, thematically consistent context
// - Efficient use of translation context window
// - Still captures exceptional matches from other documents
// =====================================

import config from './config.js';
import { debugLog, startTimer } from './utils.js';

// =====================================
// CORE SIMILARITY FUNCTIONS
// =====================================

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA - First embedding vector
 * @param {number[]} vectorB - Second embedding vector
 * @returns {number} Similarity score (0-1)
 */
function calculateCosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i];
        magnitudeA += vectorA[i] * vectorA[i];
        magnitudeB += vectorB[i] * vectorB[i];
    }
    
    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    if (magnitude === 0) return 0;
    
    return dotProduct / magnitude;
}

/**
 * Search for similar vectors at a specific level
 * @param {number[]} userEmbedding - User input embedding
 * @param {Array} vectorArray - Array of vector objects
 * @param {string} level - Level type ('document', 'section', 'paragraph')
 * @param {Object} options - Search options
 * @returns {Array} Similar vectors with scores
 */
function searchVectorsAtLevel(userEmbedding, vectorArray, level, options = {}) {
    if (!userEmbedding || !Array.isArray(vectorArray) || vectorArray.length === 0) {
        debugLog(`No vectors available for ${level} search`, 'warn');
        return [];
    }
    
    const results = [];
    const threshold = options.threshold || 0.3; // Minimum similarity threshold
    const maxResults = options.maxResults || 5; // Maximum results per level
    
    debugLog(`Searching ${vectorArray.length} ${level} vectors...`, 'info');
    
    // Calculate similarity for each vector
    for (const vectorItem of vectorArray) {
        if (!vectorItem.vector || !Array.isArray(vectorItem.vector)) {
            continue;
        }
        
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(userEmbedding, vectorItem.vector);
        
        if (similarity >= threshold) {
            results.push({
                item: vectorItem,
                score: similarity,
                level: level,
                // Include text and metadata for context
                text: vectorItem.text || '',
                title: vectorItem.title || vectorItem.document_id || `${level}_${vectorItem.id}`,
                document_id: vectorItem.document_id || vectorItem.id
            });
        }
    }
    
    // Sort by similarity score (highest first) and limit results
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, maxResults);
    
    debugLog(`${level} search: ${results.length} above threshold, returning top ${topResults.length}`, 'info');
    
    return topResults;
}

/**
 * Main function to find similar context using document-aware strategy
 * @param {number[]} userEmbedding - User input embedding from JINA API
 * @param {Object} vectorData - Complete vector data {documents, sections, paragraphs}
 * @param {Object} options - Search options
 * @returns {Object} Similarity search results with context
 */
export async function findSimilarContext(userEmbedding, vectorData, options = {}) {
    const endTimer = startTimer('Similarity search');
    
    try {
        // Validate inputs
        if (!userEmbedding || !Array.isArray(userEmbedding)) {
            throw new Error('Invalid user embedding - must be array');
        }
        
        if (!vectorData || !vectorData.documents || !vectorData.sections || !vectorData.paragraphs) {
            throw new Error('Invalid vector data - missing required levels');
        }
        
        debugLog('Starting document-aware similarity search...', 'info');
        
        // Step 1: Find top similar documents (for thematic coherence)
        const documentResults = searchVectorsAtLevel(
            userEmbedding, 
            vectorData.documents, 
            'document', 
            { threshold: 0.3, maxResults: 3 }
        );
        
        const relevantDocuments = new Set(
            documentResults.map(result => result.document_id || result.item.id)
        );
        
        debugLog(`Found ${relevantDocuments.size} relevant documents for context`, 'info');
        
        // Step 2: Prioritize sections/paragraphs from relevant documents
        const prioritizedSections = [];
        const prioritizedParagraphs = [];
        const globalSections = [];
        const globalParagraphs = [];
        
        // Search sections
        const allSectionResults = searchVectorsAtLevel(
            userEmbedding, 
            vectorData.sections, 
            'section', 
            { threshold: 0.25, maxResults: 15 }
        );
        
        // Separate into prioritized (from relevant docs) and global
        for (const result of allSectionResults) {
            const docId = result.document_id || result.item.document_id;
            if (relevantDocuments.has(docId)) {
                prioritizedSections.push({ ...result, priority: 'document-coherent' });
            } else {
                globalSections.push({ ...result, priority: 'high-similarity' });
            }
        }
        
        // Search paragraphs  
        const allParagraphResults = searchVectorsAtLevel(
            userEmbedding, 
            vectorData.paragraphs, 
            'paragraph', 
            { threshold: 0.25, maxResults: 20 }
        );
        
        // Separate into prioritized and global
        for (const result of allParagraphResults) {
            const docId = result.document_id || result.item.document_id;
            if (relevantDocuments.has(docId)) {
                prioritizedParagraphs.push({ ...result, priority: 'document-coherent' });
            } else {
                globalParagraphs.push({ ...result, priority: 'high-similarity' });
            }
        }
        
        // Step 3: Create balanced selection for context
        const selectedResults = selectBalancedContext({
            prioritizedSections,
            prioritizedParagraphs,
            globalSections: globalSections.slice(0, 2), // Limit global results
            globalParagraphs: globalParagraphs.slice(0, 3)
        });
        
        // Prepare context text
        const contextData = prepareContextForTranslation(selectedResults, options);
        
        endTimer();
        
        const totalResults = selectedResults.length;
        debugLog(`✅ Document-aware search complete: ${totalResults} selected results`, 'info');
        debugLog(`   - ${prioritizedSections.length + prioritizedParagraphs.length} from relevant documents`, 'info');
        debugLog(`   - ${Math.min(2, globalSections.length) + Math.min(3, globalParagraphs.length)} high-similarity global`, 'info');
        
        // Return in format expected by main.js
        return {
            contextPassages: contextData.passages,
            combinedContext: contextData.combinedText,
            similarityResults: {
                documents: documentResults,
                sections: [...prioritizedSections, ...globalSections].slice(0, 8),
                paragraphs: [...prioritizedParagraphs, ...globalParagraphs].slice(0, 10)
            },
            metadata: {
                totalResults: totalResults,
                contextLength: contextData.combinedText.length,
                relevantDocuments: relevantDocuments.size,
                resultCounts: {
                    documents: documentResults.length,
                    sections: prioritizedSections.length + Math.min(2, globalSections.length),
                    paragraphs: prioritizedParagraphs.length + Math.min(3, globalParagraphs.length)
                },
                topScores: {
                    document: documentResults[0]?.score || 0,
                    section: allSectionResults[0]?.score || 0,
                    paragraph: allParagraphResults[0]?.score || 0
                }
            }
        };
        
    } catch (error) {
        endTimer();
        debugLog(`❌ Similarity search failed: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Select balanced context from prioritized and global results
 * @param {Object} results - Object containing prioritized and global results
 * @returns {Array} Selected results for context
 */
function selectBalancedContext({ prioritizedSections, prioritizedParagraphs, globalSections, globalParagraphs }) {
    const selected = [];
    
    // Strategy: Favor document-coherent content, but include exceptional global matches
    
    // Take top prioritized content (from relevant documents)
    selected.push(...prioritizedSections.slice(0, 3));  // Top 3 sections from relevant docs
    selected.push(...prioritizedParagraphs.slice(0, 4)); // Top 4 paragraphs from relevant docs
    
    // Add exceptional global content if it's significantly better
    const globalThreshold = 0.7; // Only include global content with very high similarity
    
    const exceptionalGlobalSections = globalSections.filter(r => r.score >= globalThreshold);
    const exceptionalGlobalParagraphs = globalParagraphs.filter(r => r.score >= globalThreshold);
    
    selected.push(...exceptionalGlobalSections.slice(0, 1)); // Max 1 exceptional global section
    selected.push(...exceptionalGlobalParagraphs.slice(0, 2)); // Max 2 exceptional global paragraphs
    
    // Sort final selection by score
    selected.sort((a, b) => b.score - a.score);
    
    debugLog(`Selected ${selected.length} items for context (prioritized: ${prioritizedSections.length + prioritizedParagraphs.length}, exceptional global: ${exceptionalGlobalSections.length + exceptionalGlobalParagraphs.length})`, 'info');
    
    return selected;
}

/**
 * Prepare context text from similarity results for translation - OPTIMIZED
 * @param {Array} results - Array of similarity results
 * @param {Object} options - Options including maxContextLength
 * @returns {Object} Prepared context data
 */
function prepareContextForTranslation(results, options = {}) {
    const maxLength = options.maxContextLength || config.SIMILARITY.MAX_CONTEXT_LENGTH;
    
    if (results.length === 0) {
        return {
            passages: [],
            combinedText: '',
            contextLength: 0
        };
    }
    
    debugLog(`Optimizing context: ${results.length} candidates, max ${maxLength} characters`, 'info');
    
    // Sort ALL results by similarity score (highest first) - let relevance decide
    const sortedResults = [...results].sort((a, b) => b.score - a.score);
    
    const selectedPassages = [];
    let totalLength = 0;
    let prioritizedCount = 0;
    let globalCount = 0;
    
    // Greedily select passages until we hit the character limit
    for (const result of sortedResults) {
        const { text, title, level, score, priority } = result;
        
        // Skip if no text available
        if (!text) continue;
        
        // Create context header
        const similarityScore = score.toFixed(2);
        const priorityLabel = priority === 'document-coherent' ? 'THEMATIC MATCH' : 'HIGH SIMILARITY';
        const contextHeader = `[${priorityLabel} ${level.toUpperCase()} - ${similarityScore}] ${title}`;
        
        // Calculate full passage length (no truncation - either fits or doesn't)
        const passageLength = contextHeader.length + text.length + 10; // +10 for separators
        
        // Check if we can fit this complete passage
        if (totalLength + passageLength <= maxLength) {
            const passage = `${contextHeader}\n${text}`;
            selectedPassages.push(passage);
            totalLength += passageLength;
            
            // Track selection stats
            if (priority === 'document-coherent') {
                prioritizedCount++;
            } else {
                globalCount++;
            }
            
            debugLog(`✅ Selected ${level} (${score.toFixed(2)} similarity, ${text.length} chars) - ${Math.round(totalLength/maxLength*100)}% budget used`, 'info');
        } else {
            debugLog(`⏭️ Skipped ${level} (${score.toFixed(2)} similarity) - would exceed limit by ${(totalLength + passageLength - maxLength)} chars`, 'info');
        }
    }
    
    // Combine selected passages
    const combinedText = selectedPassages.join('\n\n---\n\n');
    const efficiency = Math.round(combinedText.length/maxLength*100);
    
    debugLog(`🎯 Context optimized: ${selectedPassages.length}/${results.length} passages selected`, 'info');
    debugLog(`📊 Usage: ${combinedText.length}/${maxLength} characters (${efficiency}% efficiency)`, 'info');
    debugLog(`🎯 Mix: ${prioritizedCount} thematic + ${globalCount} high-similarity`, 'info');
    
    return {
        passages: selectedPassages,
        combinedText: combinedText,
        contextLength: combinedText.length,
        efficiency: efficiency,
        selection: {
            candidatesConsidered: results.length,
            candidatesSelected: selectedPassages.length,
            thematicMatches: prioritizedCount,
            highSimilarity: globalCount
        }
    };
}

/**
 * Get similarity statistics for debugging/display
 * @param {Object} similarityResults - Results from findSimilarContext
 * @returns {Object} Statistical summary
 */
export function getSimilarityStats(similarityResults) {
    const allResults = [
        ...similarityResults.documents || [],
        ...similarityResults.sections || [],
        ...similarityResults.paragraphs || []
    ];
    
    if (allResults.length === 0) {
        return {
            totalResults: 0,
            averageScore: 0,
            maxScore: 0,
            minScore: 0
        };
    }
    
    const scores = allResults.map(r => r.score);
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    
    return {
        totalResults: allResults.length,
        averageScore: totalScore / allResults.length,
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores)
    };
}

/**
 * Format context results for display in the UI
 * @param {Object} contextResults - Results from findSimilarContext
 * @returns {Array} Formatted context items for display
 */
export function formatContextForDisplay(contextResults) {
    const allResults = [
        ...contextResults.similarityResults.documents || [],
        ...contextResults.similarityResults.sections || [],
        ...contextResults.similarityResults.paragraphs || []
    ];
    
    // Sort by score and format for display
    return allResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Limit to top 10 for display
        .map(result => ({
            level: result.level,
            score: result.score,
            title: result.title,
            text: result.text,
            document_id: result.document_id,
            priority: result.priority || 'standard', // Show if it's document-coherent or high-similarity
            preview: result.text ? result.text.substring(0, 150) + (result.text.length > 150 ? '...' : '') : ''
        }));
}

// =====================================
// EXPORT DEFAULT MODULE
// =====================================

export default {
    findSimilarContext,
    getSimilarityStats,
    formatContextForDisplay
};