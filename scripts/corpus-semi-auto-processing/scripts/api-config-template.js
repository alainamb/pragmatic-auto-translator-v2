// api-config.js.template - TEMPLATE FOR API CREDENTIALS
// Copy this file to api-config.js and add your actual API keys
// DO NOT COMMIT api-config.js TO VERSION CONTROL

module.exports = {
  // DeepSeek API for text processing (REQUIRED)
  deepseek: {
    key: "your-deepseek-api-key-here", // Get from https://platform.deepseek.com/
    host: "api.deepseek.com",
    path: "/v1/chat/completions",
    model: "deepseek-chat"
  },

  // OCR Service API Keys (OPTIONAL - only needed if enabled in config.json)
  ocr_services: {
    // Google Vision API - Recommended for Chinese OCR
    google_vision: {
      // OPTION 1: Use API key (simpler setup)
      api_key: "your-google-vision-api-key-here",

      // OPTION 2: Use service account JSON key file (recommended for production)
      // service_account_key_path: "./google-vision-key.json", // Path to your service account JSON file
      
      // OPTION 3: Use project ID with gcloud authentication
      // project_id: "your-google-project-id"
    },

    // Azure Cognitive Services (alternative OCR provider)
    azure_cognitive: {
      subscription_key: "your-azure-cognitive-services-key",
      endpoint: "https://your-resource.cognitiveservices.azure.com/"
    },

    // AWS Textract (alternative OCR provider)
    aws_textract: {
      access_key: "your-aws-access-key",
      secret_key: "your-aws-secret-key", 
      region: "us-east-1"
    }
  }
};

/* 
SETUP INSTRUCTIONS:

1. Copy this file:
   cp api-config.js.template api-config.js

2. For DeepSeek API (REQUIRED):
   - Sign up at https://platform.deepseek.com/
   - Get your API key from the dashboard
   - Replace "your-deepseek-api-key-here" with your actual key

3. For Google Vision API (RECOMMENDED for Chinese):
   
   OPTION A - Service Account (Recommended):
   - Go to Google Cloud Console (https://console.cloud.google.com/)
   - Enable Vision API for your project
   - Create a service account
   - Download the JSON key file
   - Save it as "google-vision-key.json" in the scripts/ folder
   - Update service_account_key_path above
   
   OPTION B - API Key (Simpler):
   - Go to Google Cloud Console
   - Enable Vision API
   - Create an API key in "Credentials"
   - Uncomment and set the api_key field above
   
4. Test your configuration:
   node -e "const config = require('./scripts/config'); config.printConfig();"

SECURITY NOTES:
- NEVER commit api-config.js to version control
- The file is automatically excluded by .gitignore
- Keep your API keys secure and rotate them regularly
- Different team members can have their own api-config.js

TROUBLESHOOTING:
- If you get "credentials not configured" errors, check that your paths are correct
- If Google Vision fails, ensure the service account has Vision API permissions
- For Chinese text, Google Vision is strongly recommended over Tesseract
*/