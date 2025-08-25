// utils_corpus.js - Consolidated shared functions for corpus processing

const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('./config');
const { timingUtils, ChunkTracker } = require('./utils_timing');

// ============================================================================
// FILE SYSTEM UTILITIES
// ============================================================================

const fileUtils = {
    // Ensure a directory exists
    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`  Created directory: ${dirPath}`);
            return true;
        }
        return false;
    },

    // Get all files with specific extension from directory
    getFilesWithExtension(directory, extension) {
        if (!fs.existsSync(directory)) {
            console.error(`  Directory not found: ${directory}`);
            return [];
        }

        return fs.readdirSync(directory)
            .filter(file => file.toLowerCase().endsWith(extension.toLowerCase()))
            .map(file => ({
                name: file,
                path: path.join(directory, file),
                size: fs.statSync(path.join(directory, file)).size,
                sizeKB: (fs.statSync(path.join(directory, file)).size / 1024).toFixed(1)
            }));
    },

    // Read file with error handling
    readFileWithErrorHandling(filePath, encoding = 'utf8') {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            return fs.readFileSync(filePath, encoding);
        } catch (error) {
            console.error(`  Error reading file ${filePath}: ${error.message}`);
            throw error;
        }
    },

    // Write file with error handling
    writeFileWithErrorHandling(filePath, content, encoding = 'utf8') {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            this.ensureDir(dir);
            
            fs.writeFileSync(filePath, content, encoding);
            return true;
        } catch (error) {
            console.error(`  Error writing file ${filePath}: ${error.message}`);
            throw error;
        }
    },

    // Get file stats with error handling
    getFileStats(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                sizeKB: (stats.size / 1024).toFixed(1),
                sizeMB: (stats.size / (1024 * 1024)).toFixed(1),
                modified: stats.mtime,
                created: stats.ctime
            };
        } catch (error) {
            console.error(`  Error getting file stats ${filePath}: ${error.message}`);
            return null;
        }
    }
};

// ============================================================================
// TEXT PROCESSING UTILITIES
// ============================================================================

const textUtils = {
    // Clean and normalize text
    preprocessText(text) {
        if (!text || typeof text !== 'string') return '';
        
        // Normalize line endings
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Replace multiple newlines with exactly two (preserve paragraph breaks)
        text = text.replace(/\n{3,}/g, '\n\n');
        
        // Trim each line but preserve paragraph structure
        const lines = text.split('\n');
        return lines.map(line => line.trim()).join('\n');
    },

    // Replace curly quotes and special characters
    replaceCurlyQuotes(text) {
        if (!text) return '';
        
        return text
            .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
            .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
            .replace(/[\u2013\u2014]/g, '-')  // Em/en dashes
            .replace(/[\u2026]/g, '...')      // Ellipsis
            .replace(/[\u00A0]/g, ' ');       // Non-breaking space
    },

    // Clean text formatting (remove markdown, footnotes, etc.)
    cleanTextFormatting(text) {
        if (!text) return '';
        
        // Remove markdown formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');  // **bold**
        text = text.replace(/\*(.*?)\*/g, '$1');      // *italic*
        text = text.replace(/__(.*?)__/g, '$1');      // __bold__
        text = text.replace(/_(.*?)_/g, '$1');        // _italic_

        // Remove footnote references
        text = text.replace(/\[\d+\]/g, '');          // [1], [2], etc.
        text = text.replace(/\(\d+\)/g, '');          // (1), (2), etc.
        text = text.replace(/\d+\./g, '');            // Numbered list items at start

        // Clean up extra spaces
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    },

    // Split text into chunks with paragraph preservation
    splitIntoChunks(text, maxChunkSize) {
        if (!text) return [];
        if (text.length <= maxChunkSize) return [text];

        const chunks = [];
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
            const cleanParagraph = paragraph.trim();
            
            // If adding this paragraph would exceed the limit
            if (currentChunk.length + cleanParagraph.length + 2 > maxChunkSize) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                
                // If paragraph itself is too large, split by sentences
                if (cleanParagraph.length > maxChunkSize) {
                    const sentences = this.splitLargeParagraph(cleanParagraph, maxChunkSize);
                    
                    for (const sentence of sentences) {
                        if (currentChunk.length + sentence.length + 1 > maxChunkSize) {
                            if (currentChunk.trim()) {
                                chunks.push(currentChunk.trim());
                            }
                            currentChunk = sentence;
                        } else {
                            currentChunk += (currentChunk ? ' ' : '') + sentence;
                        }
                    }
                } else {
                    currentChunk = cleanParagraph;
                }
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + cleanParagraph;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [text];
    },

    // Split large paragraphs by sentences
    splitLargeParagraph(paragraph, maxSize) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length + 1 > maxSize) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                
                // If single sentence is still too large, force split at word boundaries
                if (sentence.length > maxSize) {
                    const words = sentence.split(' ');
                    let wordChunk = '';
                    
                    for (const word of words) {
                        if (wordChunk.length + word.length + 1 > maxSize) {
                            if (wordChunk.trim()) {
                                chunks.push(wordChunk.trim());
                            }
                            wordChunk = word;
                        } else {
                            wordChunk += (wordChunk ? ' ' : '') + word;
                        }
                    }
                    
                    currentChunk = wordChunk;
                } else {
                    currentChunk = sentence;
                }
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    },

    // Get word count
    getWordCount(text) {
        if (!text || typeof text !== 'string') return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    },

    // Get character count (excluding whitespace)
    getCharCount(text, includeSpaces = false) {
        if (!text || typeof text !== 'string') return 0;
        return includeSpaces ? text.length : text.replace(/\s/g, '').length;
    },

    // Detect if text has explicit section markers
    hasExplicitSectionMarkers(text) {
        const markers = [
            '[NEW_SECTION]',
            '[NEW_SECTION_HEADER]',
            '[NEW_SUBSECTION]',
            '[NEW_SUBSECTION_HEADER]',
            '[NEW_SUBSUBSECTION]',
            '[NEW_SUBSUBSECTION_HEADER]'
        ];
        
        return markers.some(marker => text.includes(marker));
    }
};

