# Pragmatic Auto-Translator

A corpus-informed, whole-document machine translation research project that challenges traditional sentence-by-sentence translation approaches.

## 🎯 Project Overview

The Pragmatic Auto-Translator investigates potential improvements to machine translation through two key innovations:

1. **Corpus-informed translation** using domain-specific monolingual corpora in the translation/localization domain
2. **Document-level translation** moving beyond traditional sentence-level segmentation  

### Current Implementation (Version 1)
- **Languages**: Spanish ↔ English
- **Domain**: Generative Artificial Intelligence
- **Deployment**: Client-side on GitHub Pages
- **Embedding Model**: JINA Embeddings v3
- **Translation Engine**: DeepSeek API

## 🏗️ Architecture

The system follows a corpus-informed translation pipeline:

1. **Corpus Building**: Curated domain-specific texts in both languages
2. **JSON Conversion**: Corpus items converted to structured JSON using established schema
3. **Vectorization**: Text segments embedded using JINA Embeddings v3
4. **Similarity Matching**: Source input compared against corpus vectors
5. **Context-Informed Translation**: Similar passages sent to DeepSeek as translation context
6. **Output**: Translation and context information displayed to user

## 📁 Repository Structure

```
pragmatic-auto-translator-demo/
├── .github/                        # GitHub workflow files
│   └── workflows/    
│       └── deploy.yml              # GitHub Pages deployment
├── corpora/                        # Corpus organization
│   ├── gai/                        # Generative AI domain
│   │   ├── eng/                    # English content
│   │   │   ├── submissions/        # Source files
│   │   │   ├── processed/          # JSON files (gai-eng_item001.json, etc.)
│   │   │   └── gai-eng_database.json
│   │   └── esp/                    # Spanish content  
│   │       ├── submissions/        # Source files        
│   │       ├── processed/          # JSON files (gai-esp_item001.json, etc.)
│   │       └── gai-esp_database.json
├── frontend/                       # Auto-Translator website
│   ├── css/                        # Website styles
│   ├── js/                         # JavaScript modules
│   ├── about.html                  # About page
│   ├── contact.html                # Contact page
│   └── corpora.html                # Corpora page
├── scripts/                        # Python scripts for vector creation
│   ├── create_vectors_batch.ipynb  # Vectorization script (Google Colab)
│   └── config.py                   # Configuration settings
├── vectors/                        # Generated vector files
│   └── gai/                        # Vectors for GAI domain
│       ├── gai-document-vectors.json   # Document-level vectors
│       ├── gai-section-vectors.json    # Section-level vectors
│       └── gai-paragraph-vectors.json  # Paragraph-level vectors
├── visualizations/                 # Vector mapping visualizations
├── index.html                      # Main translator interface
└── README.md                       # This file
```

## 🚀 Getting Started

### Prerequisites

