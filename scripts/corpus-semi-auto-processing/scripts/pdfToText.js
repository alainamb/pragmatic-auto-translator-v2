// pdfToText.js - Refactored to use centralized config and utilities
// Originally written by Evelyn Johnson

const fs = require('fs');
const path = require('path');
const poppler = require('pdf-poppler');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

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

class PDFProcessor {
    constructor() {
        this.inputDir = config.directories.pdf_input;
        this.outputDir = config.directories.pdf_output;
        this.tempDir = config.directories.temp_images;
        this.processingConfig = config.processing.pdf_to_text;
    }

    // Enhanced OCR with provider selection (respects config.json language overrides)
    async performOCR(imagePath, pageNumber, ocrProvider = null) {
        // Get OCR provider from centralized config (respects language overrides)
        const provider = ocrProvider || config.getOcrProvider();
        
        // Correct language code construction
        const fullLangCode = config.getFullLanguageCode(); // "zho-chn"
        const ocrLanguageCode = config.currentOcrLanguage; // "chi_sim"
        
        console.log(`    OCR Provider: ${provider.provider} (${provider.reason})`);
        console.log(`    Language: ${fullLangCode} → OCR Code: ${ocrLanguageCode}`);

        try {
            if (!fs.existsSync(imagePath)) {
                console.error(`    Image not found: ${imagePath}`);
                return { text: '', confidence: 0, wordCount: 0 };
            }

            let result;

            // Use Google Vision for enhanced OCR (especially Chinese per config.json)
            if (provider.provider === 'google_vision') {
                try {
                    console.log(`    🔍 Using Google Vision API for superior accuracy...`);
                    result = await apiUtils.callGoogleVisionOCR(imagePath, {
                        languageHints: [config.currentApiLanguage]
                    });
                    console.log(`    Google Vision OCR - Confidence: ${result.confidence}%`);
                    return {
                        text: this.postProcessText(result.text),
                        confidence: result.confidence,
                        wordCount: result.wordCount
                    };
                } catch (error) {
                    console.warn(`    Google Vision failed: ${error.message}`);
                    
                    // FIXED: Check for configured fallback provider
                    const langOverrides = config.ocrServices.language_overrides;
                    const override = langOverrides[fullLangCode] || langOverrides[config.language.family];
                    
                    if (override && override.fallback_provider) {
                        const fallbackProvider = override.fallback_provider;
                        
                        if (config.ocrServices.providers[fallbackProvider]?.enabled) {
                            console.log(`    🔄 Trying configured fallback provider: ${fallbackProvider}`);
                            
                            // Handle PaddleOCR fallback (would need implementation)
                            if (fallbackProvider === 'paddle_ocr') {
                                console.log(`    📋 PaddleOCR fallback not yet implemented`);
                                // TODO: Implement PaddleOCR fallback
                            }
                        }
                    }
                    
                    // Check if Tesseract is disabled for this language
                    const tesseractDisabled = override?.tesseract_disabled;
                    if (tesseractDisabled) {
                        console.error(`    ❌ Tesseract disabled for ${fullLangCode}. Google Vision required but failed.`);
                        console.error(`    💡 Please check your Google Vision API configuration in api-config.js`);
                        throw new Error(`Primary OCR provider failed and Tesseract is disabled for ${fullLangCode}`);
                    }
                    
                    console.log(`    🔄 Falling back to Tesseract...`);
                    // Fall through to Tesseract if not disabled
                }
            }

            // Tesseract OCR (fallback, unless disabled per config)
            const langOverrides = config.ocrServices.language_overrides;
            const override = langOverrides[fullLangCode] || langOverrides[config.language.family];
            const tesseractDisabled = override?.tesseract_disabled;
            
            if (tesseractDisabled) {
                throw new Error(`Tesseract is disabled for ${fullLangCode} per configuration. Primary OCR provider must be available.`);
            }

            console.log(`    📖 Using Tesseract OCR...`);
            const processedPath = await this.preprocessImage(imagePath);
            
            // Configure Tesseract with proper language codes and data path
            const tesseractConfig = {
                lang: ocrLanguageCode, // Use the correct OCR language code
                oem: config.ocrServices.providers.tesseract.config.oem,
                psm: config.ocrServices.providers.tesseract.config.psm,
                preserve_interword_spaces: config.ocrServices.providers.tesseract.config.preserve_interword_spaces,
                user_defined_dpi: config.ocrServices.providers.tesseract.config.user_defined_dpi,
            };

            // Set Tesseract to use root directory for traineddata files
            const rootDir = path.resolve(__dirname, '..');
            
            const tesseractResult = await Tesseract.recognize(
                processedPath,
                tesseractConfig.lang,
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            process.stdout.write(`\r    OCR Progress: ${Math.round(m.progress * 100)}%`);
                        }
                    },
                    cachePath: rootDir, // Store traineddata files in root directory
                    ...tesseractConfig
                }
            );

            process.stdout.write('\n');
            const { data: { text, confidence, words } } = tesseractResult;
            const cleanedText = this.postProcessText(text);
            const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

            // Cleanup processed image if different from original
            if (processedPath !== imagePath) {
                try {
                    fs.unlinkSync(processedPath);
                } catch (err) {
                    console.warn(`    Warning: Could not cleanup processed image: ${err.message}`);
                }
            }

            return { text: cleanedText, confidence, wordCount };

        } catch (error) {
            console.error(`    OCR failed on page ${pageNumber}: ${error.message}`);
            
            // Provide helpful guidance based on language and provider
            const fullLangCode = config.getFullLanguageCode();
            if (fullLangCode.startsWith('zho')) {
                console.error(`    💡 For Chinese text, Google Vision API is recommended.`);
                console.error(`    Please ensure Google Vision API is properly configured in api-config.js`);
                
                // Check specific Google Vision configuration issues
                const gvCredentials = config.getOcrApiCredentials('google_vision');
                if (!gvCredentials.service_account_key_path && !gvCredentials.api_key) {
                    console.error(`    ⚠️  No Google Vision credentials found in api-config.js`);
                    console.error(`    Add either 'service_account_key_path' or 'api_key' to ocr_services.google_vision`);
                }
            }
            
            return { text: '', confidence: 0, wordCount: 0 };
        }
    }

    // Preprocess image for better OCR results
    async preprocessImage(imagePath) {
        try {
            const processedPath = imagePath.replace('.png', '_processed.png');
            await sharp(imagePath)
                .resize({ width: this.processingConfig.image_width })
                .grayscale()
                .threshold(this.processingConfig.threshold)
                .sharpen()
                .png({ quality: 100 })
                .toFile(processedPath);
            return processedPath;
        } catch (error) {
            console.warn(`    Image preprocessing failed: ${error.message}, using original`);
            return imagePath;
        }
    }

    // Enhanced text post-processing with better structure detection
    postProcessText(text) {
        if (!text) return '';

        const lines = text
            .replace(/\r/g, '')
            .split('\n')
            .map(line => line.trimEnd());

        let result = '';
        let currentParagraph = '';

        for (let i = 0; i < lines.length; i++) {
            const current = lines[i];
            const next = lines[i + 1] || '';
            const previous = lines[i - 1] || '';
            const isEmpty = current.trim() === '';

            // Handle empty lines
            if (isEmpty) {
                if (currentParagraph.trim()) {
                    result += currentParagraph.trim() + '\n\n';
                    currentParagraph = '';
                }
                continue;
            }

            if (this.isRepeatingLine(current, previous, next)) continue;

            // Check if this line should be treated as a title/header
            if (this.isLikelyTitle(current, next, previous)) {
                // Finish current paragraph if exists
                if (currentParagraph.trim()) {
                    result += currentParagraph.trim() + '\n\n';
                    currentParagraph = '';
                }
                // Add title with extra spacing
                result += current.trim() + '\n\n';
                continue;
            }

            // Check if this line should join with previous
            if (this.shouldJoinWithPrevious(current, currentParagraph)) {
                currentParagraph += (currentParagraph ? ' ' : '') + current.trim();
            } else {
                // Start new paragraph
                if (currentParagraph.trim()) {
                    result += currentParagraph.trim() + '\n\n';
                }
                currentParagraph = current.trim();
            }

            // Check if this line completes a paragraph
            const endsWithSentence = /[.!?]["']?$/.test(current.trim()) && !/\b(e\.g|i\.e|etc)\.$/i.test(current.trim());
            const nextIsEmpty = !next.trim();
            const nextIsTitle = this.isLikelyTitle(next, lines[i + 2] || '', current);
            const nextStartsNewSentence = /^[A-Z(]/.test(next.trim());

            if (endsWithSentence && (nextIsEmpty || nextIsTitle ||
                (nextStartsNewSentence && !this.shouldJoinWithPrevious(next, currentParagraph)))) {
                if (currentParagraph.trim()) {
                    result += currentParagraph.trim() + '\n\n';
                    currentParagraph = '';
                }
            }
        }

        // Add any remaining paragraph
        if (currentParagraph.trim()) {
            result += currentParagraph.trim();
        }

        return result.trim();
    }

    // Helper methods for text structure detection
    isLikelyTitle(line, nextLine = '', prevLine = '') {
        const trimmed = line.trim();
        if (!trimmed) return false;

        const titlePatterns = [
            /^(CHAPTER|Chapter|Section|SECTION)\s+\d+/i,
            /^(Abstract|Introduction|Conclusion|Summary|References|Bibliography|Appendix)/i,
            /^[A-Z][A-Z\s]{3,}$/,
            /^\d+\.\s+[A-Z]/,
            /^[A-Z][^.!?]*[^.!?]$/,
            /^(I|II|III|IV|V|VI|VII|VIII|IX|X)[.)]\s+[A-Z]/i,
            /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/,
            /^(Appendix|Appendices)\s+[A-Z]/i,
            /^\d+\.\d+\s+[A-Z]/,
            /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/,
            /^([A-Z][a-z]+[\s-])*[A-Z][a-z]+$/,
        ];

        const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 2;
        const isShort = trimmed.length < 60;
        const hasNoEndPunctuation = !/[.!?]$/.test(trimmed);
        const nextLineStartsCapital = /^[A-Z]/.test(nextLine.trim());

        if (titlePatterns.some(pattern => pattern.test(trimmed))) return true;

        if (isShort && hasNoEndPunctuation && (nextLineStartsCapital || !nextLine.trim())) {
            return true;
        }

        if (isAllCaps && isShort) return true;

        return false;
    }

    isRepeatingLine(line, prevLine, nextLine) {
        const footerOrHeaderPatterns = [
            /^\d+$/,
            /^Page\s+\d+/i,
            /^[A-Z ]{10,}$/,
        ];
        return footerOrHeaderPatterns.some(p => p.test(line.trim()));
    }

    isLikelyListItem(line) {
        const trimmed = line.trim();
        return /^[\-•*]\s+/.test(trimmed) ||
            /^\d+\.\s+/.test(trimmed) ||
            /^[a-zA-Z]\.\s+/.test(trimmed) ||
            /^\([a-zA-Z0-9]+\)\s+/.test(trimmed);
    }

    shouldJoinWithPrevious(currentLine, previousLine) {
        if (!previousLine || !currentLine) return false;

        const prevTrimmed = previousLine.trim();
        const currTrimmed = currentLine.trim();

        if (!prevTrimmed || !currTrimmed) return false;

        if (this.isLikelyTitle(currTrimmed)) return false;
        if (this.isLikelyListItem(currTrimmed)) return false;

        const prevEndsWithSentence = /[.!?]["']?$/.test(prevTrimmed);
        const currStartsWithCapital = /^[A-Z]/.test(currTrimmed);
        const currStartsWithParen = /^\(/.test(currTrimmed);
        const prevEndsWithColon = /[:：]$/.test(prevTrimmed);
        const prevEndsWithAbbrev = /\b(e\.g|i\.e|etc)\.$/i.test(prevTrimmed);

        if (prevEndsWithColon) return true;
        if (currStartsWithParen) return true;
        if (prevEndsWithAbbrev) return true;
        if (!prevEndsWithSentence && !currStartsWithCapital) return true;
        if (/[,\-—–]$/.test(prevTrimmed)) return true;

        if (prevTrimmed.length < 40 && !prevEndsWithSentence && currStartsWithCapital) {
            return true;
        }

        return false;
    }

    // Convert PDF to images using poppler with Unicode filename support
    async pdfToImages(pdfPath, outputDir) {
        console.log(`    Converting PDF to images: ${path.basename(pdfPath)}`);
        
        // Encode the path properly for cross-platform Unicode support
        const normalizedPdfPath = Buffer.from(pdfPath, 'utf8').toString();
        const normalizedOutputDir = Buffer.from(outputDir, 'utf8').toString();
        
        const options = {
            format: 'png',
            out_dir: normalizedOutputDir,
            out_prefix: 'page',
            dpi: this.processingConfig.dpi,
            use_pdftocairo: true,
        };

        try {
            // Check if PDF file actually exists and is readable
            const stats = fs.statSync(pdfPath);
            console.log(`    PDF file size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
            
            // Use the original path with proper encoding
            await poppler.convert(pdfPath, options);
            
            const imageFiles = fs.readdirSync(outputDir)
                .filter(file => file.startsWith('page') && file.endsWith('.png'))
                .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
                .map(file => path.join(outputDir, file));
                
            console.log(`    Generated ${imageFiles.length} page images`);
            return imageFiles;
            
        } catch (error) {
            console.error(`    PDF conversion failed: ${error.message}`);
            
            // Provide specific guidance based on error type
            if (error.message.includes('No such file')) {
                console.error(`    File not found. Check path: ${pdfPath}`);
                console.error(`    Working directory: ${process.cwd()}`);
            } else if (error.message.includes('Command failed')) {
                console.error(`    pdf-poppler command failed. Possible causes:`);
                console.error(`    1. PDF file may be corrupted or protected`);
                console.error(`    2. Missing poppler-utils installation`);
                console.error(`    3. Insufficient disk space for image conversion`);
                if (path.basename(pdfPath).match(/[\u4e00-\u9fff]/)) {
                    console.error(`    🔍 Note: Chinese filename detected - trying Unicode handling...`);
                }
            }
            
            throw error;
        }
    }

    // Process a single PDF with comprehensive timing
    async processPDF(pdfPath) {
        const pdfName = path.basename(pdfPath, '.pdf');
        const outputTextPath = path.join(this.outputDir, `${pdfName}.txt`);
        const tempDir = path.join(this.tempDir, pdfName);

        // Create temp directory
        fileUtils.ensureDir(tempDir);

        const timer = timingUtils.createTimer(`Processing ${pdfName}`);
        timer.logStatus('Converting PDF to images...');

        try {
            // Convert PDF to images
            const imageFiles = await this.pdfToImages(pdfPath, tempDir);
            if (imageFiles.length === 0) {
                throw new Error(`No images generated from ${pdfPath}`);
            }

            timer.checkpoint(`Images generated: ${imageFiles.length} pages`);

            // Process each page with progress tracking
            const progressTracker = timingUtils.createProgressTracker(
                imageFiles.length, 
                `OCR Processing: ${pdfName}`
            );

            let fullText = '';
            let totalConfidence = 0;
            let totalWords = 0;
            let successfulPages = 0;

            // Show correct language information
            const fullLangCode = config.getFullLanguageCode();
            const ocrLangCode = config.currentOcrLanguage;

            console.log('\n' + '='.repeat(60));
            console.log(`Processing Document: ${pdfName}`);
            console.log(`Total Pages: ${imageFiles.length}`);
            console.log(`Language: ${fullLangCode}`);
            console.log(`OCR Language Code: ${ocrLangCode}`);
            
            // Show OCR provider selection
            try {
                const ocrProvider = config.getOcrProvider();
                console.log(`OCR Provider: ${ocrProvider.provider} (${ocrProvider.reason})`);
            } catch (error) {
                console.log(`OCR Provider: Configuration error - ${error.message}`);
            }
            
            console.log('='.repeat(60));

            for (let i = 0; i < imageFiles.length; i++) {
                const page = i + 1;
                progressTracker.startItem(`Page ${page}`, i);

                try {
                    const result = await this.performOCR(imageFiles[i], page);
                    
                    if (result.confidence > 0) {
                        totalConfidence += result.confidence;
                        totalWords += result.wordCount;
                        successfulPages++;
                    }

                    if (result.text) {
                        fullText += result.text + '\n\n';
                        progressTracker.completeItem(true);
                    } else {
                        console.warn(`      No text found on page ${page}`);
                        progressTracker.completeItem(true); // Still successful, just no text
                    }
                } catch (error) {
                    console.error(`      Error processing page ${page}: ${error.message}`);
                    progressTracker.completeItem(false, error);
                }
            }

            // Calculate final statistics
            const avgConfidence = successfulPages > 0 ? Math.round(totalConfidence / successfulPages) : 0;
            
            // Save the processed text
            fileUtils.writeFileWithErrorHandling(outputTextPath, fullText.trim() + '\n');

            timer.checkpoint('OCR processing completed');

            // Log final results
            const progressSummary = progressTracker.logSummary();
            
            console.log('\n' + '='.repeat(60));
            console.log(`PROCESSING COMPLETE: ${pdfName}`);
            console.log('='.repeat(60));
            console.log(`Pages Processed: ${imageFiles.length}`);
            console.log(`Successful Pages: ${successfulPages}`);
            console.log(`Total Words: ${totalWords.toLocaleString()}`);
            console.log(`Average Confidence: ${avgConfidence}%`);
            console.log(`Output File: ${path.basename(outputTextPath)}`);
            
            const finalSummary = timer.stop('Processing completed successfully');
            console.log(`Total Processing Time: ${finalSummary.formattedTotal}`);
            console.log('='.repeat(60));

            return {
                success: true,
                pdfName,
                pages: imageFiles.length,
                words: totalWords,
                confidence: avgConfidence,
                outputPath: outputTextPath,
                timing: finalSummary
            };

        } catch (error) {
            timer.stop(`Processing failed: ${error.message}`);
            console.error(`\nError processing ${pdfName}: ${error.message}`);
            return {
                success: false,
                pdfName,
                error: error.message,
                timing: timer.stop()
            };
        } finally {
            // Cleanup temporary files
            this.cleanupTempFiles(tempDir);
        }
    }

    // Clean up temporary files with better error handling
    cleanupTempFiles(tempDir) {
        try {
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                let deletedFiles = 0;
                let failedFiles = 0;
                
                files.forEach(file => {
                    try {
                        const filePath = path.join(tempDir, file);
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    } catch (err) {
                        failedFiles++;
                        console.warn(`    Warning: Could not delete ${file}: ${err.message}`);
                    }
                });
                
                // Try to remove the directory
                try {
                    fs.rmdirSync(tempDir);
                    console.log(`    ✅ Cleaned up temporary files: ${path.basename(tempDir)} (${deletedFiles} files)`);
                } catch (err) {
                    console.warn(`    ⚠️ Could not remove temp directory ${path.basename(tempDir)}: ${err.message}`);
                    console.log(`    💡 You can manually delete: ${tempDir}`);
                }
            }
        } catch (err) {
            console.warn(`    ⚠️ Cleanup warning for ${path.basename(tempDir)}: ${err.message}`);
            console.log(`    💡 Processing completed successfully. You can manually delete temp files if needed.`);
        }
    }

    // Process all PDFs in the input directory
    async processAllPDFs() {
        console.log('='.repeat(80));
        console.log('PDF TO TEXT CONVERTER - ENHANCED WITH TIMING & OCR PROVIDER SELECTION');
        console.log('='.repeat(80));

        // Print current configuration with correct language info
        console.log('Current Configuration:');
        console.log(`  Domain: ${config.domain}`);
        console.log(`  Language: ${config.getFullLanguageCode()}`);
        console.log(`  API Language Code: ${config.currentApiLanguage}`);
        console.log(`  OCR Language Code: ${config.currentOcrLanguage}`);
        
        try {
            const ocrProvider = config.getOcrProvider();
            console.log(`  OCR Provider: ${ocrProvider.provider} (${ocrProvider.reason})`);
        } catch (error) {
            console.log(`  OCR Provider: Configuration error - ${error.message}`);
        }

        if (!fs.existsSync(this.inputDir)) {
            console.error(`\nInput folder '${this.inputDir}' not found.`);
            console.log('Please place PDF files in the input folder and try again.');
            return;
        }

        const pdfFiles = fileUtils.getFilesWithExtension(this.inputDir, '.pdf');

        if (pdfFiles.length === 0) {
            console.log(`\nNo PDF files found in '${this.inputDir}'.`);
            return;
        }

        console.log(`\nFound ${pdfFiles.length} PDF file(s) to process:`);
        pdfFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.sizeKB} KB)`);
        });

        console.log(`\nProcessing Configuration:`);
        console.log(`  Input Directory: ${this.inputDir}`);
        console.log(`  Output Directory: ${this.outputDir}`);
        console.log(`  DPI: ${this.processingConfig.dpi}`);
        console.log(`  Image Width: ${this.processingConfig.image_width}px`);
        console.log(`  Threshold: ${this.processingConfig.threshold}`);

        const batchTimer = timingUtils.createTimer('Batch PDF Processing');
        const results = [];

        console.log('\n' + '='.repeat(60));
        console.log('STARTING BATCH PROCESSING...');
        console.log('='.repeat(60));

        for (const pdfFile of pdfFiles) {
            const result = await this.processPDF(pdfFile.path);
            results.push(result);
            
            // Brief pause between files
            if (pdfFiles.indexOf(pdfFile) < pdfFiles.length - 1) {
                await timingUtils.sleep(1000, 'Brief pause between files');
            }
        }

        // Final batch summary
        const batchSummary = batchTimer.stop('Batch processing completed');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log('\n' + '='.repeat(80));
        console.log('BATCH PROCESSING COMPLETE!');
        console.log('='.repeat(80));
        console.log(`Total Files: ${pdfFiles.length}`);
        console.log(`Successful: ${successful.length}`);
        if (failed.length > 0) {
            console.log(`Failed: ${failed.length}`);
        }

        if (successful.length > 0) {
            const totalWords = successful.reduce((sum, r) => sum + (r.words || 0), 0);
            const avgConfidence = successful.reduce((sum, r) => sum + (r.confidence || 0), 0) / successful.length;
            console.log(`Total Words Extracted: ${totalWords.toLocaleString()}`);
            console.log(`Average Confidence: ${Math.round(avgConfidence)}%`);
        }

        console.log(`Total Processing Time: ${batchSummary.formattedTotal}`);
        console.log(`Output Directory: ${this.outputDir}`);

        if (failed.length > 0) {
            console.log(`\nFailed Files:`);
            failed.forEach(result => {
                console.log(`  - ${result.pdfName}: ${result.error}`);
            });
        }

        console.log('='.repeat(80));

        return {
            total: pdfFiles.length,
            successful: successful.length,
            failed: failed.length,
            results,
            timing: batchSummary
        };
    }
}

// Main execution function
async function main() {
    const processor = new PDFProcessor();
    
    // Handle single file processing
    const singleFileArg = process.argv[2];
    if (singleFileArg) {
        const singlePath = path.join(processor.inputDir, singleFileArg);
        if (!fs.existsSync(singlePath)) {
            console.error(`Specified file not found: ${singlePath}`);
            console.log(`Available files in ${processor.inputDir}:`);
            const availableFiles = fileUtils.getFilesWithExtension(processor.inputDir, '.pdf');
            availableFiles.forEach(file => console.log(`  - ${file.name}`));
            process.exit(1);
        } else {
            console.log(`Processing single file: ${singleFileArg}`);
            const result = await processor.processPDF(singlePath);
            process.exit(result.success ? 0 : 1);
        }
    } else {
        // Process all PDFs
        const batchResult = await processor.processAllPDFs();
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
    PDFProcessor,
    main
};

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}