# Corpus Content JSON Checklist

This repository contains JSON-formatted corpus content for vectorization and integration with a corpus-informed automatic translator that works among English, Spanish and Simplified Chinese. The English and Spanish content is primarily sourced from the Americas.

Review the `corpus-content-structure.json` for an example of how the below guidelines are structured in processed corpus content files.

## Project Structure

The corpus system consists of two main components:

1. **Database Files**: Track all corpus items
   - `gai-eng_database.json` - Records English content
   - `gai-esp_database.json` - Records Spanish content
   - `gai-zho_database.json` - Records Chinese content

2. **Individual Item Files**: Contain the actual content in structured JSON format
   - Pattern: `gai-eng_item001.json`, `gai-esp_item001.json`, etc.

## File Naming Conventions

### Submission Files
Format: `Author'sLastName_AbbreviatedTitle_YearOfPublication`

Examples:
- `Bender_DangersOfStochasticParrots_2021.pdf`
- `Biden_ExecutiveOrder14110onSafeAI_2023.pdf`
- `Gates_AgeOfAIHasBegun_2023.pdf`
- `UNESCO_EthicsInAI_2022.pdf`
- `Vaswani_AttentionIsAllYouNeed_2017.pdf`

### Processed Files
Format: `corpus_identifier-3letterLanguageCode_corpus-itemXXX`

Examples:
- `gai-eng_corpus-item001.json`
- `gai-eng_corpus-item002.json`
- `gai-esp_corpus-item001.json`
- `gai-esp_corpus-item002.json`
- `gai-zho_corpus-item001.json`

## JSON Structure Requirements

### Document Root Structure
```json
{
  "document_id": "domain-lang_corpus-itemXXX",
  "content": {
    "abstract": "text or null",
    "sections": [...],
    "figures": [...],
    "tables": [...]
  }
}
```

### Content Organization
- **Abstract**: Text content or `null` (without quotes) if no abstract exists
- **Sections**: Array of section objects with hierarchical structure
- **Figures**: Array of figure objects (if present)
- **Tables**: Array of table objects (if present)

## ID Naming Conventions

| ID | Meaning |
|---|---|
| `abstract` | Document abstract (value: text or null) |
| `section_0` | Unnumbered section before Section 1 |
| `section_1` | First numbered section |
| `p1_1` | Section 1, Paragraph 1 |
| `p1_2` | Section 1, Paragraph 2 |
| `section_2_1` | Subsection 2.1 |
| `section_3_1_1` | Subsubsection 3.1.1 |
| `p3_1_3_1` | Subsubsection 3.1.3, Paragraph 1 |
| `figure_1` | Figure 1 |
| `table_1` | Table 1 |

## Text Formatting Guidelines

### Quotation Marks and Apostrophes
- **Use**: Straight quotes `""` and apostrophes `''`
- **Avoid**: Curly quotes `“”` and apostrophes `‘’`

**Correct**: `"I've seen two demonstrations..."`
**Incorrect**: `"I’ve seen two demonstrations..."`

### Escaped Characters
Quotation marks within JSON string values must be escaped with backslashes:

```json
"text": "Birhane and Prabhu note, echoing Ruha Benjamin, \"Feeding AI systems on the world's beauty, ugliness, and cruelty, but expecting it to reflect only the beauty is a fantasy.\" [p.1541]"
```

### Text Styling
- **Remove**: Italic and bold formatting (no asterisks or markup)
- **Use**: Plain text only to avoid vectorization issues

## Special Content Handling

### Footnotes
Use Markdown syntax `[^1]` in paragraph text and collect in footnotes array:

```json
{
  "id": "p1_1_1",
  "text": "Here's a sentence with a footnote.[^1]",
  "footnotes": [
    {
      "marker": "1",
      "text": "Here is the contents of the footnote."
    }
  ]
}
```

### External Links
Mark linked content in text and collect in external_links array:

```json
{
  "id": "p1_1_1",
  "text": "Here's a sentence with linked content.",
  "external_links": [
    {
      "marker": "linked content",
      "url": "www.linkedcontent.com"
    }
  ]
}
```

### Inline Equations
Mark equations in text and provide LaTeX representation:

```json
{
  "id": "p1_1_1",
  "text": "Here's a sentence with an equation: a + b = c.",
  "inline_equations": [
    {
      "marker": "a + b = c",
      "latex": "a+b=c"
    }
  ]
}
```

## Figures and Tables

### Figures Array
Include only if document contains figures:

```json
"figures": [
  {
    "id": "figure_1",
    "caption": "Caption for Figure 1"
  }
]
```

### Tables Array
Include only if document contains tables:

```json
"tables": [
  {
    "id": "table_1",
    "caption": "Caption for Table 1"
  }
]
```

**Note**: Table contents are not included to avoid sparse, less meaningful embeddings from number-rich data.

## Quality Assurance Checklist

Before submitting JSON files, verify:

- [ ] File naming follows conventions
- [ ] Nested key structure matches organization standards
- [ ] Section, paragraph, figure, and table IDs use correct naming conventions
- [ ] Quotes within string values are escaped with backslashes
- [ ] Straight quotations and apostrophes are used (not curly)
- [ ] Italicized/bolded text is represented as plain text
- [ ] Footnotes use Markdown markup and are collected in arrays
- [ ] External links and inline equations are properly structured
- [ ] Figures array is included only when document contains figures
- [ ] Tables array is included only when document contains tables

## Resources

- [Learn JSON in 10 Minutes](https://youtu.be/iiADhChRriM?si=uQMgMDXj43-IfyJ5)
- [JSON Tutorial from W3Schools](https://www.w3schools.com/js/js_json.asp)
- [Markdown Syntax Guide](https://www.markdownguide.org/cheat-sheet/)
- [LaTeX Editor](https://latexeditor.app)

## Future Enhancements

- **Figures**: May convert to machine-readable SVG files using Inkscape
- **Tables**: May include content for tables with meaningful textual data
- **Formatting**: May preserve italic/bold formatting if translation model supports it