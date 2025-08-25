// textToJson.js - Refactored to use centralized config and utilities
// Originally written by Evelyn Johnson

const fs = require('fs');
const path = require('path');

// Import centralized utilities and configuration
// Check if we're in the scripts directory or root directory
const isInScriptsDir = path.basename(__dirname) === 'scripts';
const scriptsPath = isInScriptsDir ? './' : './scripts/';

// Import with correct paths
const config = require(scriptsPath + 'config');
const { fileUtils, textUtils, apiUtils, corpusUtils } = require(scriptsPath + 'utils_corpus');
const { timingUtils } = require(scriptsPath + 'utils_timing');

// Ensure all required directories exist
config.ensureDirectories();

// DeepSeek system prompts for JSON conversion
function generateSystemPrompt(hasMarkers) {
  if (hasMarkers) {
    return `Convert the following plain text into JSON following this exact schema:

ABSTRACT DETECTION RULES:
1. If the document starts with one or more paragraphs BEFORE any section markers, treat these as the abstract
2. Abstract paragraphs should be combined into a single abstract field
3. Only content that appears BEFORE the first section marker should be considered for abstract

STRICT PARAGRAPH RULES:
1. EVERY double newline (blank line) MUST create a new paragraph
2. NEVER combine multiple paragraphs into one unless they're part of the same logical block
3. PRESERVE all paragraph breaks from the original text

STRICT SECTION RULES:
1. ONLY create sections when you see these EXACT markers:
   - [NEW_SECTION] - starts new main section
   - [NEW_SECTION_HEADER] Title - starts new main section with title
   - [NEW_SUBSECTION] - starts new subsection in current section
   - [NEW_SUBSECTION_HEADER] Title - starts new subsection with title
   - [NEW_SUBSUBSECTION] - starts new sub-subsection in current subsection
   - [NEW_SUBSUBSECTION_HEADER] Title - starts new sub-subsection with title
2. CONTINUE current section if no markers are present
3. NEVER start new sections automatically
4. Remove all markers from output
5. Pay special attention to subsection and sub-subsection markers - they must be nested properly

IMPORTANT: Carefully process ALL marker types. Do not skip [NEW_SUBSECTION_HEADER] or [NEW_SUBSUBSECTION_HEADER].

{
  "document_id": "gai-${config.language.family}-itemXXX",
  "content": {
    "abstract": "Combined text from all paragraphs before the first section marker",
    "sections": [
      {
        "id": "section_1",
        "title": "Section Title",
        "paragraphs": [
          {
            "id": "p1_1",
            "text": "paragraph text"
          }
        ],
        "subsections": [
          {
            "id": "section_1_1",
            "title": "Subsection Title",
            "paragraphs": [
              {
                "id": "p1_1_1",
                "text": "paragraph text"
              }
            ],
            "subsubsections": [
              {
                "id": "section_1_1_1",
                "title": "Sub-subsection Title",
                "paragraphs": [
                  {
                    "id": "p1_1_1_1",
                    "text": "paragraph text"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
  
REQUIREMENTS:
1. Use straight quotes "" and apostrophes '' only, overwrite any curly quotes
2. Use backslashes to escape quotes within text: "He said \\"Hello\\""
3. Do not include any metadata or file information
4. Remove in-line markers, headers, footers, page numbers, authors, and non-content text
5. Remove footnote numbers from paragraph text entirely
6. If no abstract is provided, do not include the "abstract" field.
7. Remove marker text ([NEW_SECTION], [NEW_SECTION_HEADER], etc.) from the final output

ID NAMING CONVENTIONS:
- Section IDs: section_1, section_2, etc.
- Subsection IDs: section_1_1, section_2_1, etc.
- Paragraph IDs: p1_1 (section 1, para 1), p1_2_1 (section 1, subsection 2, para 1)

OPTIONAL ARRAYS AT THE END OF THE DOCUMENT (only include if present):
- figures: Only if document contains figures
- tables: Only if document contains tables

Return ONLY the JSON, no explanations or additional text.`;
  } else {
    return `Convert the following plain text into JSON following this exact schema:

STRICT PARAGRAPH RULES:
1. EVERY double newline (blank line) MUST create a new paragraph
2. NEVER combine multiple paragraphs into one
3. PRESERVE all paragraph breaks from the original text

STRICT NO-SECTION RULES:
1. Since this document contains NO explicit section markers, DO NOT create any sections
2. Return ONLY paragraphs
3. Do not try to infer sections from formatting

{
  "document_id": "gai-${config.language.family}-itemXXX",
  "content": {
    "abstract": "",
    "paragraphs": [
      {
        "id": "p1_1",
        "text": "paragraph text"
      }
    ]
  }
}
  
REQUIREMENTS:
1. Use straight quotes "" and apostrophes '' only, overwrite any curly quotes
2. Use backslashes to escape quotes within text: "He said \\"Hello\\""
3. Do not include any metadata or file information
4. Remove in-line markers, headers, footers, page numbers, authors, and non-content text
5. Remove footnote numbers from paragraph text entirely
6. If no abstract is provided, do not include the "abstract" field.
7. Return ONLY paragraphs - sections will be created during merge process

ID NAMING CONVENTIONS:
- Paragraph IDs: p1_1, p1_2, p1_3, etc. (will be renumbered during merge)

OPTIONAL ARRAYS AT THE END OF THE DOCUMENT (only include if present):
- figures: Only if document contains figures
- tables: Only if document contains tables

Return ONLY the JSON, no explanations or additional text.`;
  }
}

