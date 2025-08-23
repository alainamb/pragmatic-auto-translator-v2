# Corpus Auto Processing - Corpus Metadata Inference

A tool to help speed up the process of generating metadata in JSON format from corpora for the Pragmatic Auto-Translator project. This program was written by Abdurrahman Alyajouri.

This program is intended to be used AFTER the JSON Content Files program (jsonContents_README). The logic behind this is that after doing the step-by-step review of the contents of a corpus item, the human processer will be more informed in carrying out the verification of the metadata generated for that item.

Note: For each corpus item, two types of JSON content need to be generated: the metadata (data about the data) and the contents of document. This README address the semi-automatic generation of the JSON metadata for a document. To learn how to semi-automatically creation of the JSON for the contents of a corpus document, please see the jsonContents_README.

## Purpose of 'metadata.js'

The purpose of the program 'metadata.js' is to automatically infer the metadata of a publication or piece of literature in the form of a text file. Metadata - (data about data) - includes information like the authors of the text, publishers, publishing date, topics covered, etc. The program 'metadata.js' ***attempts*** to make educated guesses about most of the metadata, through the help of large language models such as DeepSeek. The program takes the inferred metadata, and tries to verify it as much as possible, before handing it to the user for review.

## Why should this be automated?

The reason why this program exists is to hopefully cut down the time you spend manually filling out the metadata of any given document by a significant amount. It is not perfect. The amount of inferred metadata is heavily dependent on how much of the document that 'metadata.js' is able to read (*see "Configuring 'metadata.js" section down below*), how much metadata is contained within the document itself, and how capable DeepSeek is at inferring the metadata from the given context. 

## Required Node.js modules and NPM packages needed to run 'metadata.js'

### Node.js modules:
* fs		(To provide file system access.) 	
* path		(To provide platform independent path support.)

### NPM packages:
* openai 	(to configure the DeepSeek API call as per the DeepSeek API documentation. Run 'npm install openai'.)

## Running 'metadata.js'

There are 2 valid ways to run the program 'metadata.js':

1. 'node [insert path to metadata.js]/metadata.js' -> shows a similar help message as what is being described.
2. 'node [insert path to 'metadata.js']/metadata.js [insert domain] [insert language family] [insert language variant] [insert path to document text file] [insert path to output folder]' -> runs the metadata generation/inference process.

**Example: 'node ./scripts/metadata.js gai eng usa ./text_to_json_input/Bender_DangersOfStochasticParrots_2021.txt ./text_to_metadata_output'**

**Example result: A file called 'Bender_DangersOfStochasticParrots_2021_metadata.json' will be saved to the specified folder: './text_to_metadata_output'. It will contain a JSON object storing metadata (ideally all of the metadata) for the text within 'Bender_DangersOfStochasticParrots_2021.txt'.**

*Note: A folder called "text_to_metadata_output" should exist, but if not, create one and provide the path to it when running 'metadata.js'.*

*Note: If you didn't know, '.' refers to the current directory/folder you are in, and '..' refers to the parent directory/folder of the current directory/folder you are in.*

*Note: If one of the paths you give contains a space, then 'metadata.js' will interpret that path as 2 separate arguments delimited by the space. To fix this, make sure to surround the entire path argument in quotation marks so that the console can treat it as one argument rather than two.*

## Configuring 'metadata.js'

It is possible to change the behavior of 'metadata.js' without breaking it, but you should gain approval before doing so. Open up the 'metadata.js' file in a code or text editor and adjust the constants at the top of the file in the way that is described below:

* Appending an element to the 'acceptedDomains' array: Will allow 'metadata.js' to accept the newly appended domain on the command line.
* Appending a property to the 'acceptedLanguages' object: Will allow 'metadata.js' to accept the newly appended language family on the command line.
* Appending an element to the array values of any given property in the 'acceptedLanguages' object: Will allow 'metadata.js' to accept the newly appended language variant corresponding to a language family on the command line.
* Changing the 'maxWordsToRead' variable: By default it is set to 1000 words (because it needs to read a good amount of the document for metadata inference, but it typically doesn't need to read the whole document). Making it too high could make it impossible to make a DeepSeek API call, as it may have exceeded the token limit, and making it too low could leave DeepSeek with too little context to infer the metadata at all, so be careful when adjusting it.

## DISCLAIMERS
This program should **NOT** replace your task of filling out the metadata, it should only speed up how fast you complete said task. It is very likely you will need to navigate to the output metadata JSON file for a given document and verify that everything looks correct, and adjust anything that looks incorrect. It is very possible that **none** of the metadata may be inferred in some instances, though probably unlikely. The program does its best to provide some error messages to let you know where DeepSeek failed, and hint at what needs user correction.

If any bugs arise while using 'metadata.js', please notify Alaina Brandt asap.