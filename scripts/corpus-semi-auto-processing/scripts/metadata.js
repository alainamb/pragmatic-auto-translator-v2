// metadata.js - Refactored to use centralized config and utilities
// Originally written by Abdurrahman Alyajouri

const fs = require('fs');
const path = require('path');

// Import centralized utilities and configuration
// Check if we're in the scripts directory or root directory
const isInScriptsDir = path.basename(__dirname) === 'scripts';
const scriptsPath = isInScriptsDir ? './' : './scripts/';

// Import with correct paths
const config = require(scriptsPath + 'config');
const { fileUtils, textUtils } = require(scriptsPath + 'utils_corpus');
const { timingUtils } = require(scriptsPath + 'utils_timing');
const metadataUtils = require(scriptsPath + 'utils_metadata');

// Ensure all required directories exist
config.ensureDirectories();

class MetadataProcessor {
    constructor() {
        // Use centralized configuration
        this.inputDir = config.directories.metadata_input;   // "../corpus_items/text_to_json_input"
        this.outputDir = config.directories.metadata_output; // "../corpus_items/text_to_metadata_output"
        this.processingConfig = config.processing.metadata;
    }

    // Process a single text file to generate metadata
    async processTextFile(filePath) {
        const fileName = path.basename(filePath, '.txt');
        
        const timer = timingUtils.createTimer(`Generating metadata for ${fileName}`);
        timer.logStatus('Starting metadata generation...');

        try {
            // Read and prepare text content
            const fullText = fileUtils.readFileWithErrorHandling(filePath);
            
            if (!fullText.trim()) {
                console.log(`  File is empty: ${fileName}.txt`);
                // Create minimal metadata for empty file
                const emptyMetadata = this.createMinimalMetadata(fileName, 0);
                const outputPath = path.join(this.outputDir, `${fileName}_metadata.json`);
                fileUtils.writeFileWithErrorHandling(outputPath, JSON.stringify(emptyMetadata, null, 2));
                timer.stop('Completed (empty file)');
                return {
                    success: true,
                    fileName,
                    outputPath,
                    timing: timer.stop()
                };
            }

            timer.checkpoint(`File loaded: ${fullText.length} characters`);

            // Get limited text for metadata inference (from config)
            const words = fullText.split(/\s+/);
            const maxWords = this.processingConfig.max_words_to_read;
            const limitedText = words.slice(0, maxWords).join(' ');
            const totalWordCount = words.length;
            
            console.log(`  Processing ${fileName}.txt for metadata inference...`);
            console.log(`  Total words: ${totalWordCount.toLocaleString()}`);
            console.log(`  Words for inference: ${Math.min(maxWords, totalWordCount).toLocaleString()}`);

            timer.checkpoint('Text preparation completed');

            // Initialize metadata with defaults from config
            let documentMetadata = { ...metadataUtils.documentMetadataNull };
            let inferredMetadata = null;

            // Try to infer metadata using AI
            try {
                console.log(`  Calling DeepSeek API for metadata inference...`);
                inferredMetadata = await metadataUtils.inferDocumentMetadata(limitedText);
                
                console.log(`  Inference complete, validating results...`);
                const validationReport = metadataUtils.isValidDocumentMetadata(inferredMetadata);
                
                if (validationReport.valid) {
                    documentMetadata = inferredMetadata;
                    console.log(`  ✅ All metadata fields validated successfully`);
                } else {
                    console.log(`  ⚠️ Some metadata fields failed validation, using partial results`);
                    // Use only the fields that passed validation
                    validationReport.passedKeys.forEach((key) => {
                        documentMetadata[key] = inferredMetadata[key];
                    });
                }

                // Clean up the metadata
                metadataUtils.cleanupDocumentMetadata(documentMetadata);
                
                timer.checkpoint('Metadata inference and validation completed');

            } catch (error) {
                console.error(`  Error during metadata inference: ${error.message}`);
                console.log(`  Using default metadata structure`);
                documentMetadata = { ...metadataUtils.documentMetadataNull };
            }

            // Override with configuration values
            documentMetadata.domain = config.domain;
            documentMetadata.language_family = config.language.family;
            documentMetadata.language_variant = config.language.variant;

            timer.checkpoint('Configuration overrides applied');

            // Generate processing metadata
            const processingMetadata = metadataUtils.generateProcessingMetadata(
                `${fileName}.txt`,
                totalWordCount,
                `${config.domain}/${config.language.family}/submissions/${fileName}.txt`,
                `${config.domain}/${config.language.family}/processed/${fileName}.json`
            );

            // Construct final metadata entry
            const finalMetadata = {
                ...metadataUtils.documentEntryTemplate,
                document_metadata: documentMetadata,
                processing_metadata: processingMetadata
            };

            // Save metadata to output file
            const outputPath = path.join(this.outputDir, `${fileName}_metadata.json`);
            fileUtils.writeFileWithErrorHandling(outputPath, JSON.stringify(finalMetadata, null, 2));

            timer.checkpoint('Output file saved');

            const finalSummary = timer.stop('Metadata generation completed successfully');

            console.log('\n' + '='.repeat(60));
            console.log(`METADATA GENERATION COMPLETE: ${fileName}`);
            console.log('='.repeat(60));
            console.log(`Document: ${fileName}.txt`);
            console.log(`Domain: ${documentMetadata.domain}`);
            console.log(`Language: ${documentMetadata.language_family}-${documentMetadata.language_variant}`);
            console.log(`Word Count: ${totalWordCount.toLocaleString()}`);
            console.log(`Title: ${documentMetadata.title || 'Not inferred'}`);
            console.log(`Text Type: ${documentMetadata.text_type || 'Not inferred'}`);
            console.log(`Topics: ${documentMetadata.topics.length} identified`);
            console.log(`Processing Time: ${finalSummary.formattedTotal}`);
            console.log(`Output File: ${path.basename(outputPath)}`);
            console.log('='.repeat(60));

            return {
                success: true,
                fileName,
                documentMetadata,
                processingMetadata,
                totalWordCount,
                outputPath,
                timing: finalSummary
            };

        } catch (error) {
            timer.stop(`Processing failed: ${error.message}`);
            console.error(`\nError processing ${fileName}: ${error.message}`);
            
            // Provide helpful error guidance
            if (error.message.includes('API')) {
                console.error(`💡 Check your DeepSeek API key in api-config.js`);
            } else if (error.message.includes('File not found')) {
                console.error(`💡 Ensure the file exists in: ${this.inputDir}`);
            }
            
            return {
                success: false,
                fileName,
                error: error.message,
                timing: timer.stop()
            };
        }
    }