class TextToJsonProcessor {
    constructor() {
        // Correct directory flow - json_input → json_output (text_to_json_input → text_to_json_output)
        this.inputDir = config.directories.json_input;   // "../corpus_items/text_to_json_input"
        this.outputDir = config.directories.json_output; // "../corpus_items/text_to_json_output"
        this.processingConfig = config.processing.text_to_json;
        
        console.log(`TextToJsonProcessor initialized:`);
        console.log(`  Input directory: ${this.inputDir}`);
        console.log(`  Output directory: ${this.outputDir}`);
    }

    // Merge JSON chunks with proper section handling
    mergeJsonChunks(jsonChunks, documentId, hasMarkers) {
        const mergedResult = {
            document_id: documentId,
            content: {}
        };

        if (!hasMarkers) {
            // Handle no-markers case - merge all paragraphs
            mergedResult.content.paragraphs = [];
            let paragraphCounter = 1;
            
            jsonChunks.forEach(chunk => {
                if (chunk.content?.paragraphs) {
                    chunk.content.paragraphs.forEach(para => {
                        mergedResult.content.paragraphs.push({
                            ...para,
                            id: `p${paragraphCounter}`
                        });
                        paragraphCounter++;
                    });
                }
                
                // Handle any abstract from first chunk
                if (chunk.content?.abstract && !mergedResult.content.abstract) {
                    mergedResult.content.abstract = chunk.content.abstract;
                }
            });
            
            return mergedResult;
        }

        // Handle markers case - merge sections
        mergedResult.content.sections = [];
        let abstractFound = false;

        jsonChunks.forEach((chunk, chunkIndex) => {
            // Handle abstract from first chunk - look more carefully
            if (chunkIndex === 0 && chunk.content?.abstract && !abstractFound) {
                mergedResult.content.abstract = chunk.content.abstract;
                abstractFound = true;
            }
            
            // Also check if first chunk has content before sections that should be abstract
            if (chunkIndex === 0 && !abstractFound && chunk.content?.sections) {
                // Check if there are paragraphs before the first section that might be abstract
                const firstSection = chunk.content.sections[0];
                if (firstSection && firstSection.paragraphs && firstSection.paragraphs.length > 0) {
                    // Check if the first paragraph looks like an abstract (longer, comprehensive)
                    const firstPara = firstSection.paragraphs[0];
                    if (firstPara.text && firstPara.text.length > 200 && firstPara.text.includes('研究') && firstPara.text.includes('本文')) {
                        mergedResult.content.abstract = firstPara.text;
                        // Remove this paragraph from the section
                        firstSection.paragraphs.shift();
                        abstractFound = true;
                    }
                }
            }

            if (chunk.content?.sections) {
                chunk.content.sections.forEach(section => {
                    // Check if this continues an existing section
                    const existingSection = mergedResult.content.sections.find(
                        s => s.title === section.title
                    );

                    if (existingSection) {
                        // Merge paragraphs
                        if (section.paragraphs) {
                            existingSection.paragraphs = existingSection.paragraphs || [];
                            existingSection.paragraphs.push(...section.paragraphs);
                        }
                        
                        // Merge subsections
                        if (section.subsections) {
                            existingSection.subsections = existingSection.subsections || [];
                            section.subsections.forEach(sub => {
                                const existingSub = existingSection.subsections.find(
                                    s => s.title === sub.title
                                );
                                if (existingSub) {
                                    // Merge subsection paragraphs
                                    if (sub.paragraphs) {
                                        existingSub.paragraphs = existingSub.paragraphs || [];
                                        existingSub.paragraphs.push(...sub.paragraphs);
                                    }
                                    
                                    // Merge sub-subsections
                                    if (sub.subsubsections) {
                                        existingSub.subsubsections = existingSub.subsubsections || [];
                                        sub.subsubsections.forEach(subSub => {
                                            const existingSubSub = existingSub.subsubsections.find(
                                                s => s.title === subSub.title
                                            );
                                            if (existingSubSub) {
                                                // Merge sub-subsection paragraphs
                                                if (subSub.paragraphs) {
                                                    existingSubSub.paragraphs = existingSubSub.paragraphs || [];
                                                    existingSubSub.paragraphs.push(...subSub.paragraphs);
                                                }
                                            } else {
                                                // New sub-subsection
                                                existingSub.subsubsections.push(subSub);
                                            }
                                        });
                                    }
                                } else {
                                    // New subsection
                                    existingSection.subsections.push(sub);
                                }
                            });
                        }
                    } else {
                        // New section
                        mergedResult.content.sections.push(section);
                    }
                });
            }
        });

        return mergedResult;
    }

