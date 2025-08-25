// config.js - Configuration loader and validator
const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor() {
        this.config = null;
        this.apiConfig = null;
        this.configPath = path.join(__dirname, 'config.json');
        this.apiConfigPath = path.join(__dirname, 'api-config.js');
        this.loadConfig();
        this.loadApiConfig();
    }

    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Config file not found at: ${this.configPath}`);
            }

            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.validateConfig();
            
        } catch (error) {
            console.error('Error loading configuration:', error.message);
            process.exit(1);
        }
    }

    loadApiConfig() {
        try {
            if (!fs.existsSync(this.apiConfigPath)) {
                console.error(`API config file not found at: ${this.apiConfigPath}`);
                console.error('Please create api-config.js with your API credentials.');
                console.error('You can copy from api-config.js.template and add your keys.');
                process.exit(1);
            }

            // Clear require cache to allow reloading
            delete require.cache[require.resolve(this.apiConfigPath)];
            this.apiConfig = require(this.apiConfigPath);
            this.validateApiConfig();
            
        } catch (error) {
            console.error('Error loading API configuration:', error.message);
            process.exit(1);
        }
    }

    validateConfig() {
        const required = [
            'corpus.domain', 
            'corpus.language.family',
            'corpus.language.variant',
            'directories',
            'processing'
        ];

        for (const path of required) {
            if (!this.getNestedValue(this.config, path)) {
                throw new Error(`Missing required configuration: ${path}`);
            }
        }

        // Validate domain
        if (!this.config.accepted_domains.includes(this.config.corpus.domain)) {
            throw new Error(`Invalid domain: ${this.config.corpus.domain}. Accepted: ${this.config.accepted_domains.join(', ')}`);
        }

        // Validate language
        const langFamily = this.config.corpus.language.family;
        const langVariant = this.config.corpus.language.variant;
        
        if (!this.config.accepted_languages[langFamily]) {
            throw new Error(`Invalid language family: ${langFamily}`);
        }
        
        if (!this.config.accepted_languages[langFamily].includes(langVariant)) {
            throw new Error(`Invalid language variant: ${langVariant} for ${langFamily}`);
        }
    }

    validateApiConfig() {
        // Validate DeepSeek API key
        if (!this.apiConfig.deepseek?.key) {
            throw new Error('Missing DeepSeek API key in api-config.js');
        }

        if (!this.apiConfig.deepseek.key.startsWith('sk-')) {
            console.warn('Warning: DeepSeek API key format may be invalid (should start with sk-)');
        }

        // Validate enabled OCR services have proper credentials
        Object.keys(this.config.ocr_services.providers).forEach(provider => {
            if (this.config.ocr_services.providers[provider].enabled && provider !== 'tesseract' && provider !== 'paddle_ocr') {
                
                // Check provider-specific credential requirements
                if (provider === 'google_vision') {
                    const gvCreds = this.getNestedValue(this.apiConfig, `ocr_services.${provider}`);
                    const hasServiceAccount = gvCreds?.service_account_key_path;
                    const hasApiKey = gvCreds?.api_key;
                    const hasProjectId = gvCreds?.project_id;
                    
                    if (!hasServiceAccount && !hasApiKey && !hasProjectId) {
                        console.warn(`Warning: ${provider} is enabled but no credentials found in api-config.js`);
                        console.warn(`  Add service_account_key_path, api_key, or project_id to ocr_services.${provider}`);
                    } else if (hasServiceAccount) {
                        // Validate service account key file exists
                        let keyPath;
                        if (path.isAbsolute(hasServiceAccount)) {
                            keyPath = hasServiceAccount;
                        } else {
                            keyPath = path.resolve(__dirname, hasServiceAccount);
                        }
                        
                        if (!fs.existsSync(keyPath)) {
                            console.warn(`Warning: Google Vision service account key not found: ${keyPath}`);
                        } else {
                            console.log(`✅ Google Vision service account key found`);
                        }
                    } else if (hasApiKey) {
                        console.log(`✅ Google Vision API key configured`);
                    } else if (hasProjectId) {
                        console.log(`✅ Google Vision project ID configured`);
                    }
                } 
                else if (provider === 'azure_cognitive') {
                    const azureCreds = this.getNestedValue(this.apiConfig, `ocr_services.${provider}`);
                    if (!azureCreds?.subscription_key || !azureCreds?.endpoint) {
                        console.warn(`Warning: ${provider} is enabled but missing subscription_key or endpoint in api-config.js`);
                    }
                }
                else if (provider === 'aws_textract') {
                    const awsCreds = this.getNestedValue(this.apiConfig, `ocr_services.${provider}`);
                    if (!awsCreds?.access_key || !awsCreds?.secret_key) {
                        console.warn(`Warning: ${provider} is enabled but missing access_key or secret_key in api-config.js`);
                    }
                }
                else {
                    // Generic check for other providers
                    const apiKey = this.getNestedValue(this.apiConfig, `ocr_services.${provider}.api_key`) || 
                                 this.getNestedValue(this.apiConfig, `ocr_services.${provider}.subscription_key`) ||
                                 this.getNestedValue(this.apiConfig, `ocr_services.${provider}.access_key`);
                    
                    if (!apiKey) {
                        console.warn(`Warning: ${provider} is enabled but no API key found in api-config.js`);
                    }
                }
            }
        });
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], obj);
    }

    // Getter methods for easy access
    get deepseekApiKey() {
        return this.apiConfig.deepseek.key;
    }

    get deepseekApiConfig() {
        return this.apiConfig.deepseek;
    }

    get domain() {
        return this.config.corpus.domain;
    }

    get language() {
        return this.config.corpus.language;
    }

    get directories() {
        return this.config.directories;
    }

    get processing() {
        return this.config.processing;
    }

    get ocrServices() {
        return this.config.ocr_services;
    }

    get acceptedDomains() {
        return this.config.accepted_domains;
    }

    get acceptedLanguages() {
        return this.config.accepted_languages;
    }

    get languageMapping() {
        return this.config.language_mapping;
    }

    get ocrLanguages() {
        return this.config.language_mapping.to_ocr_codes;
    }

    // Get API credentials for OCR services
    getOcrApiCredentials(provider) {
        return this.apiConfig.ocr_services[provider] || {};
    }

    // Get the appropriate OCR provider for current language
    getOcrProvider(languageCode = null) {
        // Construct the full language code (family-variant)
        const lang = languageCode || this.getFullLanguageCode();
        
        // Check for language-specific overrides (e.g., "zho-chn")
        const override = this.config.ocr_services.language_overrides[lang];
        if (override) {
            // Check if preferred provider is enabled
            const preferredProvider = override.preferred_provider;
            if (this.config.ocr_services.providers[preferredProvider]?.enabled) {
                return {
                    provider: preferredProvider,
                    config: this.config.ocr_services.providers[preferredProvider],
                    apiCredentials: this.getOcrApiCredentials(preferredProvider),
                    reason: override.reason || 'Language-specific preference'
                };
            }
            
            // Try fallback provider
            const fallbackProvider = override.fallback_provider;
            if (fallbackProvider && this.config.ocr_services.providers[fallbackProvider]?.enabled) {
                return {
                    provider: fallbackProvider,
                    config: this.config.ocr_services.providers[fallbackProvider],
                    apiCredentials: this.getOcrApiCredentials(fallbackProvider),
                    reason: 'Fallback provider (preferred unavailable)'
                };
            }
        }
        
        // If no override found, also try just the family code (e.g., "zho")
        if (lang.includes('-')) {
            const familyOnly = lang.split('-')[0];
            const familyOverride = this.config.ocr_services.language_overrides[familyOnly];
            if (familyOverride) {
                const preferredProvider = familyOverride.preferred_provider;
                if (this.config.ocr_services.providers[preferredProvider]?.enabled) {
                    return {
                        provider: preferredProvider,
                        config: this.config.ocr_services.providers[preferredProvider],
                        apiCredentials: this.getOcrApiCredentials(preferredProvider),
                        reason: familyOverride.reason || 'Language family preference'
                    };
                }
            }
        }
        
        // Use default provider
        const defaultProvider = this.config.ocr_services.default;
        if (this.config.ocr_services.providers[defaultProvider]?.enabled) {
            return {
                provider: defaultProvider,
                config: this.config.ocr_services.providers[defaultProvider],
                apiCredentials: this.getOcrApiCredentials(defaultProvider),
                reason: 'Default provider'
            };
        }
        
        // Find any enabled provider
        const enabledProviders = Object.keys(this.config.ocr_services.providers)
            .filter(key => this.config.ocr_services.providers[key].enabled);
            
        if (enabledProviders.length > 0) {
            const provider = enabledProviders[0];
            return {
                provider: provider,
                config: this.config.ocr_services.providers[provider],
                apiCredentials: this.getOcrApiCredentials(provider),
                reason: 'First available provider'
            };
        }
        
        throw new Error('No OCR providers are enabled in configuration');
    }

    // Get full language code combining family and variant
    getFullLanguageCode() {
        return `${this.language.family}-${this.language.variant}`;
    }

    // Check if OCR should be skipped for a language
    shouldSkipOcr(languageCode = null) {
        const lang = languageCode || this.getFullLanguageCode();
        
        // Check full language code first (e.g., "zho-chn")
        let override = this.config.ocr_services.language_overrides[lang];
        
        // If not found, try just family code (e.g., "zho")
        if (!override && lang.includes('-')) {
            const familyOnly = lang.split('-')[0];
            override = this.config.ocr_services.language_overrides[familyOnly];
        }
        
        return override?.tesseract_disabled === true && !this.hasAlternativeOcrProvider(lang);
    }

    // Check if there are alternative OCR providers available
    hasAlternativeOcrProvider(languageCode = null) {
        try {
            const provider = this.getOcrProvider(languageCode);
            return provider.provider !== 'tesseract';
        } catch {
            return false;
        }
    }

    // Get quality thresholds for OCR
    get ocrQualityThresholds() {
        return this.config.ocr_services.quality_thresholds;
    }

    // Get API language code for current language setting (2-letter for APIs)
    get currentApiLanguage() {
        return this.config.language_mapping.to_api_codes[this.language.family] || 'en';
    }

    // Get OCR language code for current language setting
    get currentOcrLanguage() {
        const fullLangCode = this.getFullLanguageCode(); // "zho-chn"
        return this.config.language_mapping.to_ocr_codes[fullLangCode] || 
            this.config.language_mapping.to_ocr_codes[this.language.family] || 'eng';
    }

    // Convert 3-letter code to API format
    toApiLanguage(threeLetterCode) {
        return this.config.language_mapping.to_api_codes[threeLetterCode] || 'en';
    }

    // Convert API code to 3-letter format
    fromApiLanguage(twoLetterCode) {
        return this.config.language_mapping.from_api_codes[twoLetterCode] || 'eng';
    }

    // Convert 3-letter code to OCR format
    toOcrLanguage(threeLetterCode) {
        return this.config.language_mapping.to_ocr_codes[threeLetterCode] || 'eng';
    }

    // Convert OCR code to 3-letter format
    fromOcrLanguage(ocrCode) {
        return this.config.language_mapping.from_ocr_codes[ocrCode] || 'eng';
    }

    // Create directories if they don't exist
    ensureDirectories() {
        const dirs = Object.values(this.directories);
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        });
    }

    // Get database filename for current language
    get databaseFilename() {
        return `${this.domain}-${this.language.family}_database.json`;
    }

    // Get item filename pattern
    getItemFilename(itemNumber) {
        const paddedNumber = String(itemNumber).padStart(3, '0');
        return `${this.domain}-${this.language.family}_item${paddedNumber}.json`;
    }

    // Update config values (useful for testing or runtime changes)
    updateConfig(path, value) {
        const keys = path.split('.');
        let obj = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        
        obj[keys[keys.length - 1]] = value;
        this.validateConfig();
    }

    // Save current config back to file (useful for programmatic updates)
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            throw new Error(`Failed to save config: ${error.message}`);
        }
    }

    // Debug method to print current configuration
    printConfig() {
        console.log('Current Configuration:');
        console.log(`  Domain: ${this.domain}`);
        console.log(`  Language: ${this.language.family} (${this.language.variant})`);
        console.log(`  API Language Code: ${this.currentApiLanguage}`);
        console.log(`  OCR Language Code: ${this.currentOcrLanguage}`);
        
        try {
            const ocrProvider = this.getOcrProvider();
            console.log(`  OCR Provider: ${ocrProvider.provider} (${ocrProvider.reason})`);
        } catch (error) {
            console.log(`  OCR Provider: None available - ${error.message}`);
        }
        
        console.log(`  API Host: ${this.deepseekApiConfig.host}`);
        console.log(`  Database File: ${this.databaseFilename}`);
        console.log(`  Directories: ${Object.keys(this.directories).length} configured`);
        console.log(`  Language Mapping: 3-letter ↔ API/OCR codes enabled`);
        
        // Show OCR service status
        const enabledServices = Object.keys(this.ocrServices.providers)
            .filter(key => this.ocrServices.providers[key].enabled);
        console.log(`  Enabled OCR Services: ${enabledServices.join(', ') || 'None'}`);
    }
}

// Create singleton instance
const configLoader = new ConfigLoader();

// Export both the instance and the class
module.exports = configLoader;
module.exports.ConfigLoader = ConfigLoader;