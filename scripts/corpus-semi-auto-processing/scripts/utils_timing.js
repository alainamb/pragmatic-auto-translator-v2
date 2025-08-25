// timing_utils.js - Consistent timing and progress tracking across all scripts

class Timer {
    constructor(taskName = 'Task') {
        this.taskName = taskName;
        this.startTime = Date.now();
        this.checkpoints = [];
        this.isActive = true;
    }

    // Add a checkpoint with optional description
    checkpoint(description = '') {
        if (!this.isActive) return null;
        
        const now = Date.now();
        const elapsed = now - this.startTime;
        const checkpoint = {
            description,
            timestamp: now,
            elapsed,
            formatted: this.formatDuration(elapsed)
        };
        
        this.checkpoints.push(checkpoint);
        return checkpoint;
    }

    // Get elapsed time since start
    getElapsed() {
        if (!this.isActive) return 0;
        return Date.now() - this.startTime;
    }

    // Get formatted elapsed time
    getFormattedElapsed() {
        return this.formatDuration(this.getElapsed());
    }

    // Stop the timer and return final results
    stop(finalDescription = 'Completed') {
        if (!this.isActive) return null;
        
        const finalCheckpoint = this.checkpoint(finalDescription);
        this.isActive = false;
        
        return {
            taskName: this.taskName,
            totalTime: finalCheckpoint.elapsed,
            formattedTotal: finalCheckpoint.formatted,
            checkpoints: this.checkpoints,
            completedAt: new Date(finalCheckpoint.timestamp).toISOString()
        };
    }

    // Format milliseconds into human-readable duration
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        
        if (minutes < 60) {
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${hours}h`;
    }

    // Print current status
    logStatus(message = '') {
        if (!this.isActive) return;
        
        const elapsed = this.getFormattedElapsed();
        const prefix = `[${this.taskName}] ${elapsed}`;
        
        if (message) {
            console.log(`${prefix}: ${message}`);
        } else {
            console.log(`${prefix}`);
        }
    }

    // Print final summary
    logSummary() {
        if (this.isActive) {
            this.stop();
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TIMING SUMMARY: ${this.taskName}`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Total Time: ${this.getFormattedElapsed()}`);
        
        if (this.checkpoints.length > 1) {
            console.log(`\nCheckpoints:`);
            this.checkpoints.forEach((cp, index) => {
                const desc = cp.description || `Step ${index + 1}`;
                console.log(`  ${desc}: ${cp.formatted}`);
            });
        }
        
        console.log(`Completed: ${new Date().toLocaleString()}`);
        console.log(`${'='.repeat(60)}\n`);
    }
}

// Progress tracker for batch operations
class ProgressTracker {
    constructor(totalItems, taskName = 'Processing') {
        this.totalItems = totalItems;
        this.taskName = taskName;
        this.currentItem = 0;
        this.startTime = Date.now();
        this.itemTimes = [];
        this.errors = [];
        this.skipped = [];
    }

    // Start processing an item
    startItem(itemName = '', index = null) {
        this.currentItem = index !== null ? index + 1 : this.currentItem + 1;
        this.currentItemName = itemName;
        this.currentItemStart = Date.now();
        
        const progress = ((this.currentItem - 1) / this.totalItems * 100).toFixed(1);
        console.log(`\n[${this.currentItem}/${this.totalItems}] (${progress}%) ${this.taskName}: ${itemName}`);
    }

    // Complete processing an item
    completeItem(success = true, error = null) {
        if (!this.currentItemStart) return;
        
        const itemTime = Date.now() - this.currentItemStart;
        const itemResult = {
            name: this.currentItemName,
            index: this.currentItem,
            duration: itemTime,
            formatted: new Timer().formatDuration(itemTime),
            success,
            error: error?.message || error
        };
        
        this.itemTimes.push(itemResult);
        
        if (!success) {
            this.errors.push(itemResult);
            console.log(`  ❌ Failed (${itemResult.formatted}): ${error?.message || error}`);
        } else {
            console.log(`  ✅ Completed (${itemResult.formatted})`);
        }
        
        // Show progress and ETA
        this.logProgress();
    }

    // Skip an item
    skipItem(reason = '') {
        const itemResult = {
            name: this.currentItemName,
            index: this.currentItem,
            reason,
            skipped: true
        };
        
        this.skipped.push(itemResult);
        console.log(`  ⏭️ Skipped: ${reason}`);
        this.logProgress();
    }

    // Log current progress with ETA
    logProgress() {
        const completed = this.itemTimes.length + this.skipped.length;
        const remaining = this.totalItems - completed;
        
        if (completed === 0) return;
        
        // Calculate average time per successful item
        const successfulItems = this.itemTimes.filter(item => item.success);
        if (successfulItems.length > 0) {
            const avgTime = successfulItems.reduce((sum, item) => sum + item.duration, 0) / successfulItems.length;
            const etaMs = remaining * avgTime;
            const eta = new Timer().formatDuration(etaMs);
            
            const progress = (completed / this.totalItems * 100).toFixed(1);
            console.log(`  Progress: ${completed}/${this.totalItems} (${progress}%) - ETA: ${eta}`);
        }
    }

    // Get final summary
    getSummary() {
        const totalTime = Date.now() - this.startTime;
        const successful = this.itemTimes.filter(item => item.success).length;
        const failed = this.errors.length;
        const skipped = this.skipped.length;
        
        return {
            taskName: this.taskName,
            totalItems: this.totalItems,
            successful,
            failed,
            skipped,
            totalTime,
            formattedTotal: new Timer().formatDuration(totalTime),
            avgTimePerItem: successful > 0 ? 
                this.itemTimes.filter(item => item.success)
                    .reduce((sum, item) => sum + item.duration, 0) / successful : 0,
            errors: this.errors,
            completedAt: new Date().toISOString()
        };
    }

    // Print final summary
    logSummary() {
        const summary = this.getSummary();
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`PROCESSING SUMMARY: ${summary.taskName}`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Total Items: ${summary.totalItems}`);
        console.log(`Successful: ${summary.successful}`);
        