    // Process a single text file with comprehensive timing
    async processTextFile(filePath) {
        const originalFilename = path.basename(filePath, '.txt');
        
        const timer = timingUtils.createTimer(`Converting ${originalFilename} to JSON`);
        timer.logStatus('Starting text to JSON conversion...');

        try {
            // Read the input file
            const inputText = fileUtils.readFileWithErrorHandling(filePath);
            
            if (!inputText.trim()) {
                console.log(`  File is empty: ${originalFilename}.txt`);
                
                // Generate document ID using config language
                const documentId = corpusUtils.generateDocumentId(originalFilename, config.language.family);
                const emptyResult = {
                    document_id: documentId.documentId,
                    content: {
                        paragraphs: []
                    }
                };
                
                fileUtils.writeFileWithErrorHandling(documentId.outputPath, JSON.stringify(emptyResult, null, 2));
                timer.stop('Completed (empty file)');
                
                return {
                    success: true,
                    fileName: originalFilename,
                    documentId: documentId.documentId,
                    originalLength: 0,
                    sections: 0,
                    paragraphs: 0,
                    timing: timer.stop()
                };
            }

            timer.checkpoint(`File loaded: ${inputText.length} characters`);

            // Generate document ID using centralized utility
            const documentInfo = corpusUtils.generateDocumentId(originalFilename, config.language.family);
            console.log(`  Document ID: ${documentInfo.documentId}`);
            console.log(`  Output file: ${documentInfo.filename}`);

            // Check for explicit section markers
            const hasMarkers = textUtils.hasExplicitSectionMarkers(inputText);
            console.log(`  Section markers detected: ${hasMarkers ? 'YES' : 'NO'}`);
            
            if (hasMarkers) {
                // Debug: Show what markers we found
                const foundMarkers = [];
                if (inputText.includes('[NEW_SECTION]')) foundMarkers.push('NEW_SECTION');
                if (inputText.includes('[NEW_SECTION_HEADER]')) foundMarkers.push('NEW_SECTION_HEADER');
                if (inputText.includes('[NEW_SUBSECTION]')) foundMarkers.push('NEW_SUBSECTION');
                if (inputText.includes('[NEW_SUBSECTION_HEADER]')) foundMarkers.push('NEW_SUBSECTION_HEADER');
                if (inputText.includes('[NEW_SUBSUBSECTION]')) foundMarkers.push('NEW_SUBSUBSECTION');
                if (inputText.includes('[NEW_SUBSUBSECTION_HEADER]')) foundMarkers.push('NEW_SUBSUBSECTION_HEADER');
                console.log(`  Found markers: ${foundMarkers.join(', ')}`);
            }
            
            console.log(`  Processing mode: ${hasMarkers ? 'STRUCTURED (with sections)' : 'FLAT (paragraphs only)'}`);

            timer.checkpoint('Document analysis completed');

            // Preprocess text using centralized utilities
            const preprocessedText = textUtils.preprocessText(inputText);
            const cleanedText = textUtils.replaceCurlyQuotes(preprocessedText);
            
            timer.checkpoint('Text preprocessing completed');

            // Process text through DeepSeek API
            console.log(`  Converting to JSON structure...`);
            console.log(`  Original length: ${inputText.length} characters`);
            console.log(`  Max chunk size: ${this.processingConfig.max_chunk_size} characters`);

            // Split into chunks using centralized utility
            const chunks = textUtils.splitIntoChunks(cleanedText, this.processingConfig.max_chunk_size);
            console.log(`  Split into ${chunks.length} chunk(s)`);

            // Process chunks with comprehensive tracking
            const chunkTracker = timingUtils.createChunkTracker(
                chunks.length, 
                this.processingConfig.max_chunk_size,
                `JSON Conversion: ${originalFilename}`
            );

            const jsonChunks = [];
            let currentSection = null;
            let currentSubsection = null;

            for (let i = 0; i < chunks.length; i++) {
                chunkTracker.startChunk(i, chunks[i].length);

                try {
                    // Add context for continuation if needed
                    let chunkWithContext = chunks[i];
                    if (hasMarkers) {
                        if (currentSection) {
                            chunkWithContext = `[CONTINUE_SECTION:${currentSection.title}]\n${chunkWithContext}`;
                        }
                        if (currentSubsection) {
                            chunkWithContext = `[CONTINUE_SUBSECTION:${currentSubsection.title}]\n${chunkWithContext}`;
                        }
                    }

                    // Generate appropriate system prompt
                    const systemPrompt = generateSystemPrompt(hasMarkers);
                    
                    // Prepare user prompt with better structure handling
                    let userPrompt;
                    if (hasMarkers) {
                        // For documents with markers, provide detailed context
                        let contextInfo = '';
                        if (i === 0) {
                            contextInfo += 'This is the FIRST chunk. Look for abstract content before any section markers.\n';
                        }
                        if (currentSection) {
                            contextInfo += `Current Section: ${currentSection.title}\n`;
                        }
                        if (currentSubsection) {
                            contextInfo += `Current Subsection: ${currentSubsection.title}\n`;
                        }

                        userPrompt = `PROCESSING INSTRUCTIONS:
${contextInfo}
⚠️ CRITICAL REQUIREMENT: This document contains nested structure markers that MUST be processed correctly.

MANDATORY PROCESSING RULES:
1. [NEW_SECTION_HEADER] Title → Create main section with "title" field
2. [NEW_SUBSECTION_HEADER] Title → Create subsection WITHIN current section with "subsections" array
3. [NEW_SUBSUBSECTION_HEADER] Title → Create sub-subsection WITHIN current subsection with "subsubsections" array

DO NOT FLATTEN THE STRUCTURE. You MUST create the nested arrays as specified in the schema.

EXAMPLE OF REQUIRED OUTPUT STRUCTURE:
{
  "content": {
    "sections": [
      {
        "id": "section_1",
        "title": "Main Section Title",
        "paragraphs": [...],
        "subsections": [
          {
            "id": "section_1_1", 
            "title": "Subsection Title",
            "paragraphs": [...],
            "subsubsections": [
              {
                "id": "section_1_1_1",
                "title": "Sub-subsection Title", 
                "paragraphs": [...]
              }
            ]
          }
        ]
      }
    ]
  }
}

CRITICAL: Pay attention to ALL marker types:
- [NEW_SECTION_HEADER] creates main sections
- [NEW_SUBSECTION_HEADER] creates subsections within current section  
- [NEW_SUBSUBSECTION_HEADER] creates sub-subsections within current subsection

If this is the first chunk, check if content appears BEFORE any section markers - if so, use it as the abstract.

TEXT TO PROCESS:
${chunkWithContext}`;
                    } else {
                        userPrompt = `Convert this text chunk to JSON format. The document contains NO section markers, so return only paragraphs (no sections):

${chunkWithContext}`;
                    }

                    // Make API call using centralized utility
                    const apiResponse = await apiUtils.callDeepSeekAPI(
                        userPrompt,
                        systemPrompt,
                        {
                            maxTokens: this.processingConfig.max_tokens,
                            temperature: this.processingConfig.temperature,
                            responseFormat: { type: 'json_object' }
                        }
                    );

                    // Parse JSON response
                    const chunkResult = apiUtils.parseJsonResponse(apiResponse, {
                        content: hasMarkers ? { sections: [] } : { paragraphs: [] }
                    });

                    // DEBUG: Check if API is processing markers correctly
                    if (hasMarkers && chunkResult.content?.sections) {
                        let hasSubsections = false;
                        let hasSubSubsections = false;
                        
                        chunkResult.content.sections.forEach(section => {
                            if (section.subsections && section.subsections.length > 0) {
                                hasSubsections = true;
                                section.subsections.forEach(sub => {
                                    if (sub.subsubsections && sub.subsubsections.length > 0) {
                                        hasSubSubsections = true;
                                    }
                                });
                            }
                        });
                        
                        console.log(`    API Response Analysis:`);
                        console.log(`      Sections: ${chunkResult.content.sections.length}`);
                        console.log(`      Has Subsections: ${hasSubsections}`);
                        console.log(`      Has Sub-subsections: ${hasSubSubsections}`);
                        
                        if (!hasSubsections && (chunks[i].includes('[NEW_SUBSECTION_HEADER]'))) {
                            console.log(`    WARNING: Chunk contains subsection markers but API didn't create subsections!`);
                        }
                    }

                    // Update section context for next chunk
                    if (hasMarkers && chunkResult.content?.sections) {
                        const lastSection = chunkResult.content.sections[chunkResult.content.sections.length - 1];
                        if (lastSection) {
                            currentSection = lastSection;
                            if (lastSection.subsections && lastSection.subsections.length > 0) {
                                currentSubsection = lastSection.subsections[lastSection.subsections.length - 1];
                            } else {
                                currentSubsection = null;
                            }
                        }
                    }

                    // Force no sections if document has no markers
                    if (!hasMarkers && chunkResult.content) {
                        // Move any paragraphs from sections to root level
                        if (chunkResult.content.sections) {
                            if (!chunkResult.content.paragraphs) {
                                chunkResult.content.paragraphs = [];
                            }

                            chunkResult.content.sections.forEach(section => {
                                if (section.paragraphs) {
                                    chunkResult.content.paragraphs.push(...section.paragraphs);
                                }
                                if (section.subsections) {
                                    section.subsections.forEach(sub => {
                                        if (sub.paragraphs) {
                                            chunkResult.content.paragraphs.push(...sub.paragraphs);
                                        }
                                    });
                                }
                            });
                            delete chunkResult.content.sections;
                        }
                    }

                    jsonChunks.push(chunkResult);
                    chunkTracker.completeChunk(true, true);

                } catch (chunkError) {
                    console.error(`    Error processing chunk ${i + 1}: ${chunkError.message}`);
                    // Push empty chunk to maintain array position
                    jsonChunks.push({
                        content: hasMarkers ? { sections: [] } : { paragraphs: [] }
                    });
                    chunkTracker.completeChunk(false, true, chunkError);
                }

                // Add delay between API calls for rate limiting
                if (i < chunks.length - 1) {
                    await timingUtils.sleep(this.processingConfig.api_delay_ms, 'Rate limiting delay');
                }
            }

            timer.checkpoint('API processing completed');

            if (jsonChunks.length === 0) {
                throw new Error('No chunks were successfully processed');
            }

            console.log(`  Merging ${jsonChunks.length} processed chunks...`);
            const mergedResult = this.mergeJsonChunks(jsonChunks, documentInfo.documentId, hasMarkers);

            timer.checkpoint('Chunk merging completed');

            // Normalize and validate structure using centralized utilities
            const normalizedResult = corpusUtils.normalizeJsonStructure(mergedResult, documentInfo.documentId);
            
            // Validate the final structure
            const validation = corpusUtils.validateJsonStructure(normalizedResult, documentInfo.documentId);
            
            if (!validation.valid) {
                console.warn(`  Structure validation warnings:`);
                validation.errors.forEach(error => console.warn(`    ❌ ${error}`));
                validation.warnings.forEach(warning => console.warn(`    ⚠️ ${warning}`));
            } else if (validation.warnings.length > 0) {
                validation.warnings.forEach(warning => console.warn(`    ⚠️ ${warning}`));
            }

            timer.checkpoint('Structure validation completed');

            // Save the final JSON
            fileUtils.writeFileWithErrorHandling(
                documentInfo.outputPath, 
                JSON.stringify(normalizedResult, null, 2)
            );

            timer.checkpoint('Output file saved');

            // Calculate and log statistics
            const stats = corpusUtils.getProcessingStats(inputText, normalizedResult);
            const finalSummary = timer.stop('JSON conversion completed successfully');

            console.log('\n' + '='.repeat(60));
            console.log(`JSON CONVERSION COMPLETE: ${originalFilename}`);
            console.log('='.repeat(60));
            console.log(`Document ID: ${documentInfo.documentId}`);
            console.log(`Original: ${stats.original.words.toLocaleString()} words, ${stats.original.characters.toLocaleString()} chars`);
            console.log(`Structure: ${stats.processed.sections} sections, ${stats.processed.paragraphs} paragraphs`);
            if (stats.processed.figures > 0) console.log(`Figures: ${stats.processed.figures}`);
            if (stats.processed.tables > 0) console.log(`Tables: ${stats.processed.tables}`);
            if (stats.processed.hasAbstract) console.log(`Abstract: ✅ Present`);
            console.log(`Processing Time: ${finalSummary.formattedTotal}`);
            console.log(`Output File: ${documentInfo.filename}`);
            console.log('='.repeat(60));

            const chunkSummary = chunkTracker.logSummary();

            return {
                success: true,
                fileName: originalFilename,
                documentId: documentInfo.documentId,
                originalLength: stats.original.length,
                sections: stats.processed.sections,
                paragraphs: stats.processed.paragraphs,
                figures: stats.processed.figures,
                tables: stats.processed.tables,
                hasAbstract: stats.processed.hasAbstract,
                chunks: chunks.length,
                outputPath: documentInfo.outputPath,
                timing: finalSummary,
                chunkProcessing: chunkSummary
            };

        } catch (error) {
            timer.stop(`Processing failed: ${error.message}`);
            console.error(`\nError processing ${originalFilename}: ${error.message}`);
            
            // Provide helpful error guidance
            if (error.message.includes('API Error')) {
                console.error(`💡 Check your DeepSeek API key in api-config.js`);
            } else if (error.message.includes('parse')) {
                console.error(`💡 JSON parsing failed - check DeepSeek response format`);
            } else if (error.message.includes('chunks')) {
                console.error(`💡 Try reducing max_chunk_size in config.json`);
            }
            
            return {
                success: false,
                fileName: originalFilename,
                error: error.message,
                timing: timer.stop()
            };
        }
    }

