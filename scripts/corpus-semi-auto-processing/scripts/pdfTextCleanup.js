// pdfTextCleanup.js - Refactored to use centralized config and utilities
// Originally written by Evelyn Johnson

const fs = require('fs');
const path = require('path');

// Import centralized utilities and configuration
// Check if we're in the scripts directory or root directory
const isInScriptsDir = path.basename(__dirname) === 'scripts';
const scriptsPath = isInScriptsDir ? './' : './scripts/';

// Import with correct paths
const config = require(scriptsPath + 'config');
const { fileUtils, textUtils, apiUtils } = require(scriptsPath + 'utils_corpus');
const { timingUtils } = require(scriptsPath + 'utils_timing');

// Ensure all required directories exist
config.ensureDirectories();

// DeepSeek system prompt for text cleanup
const SYSTEM_PROMPT = `Your job is to clean up OCR-processed text while preserving ALL original content and structure:

Remove titles, subtitles, and article information that are not part of the main content.

INSTRUCTIONS:
1. Fix OCR errors and complete incomplete words (e.g., "firs" → "first")
2. Remove unnecessary symbols, artifacts and garbage characters that don't belong in normal text
3. Remove timestamps, page numbers, headers, footers, and other metadata that are clearly not part of the main content
4. Maintain the logical flow and paragraph structure of the original text
5. If the first sentence of a paragraph seems to be a continuation of the previous paragraph, connect them appropriately
6. Remove obvious duplicate text that appears to be OCR errors
7. Label the section headers with [NEW_SECTION_HEADER] at the start of the line

CRITICAL RULES:
- Do NOT add section headers, titles, or formatting that wasn't in the original
- Do NOT remove sentences just because they are capitalized or look like titles
- Preserve the original paragraph breaks and structure
- Keep the same language as the original
- Maintain any important formatting like bullet points or numbered lists
- If text appears garbled and unrecoverable, leave it as is rather than removing it

Return ONLY the cleaned text with the same content and structure as the original, no explanations or additional commentary.`;

class TextCleanupProcessor {
    constructor() {
        // FIXED: Correct directory flow - pdf_output → text_output (which is text_to_json_input)
        this.inputDir = config.directories.pdf_output;   // "../corpus_items/pdf_to_text_output"
        this.outputDir = config.directories.text_output; // "../corpus_items/text_to_json_input"
        this.processingConfig = config.processing.text_cleanup;
    }

    // Process a single text file with comprehensive timing
    async processTextFile(filePath) {
        const fileName = path.basename(filePath, '.txt');
        const outputPath = path.join(this.outputDir, `${fileName}.txt`);
        
        const timer = timingUtils.createTimer(`Cleaning ${fileName}`);
        timer.logStatus('Starting text cleanup...');

        try {
            // Read the input file
            const inputText = fileUtils.readFileWithErrorHandling(filePath);
            
            if (!inputText.trim()) {
                console.log(`  File is empty: ${fileName}.txt`);
                fileUtils.writeFileWithErrorHandling(outputPath, '');
                timer.stop('Completed (empty file)');
                return {
                    success: true,
                    fileName,
                    originalLength: 0,
                    cleanedLength: 0,
                    reduction: 0,
                    chunks: 0,
                    timing: timer.stop()
                };
            }

            timer.checkpoint(`File loaded: ${inputText.length} characters`);

            // Preprocess text
            const preprocessedText = textUtils.preprocessText(inputText);
            const preprocessedText2 = textUtils.replaceCurlyQuotes(preprocessedText);
            
            timer.checkpoint('Text preprocessing completed');

            // Process text through DeepSeek API in chunks
            console.log(`  Processing ${fileName}.txt through DeepSeek API...`);
            console.log(`  Original length: ${inputText.length} characters`);
            console.log(`  Max chunk size: ${this.processingConfig.max_chunk_size} characters`);

            const cleanedText = await apiUtils.processTextInChunks(
                preprocessedText2,
                SYSTEM_PROMPT,
                {
                    chunkSize: this.processingConfig.max_chunk_size,
                    delay: this.processingConfig.api_delay_ms,
                    maxTokens: this.processingConfig.max_tokens,
                    temperature: this.processingConfig.temperature,
                    taskName: `Cleaning ${fileName}`
                }
            );

            timer.checkpoint('API processing completed');

            // Final text processing
            const finalCleanedText = textUtils.preprocessText(cleanedText);
            
            // Write the cleaned text to output file
            fileUtils.writeFileWithErrorHandling(outputPath, finalCleanedText.trim() + '\n');
            
            timer.checkpoint('Output file saved');

            // Calculate and log statistics
            const originalLength = inputText.length;
            const cleanedLength = finalCleanedText.length;
            const reduction = originalLength > 0 ? ((originalLength - cleanedLength) / originalLength * 100) : 0;
            const wordCountOriginal = textUtils.getWordCount(inputText);
            const wordCountCleaned = textUtils.getWordCount(finalCleanedText);

            const finalSummary = timer.stop('Cleanup completed successfully');

            console.log('\n' + '='.repeat(60));
            console.log(`CLEANUP COMPLETE: ${fileName}`);
            console.log('='.repeat(60));
            console.log(`Original: ${originalLength.toLocaleString()} chars, ${wordCountOriginal.toLocaleString()} words`);
            console.log(`Cleaned: ${cleanedLength.toLocaleString()} chars, ${wordCountCleaned.toLocaleString()} words`);
            console.log(`Reduction: ${reduction.toFixed(1)}%`);
            console.log(`Processing Time: ${finalSummary.formattedTotal}`);
            console.log(`Output File: ${path.basename(outputPath)}`);
            console.log('='.repeat(60));

            return {
                success: true,
                fileName,
                originalLength,
                cleanedLength,
                reduction: reduction.toFixed(1),
                wordCountOriginal,
                wordCountCleaned,
                outputPath,
                timing: finalSummary
            };

        } catch (error) {
            timer.stop(`Processing failed: ${error.message}`);
            console.error(`\nError processing ${fileName}: ${error.message}`);
            
            // Provide helpful error guidance
            if (error.message.includes('API Error')) {
                console.error(`💡 Check your DeepSeek API key in api-config.js`);
            } else if (error.message.includes('File not found')) {
                console.error(`💡 Ensure the file exists in: ${this.inputDir}`);
            } else if (error.message.includes('timeout')) {
                console.error(`💡 Try reducing max_chunk_size in config.json`);
            }
            
            return {
                success: false,
                fileName,
                error: error.message,
                timing: timer.stop()
            };
        }
    }