// ============================================================================
// API UTILITIES
// ============================================================================

const apiUtils = {
    // Make a DeepSeek API call with proper error handling
    async callDeepSeekAPI(textContent, systemPrompt, options = {}) {
        const {
            maxTokens = config.processing.text_cleanup.max_tokens,
            temperature = config.processing.text_cleanup.temperature,
            timeout = config.processing.text_cleanup.request_timeout_ms,
            responseFormat = null
        } = options;

        console.log(`    Making API call... (${textContent.length} chars)`);
        
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                model: config.deepseekApiConfig.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: textContent
                    }
                ],
                max_tokens: maxTokens,
                temperature: temperature,
                stream: false,
                ...(responseFormat && { response_format: responseFormat })
            });

            const requestOptions = {
                hostname: config.deepseekApiConfig.host,
                port: 443,
                path: config.deepseekApiConfig.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.deepseekApiKey}`,
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);

                        if (response.choices && response.choices[0] && response.choices[0].message) {
                            const content = response.choices[0].message.content.trim();
                            console.log(`      API call successful`);
                            resolve(content);
                        } else if (response.error) {
                            console.error(`      API Error:`, response.error);
                            reject(new Error(`API Error: ${response.error.message}`));
                        } else {
                            console.error(`      Unexpected response format`);
                            reject(new Error('Unexpected API response format'));
                        }
                    } catch (error) {
                        console.error(`      Parse error:`, error.message);
                        reject(new Error(`Failed to parse API response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`      Request error:`, error.message);
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.setTimeout(timeout, () => {
                console.error(`      Request timeout`);
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    },

    // FIXED: Google Vision API call with proper authentication
    async callGoogleVisionOCR(imagePath, options = {}) {
        const credentials = config.getOcrApiCredentials('google_vision');
        
        // Check for valid credential types
        const hasServiceAccount = credentials.service_account_key_path;
        const hasApiKey = credentials.api_key;
        
        if (!hasServiceAccount && !hasApiKey) {
            throw new Error('Google Vision credentials not configured. Need either service_account_key_path or api_key in api-config.js');
        }
        
        console.log(`    Using Google Vision authentication: ${hasApiKey ? 'API Key' : 'Service Account'}`);

        // Load service account key if specified
        let serviceAccountKey = null;
        if (hasServiceAccount) {
            try {
                let keyPath;
                if (path.isAbsolute(hasServiceAccount)) {
                    keyPath = hasServiceAccount;
                } else {
                    keyPath = path.resolve(__dirname, hasServiceAccount);
                }
                
                if (!fs.existsSync(keyPath)) {
                    throw new Error(`Service account key file not found at: ${keyPath}`);
                }
                
                const keyData = fileUtils.readFileWithErrorHandling(keyPath);
                serviceAccountKey = JSON.parse(keyData);
                
                // Validate required fields
                if (!serviceAccountKey.project_id) {
                    throw new Error('Service account key missing project_id field');
                }
                if (!serviceAccountKey.client_email) {
                    throw new Error('Service account key missing client_email field');
                }
                
                console.log(`    Service account: ${serviceAccountKey.client_email}`);
                console.log(`    Project ID: ${serviceAccountKey.project_id}`);
                
            } catch (error) {
                throw new Error(`Failed to load Google Vision service account key: ${error.message}`);
            }
        }

        console.log(`    Making Google Vision OCR call for: ${path.basename(imagePath)}`);

        return new Promise((resolve, reject) => {
            // Read and encode image
            let imageBase64;
            try {
                const imageBuffer = fs.readFileSync(imagePath);
                imageBase64 = imageBuffer.toString('base64');
            } catch (error) {
                return reject(new Error(`Failed to read image file: ${error.message}`));
            }

            // Get language hints from config
            const languageHints = options.languageHints || 
                config.ocrServices.providers.google_vision.config.image_context.language_hints || 
                [config.currentApiLanguage];

            const requestBody = {
                requests: [{
                    image: {
                        content: imageBase64
                    },
                    features: [{
                        type: 'DOCUMENT_TEXT_DETECTION'
                    }],
                    imageContext: {
                        languageHints: languageHints
                    }
                }]
            };

            const postData = JSON.stringify(requestBody);
            
            // Build request options based on authentication type
            let requestOptions = {
                hostname: 'vision.googleapis.com',
                port: 443,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            // FIXED: Proper authentication handling
            if (hasApiKey) {
                // Use API key authentication (simpler)
                requestOptions.path = `/v1/images:annotate?key=${credentials.api_key}`;
                console.log(`    Using API key authentication (key: ${credentials.api_key.substring(0, 8)}...)`);
                
                // Validate API key format
                if (!credentials.api_key.startsWith('AIza')) {
                    console.warn(`    ⚠️ Warning: API key format may be invalid (should start with 'AIza')`);
                }
                
            } else if (serviceAccountKey) {
                // Use project-based endpoint with service account
                requestOptions.path = `/v1/projects/${serviceAccountKey.project_id}/images:annotate`;
                
                // For proper service account auth, we need OAuth2 token
                // For now, suggest using API key instead
                console.log(`    âš ï¸  Service account authentication requires OAuth2 implementation`);
                console.log(`    ðŸ'¡ Recommendation: Use api_key instead of service_account_key_path for simpler setup`);
                console.log(`    ðŸ'¡ Add 'api_key: "your-key-here"' to google_vision config and comment out service_account_key_path`);
                
                return reject(new Error('Service account authentication requires OAuth2 token. Please use API key authentication instead.'));
            }

            const req = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);

                        // Handle error responses
                        if (response.error) {
                            console.error(`      Google Vision API Error:`, response.error);
                            
                            // Provide specific guidance for common errors
                            if (response.error.code === 403) {
                                console.error(`      ðŸ" 403 Error - Authentication issue:`);
                                console.error(`      1. Verify Vision API is enabled for your project`);
                                console.error(`      2. Check your API key permissions`);
                                console.error(`      3. Ensure billing is enabled on your Google Cloud project`);
                                if (serviceAccountKey) {
                                    console.error(`      4. Verify service account has 'Cloud Vision API Service Agent' role`);
                                }
                            } else if (response.error.code === 400) {
                                console.error(`      ðŸ" 400 Error - Request issue:`);
                                console.error(`      1. Check image format and size`);
                                console.error(`      2. Verify language hints are valid`);
                            }
                            
                            return reject(new Error(`Google Vision API Error (${response.error.code}): ${response.error.message}`));
                        }

                        if (response.responses && response.responses[0]) {
                            const result = response.responses[0];
                            
                            if (result.error) {
                                console.error(`      Google Vision response error:`, result.error);
                                return reject(new Error(`Google Vision Error: ${result.error.message || JSON.stringify(result.error)}`));
                            }

                            const textAnnotation = result.fullTextAnnotation;
                            if (textAnnotation && textAnnotation.text) {
                                console.log(`      Google Vision OCR successful (${textAnnotation.text.length} chars)`);
                                resolve({
                                    text: textAnnotation.text || '',
                                    confidence: this.calculateAverageConfidence(textAnnotation),
                                    wordCount: textAnnotation.text ? textAnnotation.text.split(/\s+/).filter(w => w.length > 0).length : 0
                                });
                            } else {
                                console.log(`      No text detected by Google Vision`);
                                resolve({
                                    text: '',
                                    confidence: 0,
                                    wordCount: 0
                                });
                            }
                        } else {
                            console.error(`      Unexpected Google Vision response format`);
                            console.error(`      Response keys:`, Object.keys(response));
                            reject(new Error('Unexpected Google Vision API response format'));
                        }
                    } catch (error) {
                        console.error(`      Google Vision parse error:`, error.message);
                        reject(new Error(`Failed to parse Google Vision response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`      Google Vision request error:`, error.message);
                reject(new Error(`Google Vision request failed: ${error.message}`));
            });

            req.setTimeout(30000, () => {
                console.error(`      Google Vision request timeout`);
                req.destroy();
                reject(new Error('Google Vision request timeout'));
            });

            req.write(postData);
            req.end();
        });
    },

    // Calculate average confidence from Google Vision response
    calculateAverageConfidence(textAnnotation) {
        if (!textAnnotation || !textAnnotation.pages) return 85; // Default confidence for Google Vision
        
        let totalConfidence = 0;
        let wordCount = 0;
        
        textAnnotation.pages.forEach(page => {
            if (page.blocks) {
                page.blocks.forEach(block => {
                    if (block.confidence !== undefined) {
                        totalConfidence += block.confidence;
                        wordCount++;
                    } else if (block.paragraphs) {
                        block.paragraphs.forEach(paragraph => {
                            if (paragraph.confidence !== undefined) {
                                totalConfidence += paragraph.confidence;
                                wordCount++;
                            } else if (paragraph.words) {
                                paragraph.words.forEach(word => {
                                    if (word.confidence !== undefined) {
                                        totalConfidence += word.confidence;
                                        wordCount++;
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        
        return wordCount > 0 ? Math.round((totalConfidence / wordCount) * 100) : 85;
    },

    // Process text in chunks with API calls
    async processTextInChunks(text, systemPrompt, options = {}) {
        const {
            chunkSize = config.processing.text_cleanup.max_chunk_size,
            delay = config.processing.text_cleanup.api_delay_ms,
            taskName = 'Processing text chunks'
        } = options;

        if (!text || !text.trim()) {
            console.log(`    Text is empty, skipping API processing`);
            return '';
        }

        const chunks = textUtils.splitIntoChunks(text, chunkSize);
        console.log(`    Split into ${chunks.length} chunk(s)`);

        if (chunks.length === 1) {
            console.log(`    Processing single chunk...`);
            return await this.callDeepSeekAPI(chunks[0], systemPrompt, options);
        }

        // Process multiple chunks
        const chunkTracker = new ChunkTracker(chunks.length, chunkSize, taskName);
        let processedText = '';

        for (let i = 0; i < chunks.length; i++) {
            chunkTracker.startChunk(i, chunks[i].length);

            try {
                const processedChunk = await this.callDeepSeekAPI(chunks[i], systemPrompt, options);
                processedText += processedChunk;

                // Add spacing between chunks if needed
                if (i < chunks.length - 1 && !processedChunk.endsWith('\n\n')) {
                    processedText += '\n\n';
                }

                chunkTracker.completeChunk(true, true);
            } catch (error) {
                console.error(`    Error processing chunk ${i + 1}: ${error.message}`);
                // Continue with original chunk if API fails
                processedText += chunks[i];
                if (i < chunks.length - 1) {
                    processedText += '\n\n';
                }
                chunkTracker.completeChunk(false, true, error);
            }

            // Add delay between API calls to avoid rate limiting
            if (i < chunks.length - 1) {
                await timingUtils.sleep(delay, `Rate limiting delay`);
            }
        }

        const summary = chunkTracker.logSummary();
        return processedText.trim();
    },

    // Parse JSON response with error handling
    parseJsonResponse(jsonString, fallbackData = null) {
        try {
            // Try direct parsing first
            return JSON.parse(jsonString);
        } catch (error) {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1]);
                } catch (innerError) {
                    console.error(`    Failed to parse extracted JSON: ${innerError.message}`);
                }
            }
            
            console.error(`    JSON parsing failed: ${error.message}`);
            if (fallbackData) {
                console.log(`    Using fallback data`);
                return fallbackData;
            }
            throw new Error(`Could not parse JSON response: ${error.message}`);
        }
    }
};

// ============================================================================
// LANGUAGE DETECTION AND PROCESSING
// ============================================================================

const languageUtils = {
    // Simple heuristic-based language detection
    detectLanguage(text, defaultLang = 'eng') {
        if (!text || typeof text !== 'string') return defaultLang;
        
        const sampleText = text.substring(0, 1000).toLowerCase();
        
        // Check for Chinese characters
        const chineseChars = /[\u4e00-\u9fff]/;
        if (chineseChars.test(sampleText)) {
            return 'zho';
        }
        
        // Spanish indicator words
        const spanishWords = [' el ', ' la ', ' los ', ' las ', ' y ', ' en ', ' de ', ' que ', ' con ', ' por '];
        const spanishCount = spanishWords.reduce((count, word) => 
            count + (sampleText.includes(word) ? 1 : 0), 0);
        
        if (spanishCount >= 3) {
            return 'esp';
        }
        
        // Default to English
        return 'eng';
    },

    // Get appropriate OCR language code for detected language
    getOcrLanguageCode(detectedLang) {
        return config.toOcrLanguage(detectedLang);
    },

    // Get appropriate API language code for detected language
    getApiLanguageCode(detectedLang) {
        return config.toApiLanguage(detectedLang);
    }
};

// ============================================================================
// CORPUS-SPECIFIC UTILITIES
// ============================================================================

const corpusUtils = {
    // Generate document ID with auto-incrementing
    generateDocumentId(originalFilename, detectedLanguage = null) {
        const lang = detectedLanguage || config.language.family;
        let index = 1;
        let outputPath;

        // Find the next available index
        const outputDir = config.directories.json_output;
        fileUtils.ensureDir(outputDir);

        do {
            const paddedIndex = String(index).padStart(3, '0');
            const filename = `${originalFilename}_${lang}_${paddedIndex}.json`;
            outputPath = path.join(outputDir, filename);
            index++;
        } while (fs.existsSync(outputPath));

        return {
            documentId: `${config.domain}-${lang}_item${String(index - 1).padStart(3, '0')}`,
            filename: path.basename(outputPath),
            outputPath
        };
    },

    // Validate JSON structure against corpus requirements
    validateJsonStructure(jsonObj, documentId) {
        const errors = [];
        const warnings = [];

        // Check required top-level fields
        if (!jsonObj.document_id) {
            errors.push('Missing document_id field');
        }

        if (!jsonObj.content) {
            errors.push('Missing content field');
            return { valid: false, errors, warnings };
        }

        // Check content structure
        const hasSection = jsonObj.content.sections && Array.isArray(jsonObj.content.sections);
        const hasParagraphs = jsonObj.content.paragraphs && Array.isArray(jsonObj.content.paragraphs);

        if (!hasSection && !hasParagraphs) {
            errors.push('Content must have either sections or paragraphs array');
        }

        if (hasSection && hasParagraphs) {
            warnings.push('Content has both sections and paragraphs - sections take precedence');
        }

        // Validate sections if present
        if (hasSection) {
            jsonObj.content.sections.forEach((section, index) => {
                if (!section.id) {
                    errors.push(`Section ${index + 1} missing id field`);
                }
                if (!section.title) {
                    warnings.push(`Section ${index + 1} missing title`);
                }
                if (!section.paragraphs || !Array.isArray(section.paragraphs)) {
                    errors.push(`Section ${index + 1} missing or invalid paragraphs array`);
                }
            });
        }

        // Validate paragraphs if present
        if (hasParagraphs) {
            jsonObj.content.paragraphs.forEach((para, index) => {
                if (!para.id) {
                    errors.push(`Paragraph ${index + 1} missing id field`);
                }
                if (!para.text || typeof para.text !== 'string') {
                    errors.push(`Paragraph ${index + 1} missing or invalid text field`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    },

    // Clean and normalize JSON structure
    normalizeJsonStructure(jsonObj, documentId) {
        const normalized = {
            document_id: documentId,
            content: {}
        };

        // Handle abstract
        if (jsonObj.content?.abstract?.trim() && jsonObj.content.abstract.trim().length > 10) {
            normalized.content.abstract = textUtils.cleanTextFormatting(
                textUtils.replaceCurlyQuotes(jsonObj.content.abstract.trim())
            );
        }

        // Handle sections
        if (jsonObj.content?.sections && Array.isArray(jsonObj.content.sections)) {
            normalized.content.sections = [];
            let sectionCounter = 1;

            jsonObj.content.sections.forEach((section) => {
                if (!section.title && !section.paragraphs) return;

                const normalizedSection = {
                    id: section.id || `section_${sectionCounter}`,
                    title: section.title ? textUtils.cleanTextFormatting(section.title.trim()) : '',
                    paragraphs: []
                };

                // Process paragraphs
                if (Array.isArray(section.paragraphs)) {
                    let paraCounter = 1;
                    section.paragraphs.forEach((para) => {
                        if (para.text?.trim()) {
                            // Split text by double newlines if they were combined
                            const paragraphs = para.text.split(/\n\s*\n/).filter(p => p.trim());
                            paragraphs.forEach((p) => {
                                normalizedSection.paragraphs.push({
                                    id: para.id || `p${sectionCounter}_${paraCounter}`,
                                    text: textUtils.cleanTextFormatting(textUtils.replaceCurlyQuotes(p.trim()))
                                });
                                paraCounter++;
                            });
                        }
                    });
                }

                if (normalizedSection.paragraphs.length > 0) {
                    normalized.content.sections.push(normalizedSection);
                    sectionCounter++;
                }
            });
        }
        // Handle paragraphs (no sections)
        else if (jsonObj.content?.paragraphs && Array.isArray(jsonObj.content.paragraphs)) {
            normalized.content.paragraphs = [];
            let paragraphCounter = 1;

            jsonObj.content.paragraphs.forEach((para) => {
                if (para.text?.trim()) {
                    // Split text by double newlines if they were combined
                    const paragraphs = para.text.split(/\n\s*\n/).filter(p => p.trim());
                    paragraphs.forEach((p) => {
                        normalized.content.paragraphs.push({
                            id: para.id || `p${paragraphCounter}`,
                            text: textUtils.cleanTextFormatting(textUtils.replaceCurlyQuotes(p.trim()))
                        });
                        paragraphCounter++;
                    });
                }
            });

            if (normalized.content.paragraphs.length === 0) {
                delete normalized.content.paragraphs;
            }
        }

        // Handle figures and tables
        if (jsonObj.content?.figures && Array.isArray(jsonObj.content.figures)) {
            normalized.content.figures = jsonObj.content.figures.map((fig, idx) => ({
                id: fig.id || `figure_${idx + 1}`,
                caption: textUtils.cleanTextFormatting((fig.caption || `Figure ${idx + 1}`).trim())
            }));
        }

        if (jsonObj.content?.tables && Array.isArray(jsonObj.content.tables)) {
            normalized.content.tables = jsonObj.content.tables.map((tbl, idx) => ({
                id: tbl.id || `table_${idx + 1}`,
                caption: textUtils.cleanTextFormatting((tbl.caption || `Table ${idx + 1}`).trim())
            }));
        }

        return normalized;
    },

    // Get processing statistics
    getProcessingStats(originalText, processedJson) {
        const stats = {
            original: {
                length: originalText?.length || 0,
                words: textUtils.getWordCount(originalText),
                characters: textUtils.getCharCount(originalText, true)
            },
            processed: {
                sections: 0,
                paragraphs: 0,
                figures: 0,
                tables: 0,
                hasAbstract: false
            }
        };

        if (processedJson?.content) {
            stats.processed.hasAbstract = !!processedJson.content.abstract;
            
            if (processedJson.content.sections) {
                stats.processed.sections = processedJson.content.sections.length;
                stats.processed.paragraphs = processedJson.content.sections.reduce((count, section) => {
                    return count + (section.paragraphs ? section.paragraphs.length : 0);
                }, 0);
            } else if (processedJson.content.paragraphs) {
                stats.processed.paragraphs = processedJson.content.paragraphs.length;
            }

            if (processedJson.content.figures) {
                stats.processed.figures = processedJson.content.figures.length;
            }

            if (processedJson.content.tables) {
                stats.processed.tables = processedJson.content.tables.length;
            }
        }

        return stats;
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    fileUtils,
    textUtils,
    apiUtils,
    languageUtils,
    corpusUtils,
    
    // Convenience re-exports from config
    config,
    
    // Common patterns
    async processFileWithTiming(filePath, processingFunction, taskName) {
        const timer = timingUtils.createTimer(taskName || `Processing ${path.basename(filePath)}`);
        
        try {
            timer.logStatus('Starting...');
            const result = await processingFunction(filePath);
            const summary = timer.stop('Completed successfully');
            
            console.log(`  Processing time: ${summary.formattedTotal}`);
            return { success: true, result, timing: summary };
        } catch (error) {
            timer.stop(`Failed: ${error.message}`);
            console.error(`  Error: ${error.message}`);
            return { success: false, error, timing: timer.stop() };
        }
    }
};