    // Process all text files in the input directory
    async processAllTextFiles() {
        console.log('='.repeat(80));
        console.log('TEXT TO JSON CONVERTER - ENHANCED WITH CENTRALIZED CONFIG & TIMING');
        console.log('='.repeat(80));

        // Print current configuration
        console.log('Current Configuration:');
        console.log(`  Domain: ${config.domain}`);
        console.log(`  Language: ${config.getFullLanguageCode()}`);
        console.log(`  API Language Code: ${config.currentApiLanguage}`);
        console.log(`  DeepSeek Model: ${config.deepseekApiConfig.model}`);
        console.log(`  Max Chunk Size: ${this.processingConfig.max_chunk_size} chars`);
        console.log(`  API Delay: ${this.processingConfig.api_delay_ms}ms`);
        console.log(`  Max Tokens: ${this.processingConfig.max_tokens}`);
        console.log(`  Temperature: ${this.processingConfig.temperature}`);

        if (!fs.existsSync(this.inputDir)) {
            console.error(`\nInput folder '${this.inputDir}' not found.`);
            console.log('Please run text cleanup first.');
            console.log(`Expected path: ${this.inputDir}`);
            return;
        }

        const textFiles = fileUtils.getFilesWithExtension(this.inputDir, '.txt');

        if (textFiles.length === 0) {
            console.log(`\nNo text files found in '${this.inputDir}'.`);
            console.log('Please run text cleanup first.');
            return;
        }

        console.log(`\nFound ${textFiles.length} text file(s) to process:`);
        textFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.sizeKB} KB)`);
        });

        console.log(`\nProcessing Configuration:`);
        console.log(`  Input Directory: ${this.inputDir}`);
        console.log(`  Output Directory: ${this.outputDir}`);
        console.log(`  Document ID Format: ${config.domain}-${config.language.family}_itemXXX`);
        console.log(`  Section Markers: [NEW_SECTION], [NEW_SECTION_HEADER], etc.`);
        console.log(`  Processing Logic: Check entire file for markers, then process accordingly`);

        const batchTimer = timingUtils.createTimer('Batch Text to JSON');
        const progressTracker = timingUtils.createProgressTracker(textFiles.length, 'Text to JSON Conversion');
        const results = [];

        console.log('\n' + '='.repeat(60));
        console.log('STARTING BATCH JSON CONVERSION...');
        console.log('='.repeat(60));

        for (let i = 0; i < textFiles.length; i++) {
            const textFile = textFiles[i];
            progressTracker.startItem(textFile.name, i);

            try {
                const result = await this.processTextFile(textFile.path);
                results.push(result);
                progressTracker.completeItem(result.success);
            } catch (error) {
                console.error(`Error processing ${textFile.name}: ${error.message}`);
                results.push({
                    success: false,
                    fileName: textFile.name,
                    error: error.message
                });
                progressTracker.completeItem(false, error);
            }
            
            // Brief pause between files for rate limiting
            if (i < textFiles.length - 1) {
                await timingUtils.sleep(1000, 'Brief pause between files');
            }
        }

        // Final batch summary
        const batchSummary = batchTimer.stop('Batch JSON conversion completed');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log('\n' + '='.repeat(80));
        console.log('BATCH JSON CONVERSION COMPLETE!');
        console.log('='.repeat(80));
        console.log(`Total Files: ${textFiles.length}`);
        console.log(`Successful: ${successful.length}`);
        if (failed.length > 0) {
            console.log(`Failed: ${failed.length}`);
        }

        if (successful.length > 0) {
            const totalSections = successful.reduce((sum, r) => sum + (r.sections || 0), 0);
            const totalParagraphs = successful.reduce((sum, r) => sum + (r.paragraphs || 0), 0);
            const totalFigures = successful.reduce((sum, r) => sum + (r.figures || 0), 0);
            const totalTables = successful.reduce((sum, r) => sum + (r.tables || 0), 0);
            const withAbstracts = successful.filter(r => r.hasAbstract).length;
            
            console.log(`Total Structure Created:`);
            console.log(`  Sections: ${totalSections}`);
            console.log(`  Paragraphs: ${totalParagraphs.toLocaleString()}`);
            if (totalFigures > 0) console.log(`  Figures: ${totalFigures}`);
            if (totalTables > 0) console.log(`  Tables: ${totalTables}`);
            if (withAbstracts > 0) console.log(`  Documents with Abstracts: ${withAbstracts}`);
        }

        console.log(`Total Processing Time: ${batchSummary.formattedTotal}`);
        console.log(`Output Directory: ${this.outputDir}`);

        if (failed.length > 0) {
            console.log(`\nFailed Files:`);
            failed.forEach(result => {
                console.log(`  - ${result.fileName}: ${result.error}`);
            });
            console.log(`\n💡 Common fixes:`);
            console.log(`  - Check DeepSeek API key in api-config.js`);
            console.log(`  - Verify input files exist in ${this.inputDir}`);
            console.log(`  - Check internet connection for API calls`);
            console.log(`  - Consider reducing max_chunk_size if getting timeout errors`);
        }

        const progressSummary = progressTracker.logSummary();
        console.log('='.repeat(80));

        return {
            total: textFiles.length,
            successful: successful.length,
            failed: failed.length,
            results,
            timing: batchSummary,
            progress: progressSummary
        };
    }
}

// Main execution function
async function main() {
    const processor = new TextToJsonProcessor();
    
    // Handle single file processing with simplified CLI
    const singleFileArg = process.argv[2];
    if (singleFileArg) {
        // Support both filename only and full path
        let singlePath;
        if (path.isAbsolute(singleFileArg) || singleFileArg.includes('/') || singleFileArg.includes('\\')) {
            singlePath = singleFileArg;
        } else {
            // Just filename provided, look in input directory
            singlePath = path.join(processor.inputDir, singleFileArg);
        }
        
        if (!fs.existsSync(singlePath)) {
            console.error(`Specified file not found: ${singlePath}`);
            console.log(`Available files in ${processor.inputDir}:`);
            const availableFiles = fileUtils.getFilesWithExtension(processor.inputDir, '.txt');
            if (availableFiles.length > 0) {
                availableFiles.forEach(file => console.log(`  - ${file.name}`));
            } else {
                console.log(`  No .txt files found`);
                console.log(`  💡 Run 'node pdfTextCleanup.js' first to clean text files`);
            }
            process.exit(1);
        } else {
            console.log(`Processing single file: ${path.basename(singlePath)}`);
            const result = await processor.processTextFile(singlePath);
            
            if (result.success) {
                console.log(`\n✅ Successfully converted: ${result.fileName}`);
                console.log(`   Document ID: ${result.documentId}`);
                console.log(`   Structure: ${result.sections} sections, ${result.paragraphs} paragraphs`);
                console.log(`   Processing time: ${result.timing.formattedTotal}`);
                console.log(`   Chunks processed: ${result.chunks}`);
            } else {
                console.log(`\n❌ Failed to convert: ${result.fileName}`);
                console.log(`   Error: ${result.error}`);
            }
            
            process.exit(result.success ? 0 : 1);
        }
    } else {
        // Process all text files
        const batchResult = await processor.processAllTextFiles();
        process.exit(batchResult.failed > 0 ? 1 : 0);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n\nProcess interrupted by user.');
    console.log('Any completed files have been saved.');
    process.exit(0);
});

// Export for potential use as module
module.exports = {
    TextToJsonProcessor,
    main,
    generateSystemPrompt
};

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        
        // Provide helpful guidance based on error type
        if (error.message.includes('DeepSeek')) {
            console.error('💡 Check your DeepSeek API configuration in api-config.js');
        } else if (error.message.includes('ENOENT')) {
            console.error('💡 Check that input files exist and paths are correct');
        } else if (error.message.includes('Config')) {
            console.error('💡 Verify config.json and api-config.js are properly set up');
        } else if (error.message.includes('JSON')) {
            console.error('💡 JSON parsing failed - check DeepSeek response format');
        }
        
        process.exit(1);
    });
}