        if (summary.failed > 0) {
            console.log(`Failed: ${summary.failed}`);
        }
        
        if (summary.skipped > 0) {
            console.log(`Skipped: ${summary.skipped}`);
        }
        
        console.log(`Total Time: ${summary.formattedTotal}`);
        
        if (summary.successful > 0) {
            const avgFormatted = new Timer().formatDuration(summary.avgTimePerItem);
            console.log(`Avg Time/Item: ${avgFormatted}`);
        }
        
        if (summary.errors.length > 0) {
            console.log(`\nErrors:`);
            summary.errors.forEach(error => {
                console.log(`  - ${error.name}: ${error.error}`);
            });
        }
        
        console.log(`Completed: ${new Date(summary.completedAt).toLocaleString()}`);
        console.log(`${'='.repeat(60)}\n`);
        
        return summary;
    }
}

// Chunk processing tracker for API calls
class ChunkTracker {
    constructor(totalChunks, chunkSize, taskName = 'Processing chunks') {
        this.totalChunks = totalChunks;
        this.chunkSize = chunkSize;
        this.taskName = taskName;
        this.currentChunk = 0;
        this.startTime = Date.now();
        this.chunkTimes = [];
        this.apiCalls = 0;
        this.totalCharacters = 0;
        this.errors = [];
    }

    // Start processing a chunk
    startChunk(chunkIndex, chunkLength) {
        this.currentChunk = chunkIndex + 1;
        this.currentChunkStart = Date.now();
        this.totalCharacters += chunkLength;
        
        const progress = (chunkIndex / this.totalChunks * 100).toFixed(1);
        console.log(`    Chunk ${this.currentChunk}/${this.totalChunks} (${progress}%) - ${chunkLength} chars`);
    }

    // Complete processing a chunk
    completeChunk(success = true, apiCallMade = false, error = null) {
        if (!this.currentChunkStart) return;
        
        const chunkTime = Date.now() - this.currentChunkStart;
        if (apiCallMade) this.apiCalls++;
        
        const chunkResult = {
            index: this.currentChunk,
            duration: chunkTime,
            formatted: new Timer().formatDuration(chunkTime),
            success,
            apiCall: apiCallMade,
            error: error?.message || error
        };
        
        this.chunkTimes.push(chunkResult);
        
        if (!success) {
            this.errors.push(chunkResult);
            console.log(`      ❌ Failed (${chunkResult.formatted}): ${error?.message || error}`);
        } else {
            const apiIndicator = apiCallMade ? ' [API]' : '';
            console.log(`      ✅ Completed (${chunkResult.formatted})${apiIndicator}`);
        }
    }

    // Get summary stats
    getSummary() {
        const totalTime = Date.now() - this.startTime;
        const successful = this.chunkTimes.filter(chunk => chunk.success).length;
        const failed = this.errors.length;
        
        return {
            taskName: this.taskName,
            totalChunks: this.totalChunks,
            chunkSize: this.chunkSize,
            successful,
            failed,
            apiCalls: this.apiCalls,
            totalCharacters: this.totalCharacters,
            totalTime,
            formattedTotal: new Timer().formatDuration(totalTime),
            avgTimePerChunk: successful > 0 ? 
                this.chunkTimes.filter(chunk => chunk.success)
                    .reduce((sum, chunk) => sum + chunk.duration, 0) / successful : 0,
            errors: this.errors
        };
    }

    // Print chunk summary
    logSummary() {
        const summary = this.getSummary();
        
        console.log(`\n  Chunk Processing Summary:`);
        console.log(`    Total Chunks: ${summary.totalChunks}`);
        console.log(`    Successful: ${summary.successful}`);
        
        if (summary.failed > 0) {
            console.log(`    Failed: ${summary.failed}`);
        }
        
        console.log(`    API Calls Made: ${summary.apiCalls}`);
        console.log(`    Total Characters: ${summary.totalCharacters.toLocaleString()}`);
        console.log(`    Processing Time: ${summary.formattedTotal}`);
        
        if (summary.successful > 0) {
            const avgFormatted = new Timer().formatDuration(summary.avgTimePerChunk);
            console.log(`    Avg Time/Chunk: ${avgFormatted}`);
        }
        
        return summary;
    }
}

// Utility functions for common timing operations
const timingUtils = {
    // Create a new timer
    createTimer(taskName) {
        return new Timer(taskName);
    },

    // Create a progress tracker
    createProgressTracker(totalItems, taskName) {
        return new ProgressTracker(totalItems, taskName);
    },

    // Create a chunk tracker
    createChunkTracker(totalChunks, chunkSize, taskName) {
        return new ChunkTracker(totalChunks, chunkSize, taskName);
    },

    // Time a function execution
    async timeFunction(fn, taskName = 'Function execution') {
        const timer = new Timer(taskName);
        try {
            const result = await fn();
            const summary = timer.stop();
            return { result, timing: summary };
        } catch (error) {
            timer.stop(`Failed: ${error.message}`);
            throw error;
        }
    },

    // Format duration (standalone function)
    formatDuration(ms) {
        return new Timer().formatDuration(ms);
    },

    // Sleep function with timing
    async sleep(ms, logMessage = '') {
        if (logMessage) {
            console.log(`  ⏳ ${logMessage} (${timingUtils.formatDuration(ms)})`);
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

module.exports = {
    Timer,
    ProgressTracker,
    ChunkTracker,
    timingUtils
};