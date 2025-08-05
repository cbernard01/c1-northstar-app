import mammoth from 'mammoth';
import { 
  BaseFileParser, 
  IParserConfig, 
  TParserResult, 
  TParsedBlock,
  TBaseMetadata 
} from './file-parser.interface';

export interface IDocxParserConfig extends IParserConfig {
  includeHiddenText?: boolean;
  preserveFormatting?: boolean;
  convertImages?: boolean;
  extractTables?: boolean;
  extractHeaders?: boolean;
  extractFooters?: boolean;
  detectLists?: boolean;
  minParagraphLength?: number;
}

export interface IDocxElement {
  type: 'paragraph' | 'heading' | 'list' | 'table' | 'image';
  content: string;
  level?: number;
  style?: string;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

export class DocxParser extends BaseFileParser {
  readonly name = 'DOCX Parser';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword', // Legacy .doc files (limited support)
  ];

  protected getFeatures(): string[] {
    return [
      'Text extraction',
      'Heading detection',
      'List extraction',
      'Table extraction',
      'Style preservation',
      'Image extraction',
      'Header/footer extraction',
      'Paragraph analysis',
    ];
  }

  async parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IDocxParserConfig
  ): Promise<TParserResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await this.validateFile(buffer, mimeType);

      const docxConfig: IDocxParserConfig = {
        includeHiddenText: false,
        preserveFormatting: true,
        convertImages: false,
        extractTables: true,
        extractHeaders: false,
        extractFooters: false,
        detectLists: true,
        minParagraphLength: 5,
        ...config,
      };

      const docxData = await this.parseDocxBuffer(buffer, docxConfig);
      
      if (!docxData.value || docxData.value.trim().length === 0) {
        warnings.push('No text content found in DOCX file');
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

      const blocks = await this.createBlocksFromDocxData(docxData, docxConfig);
      
      if (docxData.messages && docxData.messages.length > 0) {
        const messageWarnings = docxData.messages
          .filter(msg => msg.type === 'warning')
          .map(msg => msg.message);
        warnings.push(...messageWarnings);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown DOCX parsing error';
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

  private async parseDocxBuffer(
    buffer: Buffer,
    config: IDocxParserConfig
  ): Promise<any> {
    const options: any = {
      convertImage: config.convertImages ? mammoth.images.imgElement((image: any) => {
        return image.read('base64').then((imageBuffer: Buffer) => {
          return {
            src: `data:${image.contentType};base64,${imageBuffer.toString('base64')}`
          };
        });
      }) : mammoth.images.ignoreAllImages,
    };

    try {
      // First extract raw text
      const rawResult = await mammoth.extractRawText({ buffer }, options);
      
      // Then extract HTML to preserve structure if needed
      let htmlResult;
      if (config.preserveFormatting) {
        htmlResult = await mammoth.convertToHtml({ buffer }, options);
      }

      return {
        value: rawResult.value,
        html: htmlResult?.value,
        messages: rawResult.messages || [],
      };
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createBlocksFromDocxData(
    docxData: any,
    config: IDocxParserConfig
  ): Promise<TParsedBlock[]> {
    const blocks: TParsedBlock[] = [];
    const text = docxData.value;
    
    // Create document metadata
    const documentMetadata: TBaseMetadata = {
      source: 'docx-parser',
      confidence: 0.95,
    };

    // Add document summary block
    const summaryText = this.createSummaryText(text);
    blocks.push(this.createTextBlock(
      summaryText,
      'DOCX Document Summary',
      documentMetadata
    ));

    // Parse structure if HTML is available
    if (config.preserveFormatting && docxData.html) {
      const structuredBlocks = this.parseHtmlStructure(docxData.html, config, documentMetadata);
      blocks.push(...structuredBlocks);
    } else {
      // Fall back to plain text parsing
      const textBlocks = this.parseTextStructure(text, config, documentMetadata);
      blocks.push(...textBlocks);
    }

    return blocks;
  }

  private parseHtmlStructure(
    html: string,
    config: IDocxParserConfig,
    baseMetadata: TBaseMetadata
  ): TParsedBlock[] {
    const blocks: TParsedBlock[] = [];
    
    // Simple HTML parsing (in production, you might want to use a proper HTML parser)
    // This is a simplified approach to extract basic structure
    
    // Extract headings
    const headingRegex = /<h([1-6])>(.*?)<\/h[1-6]>/gi;
    let headingMatch;
    let headingIndex = 0;
    
    while ((headingMatch = headingRegex.exec(html)) !== null) {
      const level = parseInt(headingMatch[1]);
      const text = this.stripHtmlTags(headingMatch[2]);
      
      if (text.trim().length > 0) {
        blocks.push(this.createHeadingBlock(
          text.trim(),
          level,
          { ...baseMetadata, paragraphNumber: ++headingIndex }
        ));
      }
    }

    // Extract paragraphs
    const paragraphRegex = /<p>(.*?)<\/p>/gi;
    let paragraphMatch;
    let paragraphIndex = 0;
    
    while ((paragraphMatch = paragraphRegex.exec(html)) !== null) {
      const text = this.stripHtmlTags(paragraphMatch[1]);
      
      if (text.trim().length >= (config.minParagraphLength || 5)) {
        if (config.detectLists && this.isList(text)) {
          const { items, ordered } = this.parseList(text);
          blocks.push(this.createListBlock(
            items,
            ordered,
            undefined,
            { ...baseMetadata, paragraphNumber: ++paragraphIndex }
          ));
        } else {
          blocks.push(this.createTextBlock(
            text.trim(),
            undefined,
            { ...baseMetadata, paragraphNumber: ++paragraphIndex }
          ));
        }
      }
    }

    // Extract tables if enabled
    if (config.extractTables) {
      const tableBlocks = this.extractTablesFromHtml(html, baseMetadata);
      blocks.push(...tableBlocks);
    }

    return blocks;
  }

  private parseTextStructure(
    text: string,
    config: IDocxParserConfig,
    baseMetadata: TBaseMetadata
  ): TParsedBlock[] {
    const blocks: TParsedBlock[] = [];
    
    // Split into paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    paragraphs.forEach((paragraph, index) => {
      const cleanedParagraph = paragraph.replace(/\s+/g, ' ').trim();
      
      if (cleanedParagraph.length < (config.minParagraphLength || 5)) {
        return;
      }

      const paragraphMetadata: TBaseMetadata = {
        ...baseMetadata,
        paragraphNumber: index + 1,
      };

      // Check if it's a heading
      if (this.isHeading(cleanedParagraph)) {
        const level = this.detectHeadingLevel(cleanedParagraph);
        blocks.push(this.createHeadingBlock(
          cleanedParagraph,
          level,
          paragraphMetadata
        ));
      } else if (config.detectLists && this.isList(cleanedParagraph)) {
        const { items, ordered } = this.parseList(cleanedParagraph);
        blocks.push(this.createListBlock(
          items,
          ordered,
          undefined,
          paragraphMetadata
        ));
      } else {
        blocks.push(this.createTextBlock(
          cleanedParagraph,
          undefined,
          paragraphMetadata
        ));
      }
    });

    return blocks;
  }

  private extractTablesFromHtml(html: string, baseMetadata: TBaseMetadata): TParsedBlock[] {
    const blocks: TParsedBlock[] = [];
    const tableRegex = /<table>(.*?)<\/table>/gis;
    let tableMatch;
    let tableIndex = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableHtml = tableMatch[1];
      const table = this.parseHtmlTable(tableHtml);
      
      if (table.headers.length > 0 || table.rows.length > 0) {
        blocks.push(this.createTableBlock(
          table.headers,
          table.rows,
          `Table ${++tableIndex}`,
          baseMetadata
        ));
      }
    }

    return blocks;
  }

  private parseHtmlTable(tableHtml: string): { headers: string[]; rows: string[][] } {
    const headers: string[] = [];
    const rows: string[][] = [];

    // Extract headers
    const headerRegex = /<th>(.*?)<\/th>/gi;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
      headers.push(this.stripHtmlTags(headerMatch[1]).trim());
    }

    // Extract rows
    const rowRegex = /<tr>(.*?)<\/tr>/gis;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cellRegex = /<td>(.*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(this.stripHtmlTags(cellMatch[1]).trim());
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    return { headers, rows };
  }

  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  private isHeading(text: string): boolean {
    const cleanText = text.trim();
    
    // Check common heading patterns
    const headingPatterns = [
      /^[A-Z][A-Z\s]{5,}$/, // ALL CAPS (shorter than PDF headings)
      /^\d+\.?\s+[A-Z]/, // Numbered sections
      /^[IVX]+\.?\s+[A-Z]/, // Roman numerals
      /^[A-Z][a-z\s]+:$/, // Title with colon
      /^Chapter\s+\d+/i, // Chapter headings
      /^Section\s+\d+/i, // Section headings
    ];
    
    // Check length (headings are usually shorter)
    if (cleanText.length > 80) return false;
    
    // Check if it matches heading patterns
    return headingPatterns.some(pattern => pattern.test(cleanText));
  }

  private detectHeadingLevel(text: string): number {
    const cleanText = text.trim();
    
    // Detect level based on formatting cues
    if (/^[A-Z][A-Z\s]{5,}$/.test(cleanText)) return 1; // ALL CAPS
    if (/^Chapter\s+\d+/i.test(cleanText)) return 1; // Chapters
    if (/^\d+\.?\s+/.test(cleanText)) return 2; // Numbered
    if (/^[IVX]+\.?\s+/.test(cleanText)) return 2; // Roman numerals
    if (/^Section\s+\d+/i.test(cleanText)) return 3; // Sections
    if (/^[A-Z][a-z\s]+:$/.test(cleanText)) return 4; // With colon
    
    return 5; // Default level
  }

  private isList(text: string): boolean {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 2) return false;
    
    // Check for bullet point patterns
    const bulletPatterns = [
      /^[•·▪▫◦‣⁃]\s+/, // Various bullet symbols
      /^[-*+]\s+/, // Dash, asterisk, plus
      /^\d+[.)]\s+/, // Numbered lists
      /^[a-zA-Z][.)]\s+/, // Lettered lists
      /^\([a-zA-Z0-9]+\)\s+/, // Parenthetical lists
    ];
    
    const listLines = lines.filter(line => 
      bulletPatterns.some(pattern => pattern.test(line))
    );
    
    return listLines.length >= Math.ceil(lines.length * 0.6); // 60% of lines are list items
  }

  private parseList(text: string): { items: string[]; ordered: boolean } {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const bulletPatterns = [
      { pattern: /^[•·▪▫◦‣⁃]\s+(.+)/, ordered: false },
      { pattern: /^[-*+]\s+(.+)/, ordered: false },
      { pattern: /^\d+[.)]\s+(.+)/, ordered: true },
      { pattern: /^[a-zA-Z][.)]\s+(.+)/, ordered: true },
      { pattern: /^\([a-zA-Z0-9]+\)\s+(.+)/, ordered: true },
    ];
    
    const items: string[] = [];
    let ordered = false;
    
    lines.forEach(line => {
      for (const { pattern, ordered: isOrdered } of bulletPatterns) {
        const match = line.match(pattern);
        if (match) {
          items.push(match[1].trim());
          if (isOrdered) ordered = true;
          break;
        }
      }
      
      // If no pattern matches but it's part of a list context, add as plain item
      if (items.length > 0 && !bulletPatterns.some(({ pattern }) => pattern.test(line))) {
        // This might be a continuation of the previous item
        if (items.length > 0) {
          items[items.length - 1] += ' ' + line;
        }
      }
    });
    
    return { items, ordered };
  }

  private createSummaryText(text: string): string {
    const textLength = text.length;
    const wordCount = text.split(/\s+/).length;
    const paragraphCount = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    let summary = `DOCX document analysis:\n\n`;
    summary += `Document Statistics:\n`;
    summary += `- Characters: ${textLength.toLocaleString()}\n`;
    summary += `- Words: ${wordCount.toLocaleString()}\n`;
    summary += `- Paragraphs: ${paragraphCount.toLocaleString()}\n\n`;
    
    // Add a preview of the content
    const preview = text.slice(0, 300).trim();
    if (preview.length > 0) {
      summary += `Content Preview:\n${preview}${text.length > 300 ? '...' : ''}`;
    }
    
    return summary;
  }

  async validateFile(buffer: Buffer, mimeType: string): Promise<void> {
    await super.validateFile(buffer, mimeType);

    // Check for ZIP signature (DOCX files are ZIP archives)
    const signature = buffer.slice(0, 4);
    const zipSignatures = [
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // Standard ZIP
      Buffer.from([0x50, 0x4b, 0x05, 0x06]), // Empty ZIP
      Buffer.from([0x50, 0x4b, 0x07, 0x08]), // Spanned ZIP
    ];

    const hasValidSignature = zipSignatures.some(sig => sig.equals(signature));
    if (!hasValidSignature) {
      throw new Error('File does not have a valid DOCX/ZIP signature');
    }

    // Check minimum file size (DOCX files should be at least a few KB)
    if (buffer.length < 1000) {
      throw new Error('File is too small to be a valid DOCX document');
    }

    // Try to verify it's actually a DOCX by looking for Office content
    const fileContent = buffer.toString('utf-8', 0, Math.min(2000, buffer.length));
    if (!fileContent.includes('word/') && !fileContent.includes('xl/') && !fileContent.includes('ppt/')) {
      // Might not be an Office document, but we'll try to parse it anyway
    }
  }

  // Utility method to extract only text without formatting
  static async extractPlainText(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to extract plain text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility method to convert to HTML
  static async convertToHtml(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to convert to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}