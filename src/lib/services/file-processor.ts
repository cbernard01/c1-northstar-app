import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

import csv from 'csv-parser';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import * as XLSX from 'xlsx';

// File processing result interface
export interface ProcessingResult {
  accountsFound: number;
  accountsCreated: number;
  accountsUpdated: number;
  insightsGenerated: number;
  technologiesIdentified: string[];
  errors: string[];
  warnings: string[];
  processingTime: number;
  extractedData: any[];
}

// File processor class
export class FileProcessor {
  private static readonly SUPPORTED_TYPES = {
    'text/csv': 'csv',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  };

  static isSupported(fileType: string): boolean {
    return Object.keys(this.SUPPORTED_TYPES).includes(fileType);
  }

  static getFileExtension(fileType: string): string {
    return this.SUPPORTED_TYPES[fileType as keyof typeof this.SUPPORTED_TYPES] || 'unknown';
  }

  static async processFile(filePath: string, fileType: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    let extractedData: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      switch (fileType) {
        case 'text/csv':
          extractedData = await this.processCsv(filePath);
          break;
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          extractedData = await this.processExcel(filePath);
          break;
        case 'application/pdf':
          extractedData = await this.processPdf(filePath);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          extractedData = await this.processDocx(filePath);
          break;
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          extractedData = await this.processPptx(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Process the extracted data to identify accounts, technologies, etc.
      const processedResult = await this.analyzeExtractedData(extractedData);
      
      return {
        ...processedResult,
        extractedData,
        errors,
        warnings,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown processing error');
      return {
        accountsFound: 0,
        accountsCreated: 0,
        accountsUpdated: 0,
        insightsGenerated: 0,
        technologiesIdentified: [],
        errors,
        warnings,
        processingTime: Date.now() - startTime,
        extractedData: [],
      };
    }
  }

  private static async processCsv(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  private static async processExcel(filePath: string): Promise<any[]> {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }

  private static async processPdf(filePath: string): Promise<any[]> {
    const buffer = await fs.readFile(filePath);
    const data = await pdf(buffer);
    
    // Extract structured data from PDF text
    // This is a simplified implementation - in production you'd use more sophisticated parsing
    const lines = data.text.split('\n').filter(line => line.trim().length > 0);
    return lines.map((line, index) => ({
      lineNumber: index + 1,
      content: line.trim(),
    }));
  }

  private static async processDocx(filePath: string): Promise<any[]> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    
    // Extract structured data from DOCX text
    const paragraphs = result.value.split('\n').filter(p => p.trim().length > 0);
    return paragraphs.map((paragraph, index) => ({
      paragraphNumber: index + 1,
      content: paragraph.trim(),
    }));
  }

  private static async processPptx(filePath: string): Promise<any[]> {
    // For PPTX, we'll use a similar approach to Excel since they're both Office formats
    try {
      const buffer = await fs.readFile(filePath);
      // This is a simplified implementation - in production you'd use a proper PPTX parser
      // For now, we'll treat it as a document with text content
      return [{
        type: 'presentation',
        content: 'PPTX processing not fully implemented yet',
        note: 'This would contain extracted slide content in production',
      }];
    } catch (error) {
      throw new Error('PPTX processing failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private static async analyzeExtractedData(data: any[]): Promise<Omit<ProcessingResult, 'extractedData' | 'errors' | 'warnings' | 'processingTime'>> {
    // Technology keywords to identify
    const techKeywords = [
      'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'python', 'java', 
      'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'flutter', 'docker', 'kubernetes',
      'aws', 'azure', 'gcp', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
      'graphql', 'rest', 'microservices', 'serverless', 'ci/cd', 'jenkins', 'github actions'
    ];

    const technologiesFound = new Set<string>();
    let accountsFound = 0;
    
    // Analyze data for company information and technologies
    data.forEach(item => {
      const text = JSON.stringify(item).toLowerCase();
      
      // Look for company indicators
      if (text.includes('company') || text.includes('corporation') || text.includes('inc') || text.includes('ltd')) {
        accountsFound++;
      }
      
      // Look for technologies
      techKeywords.forEach(tech => {
        if (text.includes(tech.toLowerCase())) {
          technologiesFound.add(tech);
        }
      });
    });

    return {
      accountsFound,
      accountsCreated: 0, // Will be updated after database operations
      accountsUpdated: 0, // Will be updated after database operations
      insightsGenerated: 0, // Will be updated after insight generation
      technologiesIdentified: Array.from(technologiesFound),
    };
  }

  // Utility method to save processed data
  static async saveProcessedData(data: any[], format: 'json' | 'csv' | 'xlsx', outputPath: string): Promise<void> {
    switch (format) {
      case 'json':
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
        break;
      case 'csv':
        const csvWriter = require('csv-writer').createObjectCsvWriter;
        if (data.length > 0) {
          const headers = Object.keys(data[0]).map(key => ({ id: key, title: key }));
          const writer = csvWriter({
            path: outputPath,
            header: headers,
          });
          await writer.writeRecords(data);
        }
        break;
      case 'xlsx':
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        XLSX.writeFile(workbook, outputPath);
        break;
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }
}