1. **API Keys Required:**
   - [JINA AI API Key](https://jina.ai) (generous free tier available)
   - [DeepSeek API Key](https://platform.deepseek.com/sign_in) (small token purchase required)

2. **Development Environment:**
   - Python 3.x for corpus processing
   - Google Colab account for vectorization
   - GitHub account for deployment

### Installation Steps

#### 1. Fork and Clone Repository
```bash
git clone https://github.com/your-username/pragmatic-auto-translator-demo.git
cd pragmatic-auto-translator-demo
```

#### 2. Build Your Corpus
Follow the examples in `corpora/gai/` to create your domain-specific corpus:
- Add source documents to `submissions/` folders
- Convert to JSON format using the established schema
- Place processed JSON files in `processed/` folders
- Update database JSON files

#### 3. Generate Vectors
1. Open `scripts/create_vectors_batch.ipynb` in Google Colab
2. Configure `scripts/config.py` with your corpus settings
3. Run the notebook to generate vectors for your corpus
4. Download generated vectors to `vectors/` directory

#### 4. Configure API Keys
**Important**: API keys will be exposed in the browser when users translate!

Option A: GitHub Secrets (for deployment)
- Add `JINA_API_KEY` and `DEEPSEEK_API_KEY` to GitHub repository secrets
- Keys will be injected during GitHub Actions deployment

Option B: Local Development
- Set keys directly in `frontend/js/api-config.js` (never commit this!)

#### 5. Deploy to GitHub Pages
1. Copy the provided `deploy.yml` to `.github/workflows/`
2. Enable GitHub Pages in repository settings
3. Set source to "GitHub Actions"
4. Push changes to trigger deployment

#### 6. Configure Translation Settings
Adjust translation behavior in `frontend/js/config.js`:
- Language pairs
- Context window size
- Similarity thresholds
- Model parameters

## 🔧 Usage

1. **Access the Interface**: Visit your GitHub Pages URL
2. **Select Direction**: Choose source language (English ↔ Spanish)
3. **Input Text**: Enter text for translation
4. **Review Context**: Examine corpus passages used for context
5. **Get Translation**: Review the context-informed translation

## ⚠️ Current Limitations

### Technical Limitations
- **Language Scope**: Currently supports only Spanish-English translation
- **Domain Scope**: Limited to one domain corpus
- **Corpus Size**: Small corpus prevents meaningful quality conclusions
- **Performance**: Corpus stored in browser cache; larger corpora will cause slowdowns/crashes
- **Translation Workflow**: Inefficient text→vector→text→vector pipeline instead of streamlined text→vector→text

### Security Limitations
- **API Key Exposure**: Keys are visible in browser developer tools when translating
- **Usage Limits**: Recommended to set low API usage limits to prevent abuse
- **Client-Side Processing**: All operations happen in browser, limiting security options

### Research Limitations
- **Corpus Bias**: Limited size means we can't yet make meaningful conclusions about the translations generated
- **Evaluation Pending**: No systematic quality evaluation implemented yet
- **Baseline Comparison**: No benchmarking against traditional MT systems


## 🗺️ Development Roadmap

### Version 2.0 (In Development)
- **Expanded Languages**: English, Spanish, Mandarin Chinese, Swahili
- **Knowledge Graphs**: Integration of terminological data via knowledge graphs
- **ISO Standards**: Contributing to ISO standard development on corpus-informed translation

### Version 3.0 (Planned)
- **Quality Evaluation**: Implementation of MQM and HQuest evaluation frameworks
- **Feedback Training**: System learning from evaluation results
- **Comparative Analysis**: Benchmarking against existing translation methods
- **Viability Assessment**: Data-driven conclusions on approach effectiveness

## 📊 Research Context

This project investigates whether corpus-informed, whole-document translation can outperform traditional sentence-by-sentence approaches. Our hypothesis is that:

- **Domain-specific corpora** improve translation quality over general-purpose models
- **Whole-document processing** maintains discourse coherence better than segmented translation

This demo was developed for a workshop offered within the translation program at UNAM San Miguel to showcase a more pragmatic approach to translation technology that prioritizes cultural and contextual appropriateness. Keep a lookout for future iterations of this work!

## 🤝 Contributing

We welcome contributions to:
- Corpus development for new domains/languages
- Evaluation methodology improvements
- Technical optimizations
- Research collaborations

## 📞 Contact

For research collaboration, technical questions, or corpus development inquiries, please contact Alaina Brandt at alainambrandt@gmail.com.

## 📜 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🔗 Key Dependencies

- **JINA Embeddings v3**: Text vectorization
- **DeepSeek API**: Neural machine translation
- **GitHub Pages**: Static site hosting
- **GitHub Actions**: Automated deployment

## 📚 Related Research

This project builds on research in:
- Corpus-informed translation methodologies
- Document-level machine translation
- Translation quality evaluation (MQM, HQuest)
- Pragmatic appropriateness in translation

---

**Note**: This is a research prototype. Translation quality and system performance are experimental and should not be relied upon for production use.