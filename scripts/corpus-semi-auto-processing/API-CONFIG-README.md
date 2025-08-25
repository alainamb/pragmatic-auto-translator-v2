# API Configuration Setup

This project requires API credentials to function. These are kept separate from the main configuration for security.

## Setup Instructions

1. **Copy the template file:**
   ```bash
   cp api-config.js.template api-config.js
   ```

2. **Add your API credentials to `api-config.js`:**

### DeepSeek API (Required)
- Sign up at https://platform.deepseek.com/
- Get your API key from the dashboard
- Replace `"your-deepseek-api-key-here"` with your actual key

### OCR Services (Optional - for better Chinese support)

#### Google Vision API
- Go to Google Cloud Console
- Enable Vision API
- Create service account and download credentials
- Add API key and project ID to config

#### Azure Cognitive Services
- Create Cognitive Services resource in Azure
- Get subscription key and endpoint
- Add to config

#### AWS Textract
- Set up AWS account and IAM user
- Get access key and secret key
- Add to config

## File Structure
```
scripts/
├── config.json           # Public configuration (safe to commit)
├── api-config.js         # Private API keys (DO NOT COMMIT)
├── api-config.js.template # Template for new users
└── .gitignore            # Ensures api-config.js is not committed
```

## Security Notes

- **NEVER** commit `api-config.js` to version control
- The file is automatically excluded by `.gitignore`
- Keep your API keys secure and rotate them regularly
- Different team members can have their own `api-config.js` with their own keys

## Testing Your Setup

Run this command to verify your configuration:
```bash
node -e "const config = require('./config'); config.printConfig();"
```

This will show:
- ✅ Configuration loaded successfully
- ✅ API keys detected
- ⚠️ Any missing or misconfigured services