    // Create minimal metadata for empty or failed files
    createMinimalMetadata(fileName, wordCount) {
        const documentMetadata = {
            ...metadataUtils.documentMetadataNull,
            domain: config.domain,
            language_family: config.language.family,
            language_variant: config.language.variant
        };

        const processingMetadata = metadataUtils.generateProcessingMetadata(
            `${fileName}.txt`,
            wordCount,
            `${config.domain}/${config.language.family}/submissions/${fileName}.txt`,
            `${config.domain}/${config.language.family}/processed/${fileName}.json`
        );

        return {
            ...metadataUtils.documentEntryTemplate,
            document_metadata: documentMetadata,
            processing_metadata: processingMetadata
        };
    }

    // Process all text files in the input directory
    async processAllTextFiles() {
        console.log('='.repeat(80));
        console.log('METADATA GENERATOR - ENHANCED WITH CENTRALIZED CONFIG & TIMING');
        console.log('='.repeat(80));

        // Print current configuration
        console.log('Current Configuration:');
        console.log(`  Domain: ${config.domain}`);
        console.log(`  Language: ${config.getFullLanguageCode()}`);
        console.log(`  Max Words for Inference: ${this.processingConfig.max_words_to_read}`);
        console.log(`  Max Topics: ${this.processingConfig.max_topics}`);
        console.log(`  DeepSeek Model: ${config.deepseekApiConfig.model}`);

        if (!fs.existsSync(this.inputDir)) {
            console.error(`\nInput folder '${this.inputDir}' not found.`);
            console.log('Please run text processing first.');
            console.log(`Expected path: ${this.inputDir}`);
            return;
        }

        const textFiles = fileUtils.getFilesWithExtension(this.inputDir, '.txt');

        if (textFiles.length === 0) {
            console.log(`\nNo text files found in '${this.inputDir}'.`);
            console.log('Please run text processing first.');
            return;
        }

        console.log(`\nFound ${textFiles.length} text file(s) to process:`);
        textFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.sizeKB} KB)`);
        });

        console.log(`\nProcessing Configuration:`);
        console.log(`  Input Directory: ${this.inputDir}`);
        console.log(`  Output Directory: ${this.outputDir}`);

        const batchTimer = timingUtils.createTimer('Batch Metadata Generation');
        const progressTracker = timingUtils.createProgressTracker(textFiles.length, 'Metadata Generation');
        const results = [];

        console.log('\n' + '='.repeat(60));
        console.log('STARTING BATCH METADATA GENERATION...');
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
            
            // Brief pause between files for API rate limiting
            if (i < textFiles.length - 1) {
                await timingUtils.sleep(1000, 'Brief pause between files');
            }
        }

        // Final batch summary
        const batchSummary = batchTimer.stop('Batch metadata generation completed');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log('\n' + '='.repeat(80));
        console.log('BATCH METADATA GENERATION COMPLETE!');
        console.log('='.repeat(80));
        console.log(`Total Files: ${textFiles.length}`);
        console.log(`Successful: ${successful.length}`);
        if (failed.length > 0) {
            console.log(`Failed: ${failed.length}`);
        }

        if (successful.length > 0) {
            const totalWords = successful.reduce((sum, r) => sum + (r.totalWordCount || 0), 0);
            console.log(`Total Words Processed: ${totalWords.toLocaleString()}`);
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
    const processor = new MetadataProcessor();
    
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
                console.log(`  💡 Run the text processing pipeline first`);
            }
            process.exit(1);
        } else {
            console.log(`Processing single file: ${path.basename(singlePath)}`);
            const result = await processor.processTextFile(singlePath);
            
            if (result.success) {
                console.log(`\n✅ Successfully generated metadata: ${result.fileName}`);
                console.log(`   Processing time: ${result.timing.formattedTotal}`);
                console.log(`   Word count: ${result.totalWordCount?.toLocaleString() || 'N/A'}`);
            } else {
                console.log(`\n❌ Failed to generate metadata: ${result.fileName}`);
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
    MetadataProcessor,
    main
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