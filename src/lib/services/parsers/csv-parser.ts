import { Readable } from 'stream';
import csv from 'csv-parser';
import { 
  BaseFileParser, 
  IParserConfig, 
  TParserResult, 
  TParsedBlock,
  TBaseMetadata 
} from './file-parser.interface';

export interface ICsvParserConfig extends IParserConfig {
  delimiter?: string;
  hasHeaders?: boolean;
  skipEmptyLines?: boolean;
  maxRows?: number;
  inferTypes?: boolean;
}

export class CsvParser extends BaseFileParser {
  readonly name = 'CSV Parser';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = [
    'text/csv',
    'application/csv',
    'text/comma-separated-values',
  ];

  protected getFeatures(): string[] {
    return [
      'Table extraction',
      'Header detection',
      'Type inference',
      'Custom delimiters',
      'Row limits',
      'Empty line handling',
    ];
  }

  async parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: ICsvParserConfig
  ): Promise<TParserResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await this.validateFile(buffer, mimeType);

      const csvConfig: ICsvParserConfig = {
        delimiter: ',',
        hasHeaders: true,
        skipEmptyLines: true,
        maxRows: 10000,
        inferTypes: true,
        ...config,
      };

      const rows = await this.parseCsvBuffer(buffer, csvConfig);
      
      if (rows.length === 0) {
        warnings.push('No data rows found in CSV file');
        return this.createParserResult(
          [],
          fileName,
          buffer.length,
          mimeType,
          Date.now() - startTime,
          errors,
          warnings
        );
      }

      const blocks = this.createBlocksFromRows(rows, csvConfig);
      
      if (csvConfig.maxRows && rows.length >= csvConfig.maxRows) {
        warnings.push(`CSV truncated to ${csvConfig.maxRows} rows`);
      }

      return this.createParserResult(
        blocks,
        fileName,
        buffer.length,
        mimeType,
        Date.now() - startTime,
        errors,
        warnings
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown CSV parsing error';
      errors.push(errorMessage);
      
      return this.createParserResult(
        [],
        fileName,
        buffer.length,
        mimeType,
        Date.now() - startTime,
        errors,
        warnings
      );
    }
  }

  private async parseCsvBuffer(
    buffer: Buffer,
    config: ICsvParserConfig
  ): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      const stream = Readable.from(buffer);
      
      const csvOptions = {
        separator: config.delimiter,
        skipEmptyLines: config.skipEmptyLines,
        headers: config.hasHeaders,
      };

      stream
        .pipe(csv(csvOptions))
        .on('data', (row: Record<string, any>) => {
          if (config.maxRows && rows.length >= config.maxRows) {
            return; // Stop processing after max rows
          }

          // Infer types if enabled
          if (config.inferTypes) {
            row = this.inferRowTypes(row);
          }

          rows.push(row);
        })
        .on('end', () => {
          resolve(rows);
        })
        .on('error', (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        });
    });
  }

  private inferRowTypes(row: Record<string, any>): Record<string, any> {
    const typedRow: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        
        // Try to parse as number
        if (trimmedValue !== '' && !isNaN(Number(trimmedValue))) {
          const num = Number(trimmedValue);
          typedRow[key] = Number.isInteger(num) ? num : parseFloat(trimmedValue);
          continue;
        }

        // Try to parse as boolean
        const lowerValue = trimmedValue.toLowerCase();
        if (lowerValue === 'true' || lowerValue === 'false') {
          typedRow[key] = lowerValue === 'true';
          continue;
        }

        // Try to parse as date
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmedValue) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmedValue)) {
          const date = new Date(trimmedValue);
          if (!isNaN(date.getTime())) {
            typedRow[key] = date.toISOString();
            continue;
          }
        }

        // Keep as string
        typedRow[key] = value;
      } else {
        typedRow[key] = value;
      }
    }

    return typedRow;
  }

  private createBlocksFromRows(
    rows: Record<string, any>[],
    config: ICsvParserConfig
  ): TParsedBlock[] {
    if (rows.length === 0) {
      return [];
    }

    // Get headers from first row
    const headers = Object.keys(rows[0]);
    
    // Convert data to string arrays for table format
    const tableRows = rows.map(row => 
      headers.map(header => {
        const value = row[header];
        return value === null || value === undefined ? '' : String(value);
      })
    );

    // Create metadata
    const metadata: TBaseMetadata = {
      source: 'csv-parser',
      confidence: 1.0,
    };

    // Create summary blocks
    const blocks: TParsedBlock[] = [];

    // Add summary text block
    const summaryText = this.createSummaryText(rows, headers);
    blocks.push(this.createTextBlock(
      summaryText,
      'CSV Summary',
      metadata
    ));

    // Add table block with all data
    blocks.push(this.createTableBlock(
      headers,
      tableRows,
      'CSV Data Table',
      metadata
    ));

    // Add individual column analysis blocks if there are many columns
    if (headers.length > 10) {
      headers.forEach((header, index) => {
        const columnValues = rows.map(row => String(row[header] || ''));
        const uniqueValues = [...new Set(columnValues)].filter(v => v.trim() !== '');
        
        if (uniqueValues.length > 0) {
          const columnSummary = `Column "${header}" contains ${uniqueValues.length} unique values. Sample values: ${uniqueValues.slice(0, 5).join(', ')}${uniqueValues.length > 5 ? '...' : ''}`;
          
          blocks.push(this.createTextBlock(
            columnSummary,
            `Column Analysis: ${header}`,
            { ...metadata, lineNumber: index + 1 }
          ));
        }
      });
    }

    return blocks;
  }

  private createSummaryText(rows: Record<string, any>[], headers: string[]): string {
    const rowCount = rows.length;
    const columnCount = headers.length;
    
    let summary = `CSV file contains ${rowCount} rows and ${columnCount} columns.\n\n`;
    summary += `Columns: ${headers.join(', ')}\n\n`;
    
    // Add some basic statistics
    if (rowCount > 0) {
      summary += 'Sample data:\n';
      const sampleRows = rows.slice(0, Math.min(3, rowCount));
      sampleRows.forEach((row, index) => {
        summary += `Row ${index + 1}: ${JSON.stringify(row, null, 2)}\n`;
      });
      
      if (rowCount > 3) {
        summary += `... and ${rowCount - 3} more rows\n`;
      }
    }

    return summary;
  }

  async validateFile(buffer: Buffer, mimeType: string): Promise<void> {
    await super.validateFile(buffer, mimeType);

    // Check if buffer starts with valid CSV-like content
    const preview = buffer.slice(0, 1000).toString('utf-8');
    
    // Basic CSV format validation
    if (!preview.includes(',') && !preview.includes(';') && !preview.includes('\t')) {
      throw new Error('File does not appear to contain delimiter-separated values');
    }

    // Check for binary content that shouldn't be in CSV
    const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F]/;
    if (binaryPattern.test(preview)) {
      throw new Error('File appears to contain binary data, not valid CSV');
    }
  }

  // Utility method to detect delimiter
  static detectDelimiter(buffer: Buffer): string {
    const preview = buffer.slice(0, 5000).toString('utf-8');
    const lines = preview.split('\n').slice(0, 10); // Check first 10 lines
    
    const delimiters = [',', ';', '\t', '|'];
    const scores: Record<string, number> = {};
    
    delimiters.forEach(delimiter => {
      let score = 0;
      let consistentCount = 0;
      
      lines.forEach(line => {
        const count = (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
        score += count;
        if (count > 0) consistentCount++;
      });
      
      // Favor delimiters that appear consistently across lines
      scores[delimiter] = score * (consistentCount / Math.max(lines.length, 1));
    });
    
    // Return delimiter with highest score
    const bestDelimiter = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );
    
    return bestDelimiter;
  }

  // Utility method to detect if first row contains headers
  static hasHeaders(buffer: Buffer, delimiter: string = ','): boolean {
    const preview = buffer.slice(0, 2000).toString('utf-8');
    const lines = preview.split('\n').filter(line => line.trim()).slice(0, 5);
    
    if (lines.length < 2) return false;
    
    const firstRow = lines[0].split(delimiter);
    const secondRow = lines[1].split(delimiter);
    
    // If first row has different data types than second row, likely headers
    if (firstRow.length !== secondRow.length) return false;
    
    let headerLikeCount = 0;
    firstRow.forEach((cell, index) => {
      const firstCell = cell.trim();
      const secondCell = secondRow[index]?.trim() || '';
      
      // Check if first row cell looks like a header (text) and second looks like data
      const firstIsText = isNaN(Number(firstCell)) && firstCell.length > 0;
      const secondIsNumber = !isNaN(Number(secondCell)) && secondCell.length > 0;
      
      if (firstIsText && (secondIsNumber || secondCell !== firstCell)) {
        headerLikeCount++;
      }
    });
    
    return headerLikeCount > firstRow.length * 0.5; // More than 50% look like headers
  }
}