    // Process all text files in the input directory
    async processAllTextFiles() {
        console.log('='.repeat(80));
        console.log('OCR TEXT CLEANUP WITH DEEPSEEK AI - ENHANCED WITH TIMING & PROGRESS TRACKING');
        console.log('='.repeat(80));

        // Print current configuration
        console.log('Current Configuration:');
        console.log(`  Domain: ${config.domain}`);
        console.log(`  Language: ${config.getFullLanguageCode()}`);
        console.log(`  API Language Code: ${config.currentApiLanguage}`);
        console.log(`  DeepSeek Model: ${config.deepseekApiConfig.model}`);
        console.log(`  Max Chunk Size: ${this.processingConfig.max_chunk_size} chars`);
        console.log(`  API Delay: ${this.processingConfig.api_delay_ms}ms`);
        console.log(`  Temperature: ${this.processingConfig.temperature}`);

        if (!fs.existsSync(this.inputDir)) {
            console.error(`\nInput folder '${this.inputDir}' not found.`);
            console.log('Please run the PDF to text conversion first.');
            console.log(`Expected path: ${this.inputDir}`);
            return;
        }

        const textFiles = fileUtils.getFilesWithExtension(this.inputDir, '.txt');

        if (textFiles.length === 0) {
            console.log(`\nNo text files found in '${this.inputDir}'.`);
            console.log('Please run the PDF to text conversion first.');
            return;
        }

        console.log(`\nFound ${textFiles.length} text file(s) to process:`);
        textFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.sizeKB} KB)`);
        });

        console.log(`\nProcessing Configuration:`);
        console.log(`  Input Directory: ${this.inputDir}`);
        console.log(`  Output Directory: ${this.outputDir}`);
        console.log(`  Max Tokens: ${this.processingConfig.max_tokens}`);
        console.log(`  Request Timeout: ${this.processingConfig.request_timeout_ms}ms`);

        const batchTimer = timingUtils.createTimer('Batch Text Cleanup');
        const progressTracker = timingUtils.createProgressTracker(textFiles.length, 'Text Cleanup');
        const results = [];

        console.log('\n' + '='.repeat(60));
        console.log('STARTING BATCH CLEANUP PROCESSING...');
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
        const batchSummary = batchTimer.stop('Batch cleanup completed');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log('\n' + '='.repeat(80));
        console.log('BATCH CLEANUP PROCESSING COMPLETE!');
        console.log('='.repeat(80));
        console.log(`Total Files: ${textFiles.length}`);
        console.log(`Successful: ${successful.length}`);
        if (failed.length > 0) {
            console.log(`Failed: ${failed.length}`);
        }

        if (successful.length > 0) {
            const totalOriginalChars = successful.reduce((sum, r) => sum + (r.originalLength || 0), 0);
            const totalCleanedChars = successful.reduce((sum, r) => sum + (r.cleanedLength || 0), 0);
            const avgReduction = successful.reduce((sum, r) => sum + parseFloat(r.reduction || 0), 0) / successful.length;
            
            console.log(`Total Characters Processed: ${totalOriginalChars.toLocaleString()}`);
            console.log(`Total Characters Output: ${totalCleanedChars.toLocaleString()}`);
            console.log(`Average Reduction: ${avgReduction.toFixed(1)}%`);
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
    const processor = new TextCleanupProcessor();
    
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
                console.log(`  💡 Run 'node pdfToText.js' first to convert PDFs to text`);
            }
            process.exit(1);
        } else {
            console.log(`Processing single file: ${path.basename(singlePath)}`);
            const result = await processor.processTextFile(singlePath);
            
            if (result.success) {
                console.log(`\n✅ Successfully cleaned: ${result.fileName}`);
                console.log(`   Processing time: ${result.timing.formattedTotal}`);
                console.log(`   Character reduction: ${result.reduction}%`);
            } else {
                console.log(`\n❌ Failed to clean: ${result.fileName}`);
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
    TextCleanupProcessor,
    main,
    SYSTEM_PROMPT
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
        }
        
        process.exit(1);
    });
}