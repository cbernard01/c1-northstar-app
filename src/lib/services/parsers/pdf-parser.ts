import pdf from 'pdf-parse';
import { 
  BaseFileParser, 
  IParserConfig, 
  TParserResult, 
  TParsedBlock,
  TBaseMetadata 
} from './file-parser.interface';

export interface IPdfParserConfig extends IParserConfig {
  pageRange?: { start?: number; end?: number };
  extractImages?: boolean;
  preserveLayout?: boolean;
  minLineLength?: number;
  mergeLines?: boolean;
  detectHeadings?: boolean;
  detectLists?: boolean;
}

export interface IPdfTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

export class PdfParser extends BaseFileParser {
  readonly name = 'PDF Parser';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = [
    'application/pdf',
  ];

  protected getFeatures(): string[] {
    return [
      'Text extraction',
      'Page-based parsing',
      'Heading detection',
      'List detection',
      'Layout preservation',
      'Metadata extraction',
      'Page range support',
    ];
  }

  async parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IPdfParserConfig
  ): Promise<TParserResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await this.validateFile(buffer, mimeType);

      const pdfConfig: IPdfParserConfig = {
        extractImages: false,
        preserveLayout: true,
        minLineLength: 3,
        mergeLines: true,
        detectHeadings: true,
        detectLists: true,
        ...config,
      };

      const pdfData = await this.parsePdfBuffer(buffer, pdfConfig);
      
      if (!pdfData.text || pdfData.text.trim().length === 0) {
        warnings.push('No text content found in PDF');
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

      const blocks = await this.createBlocksFromPdfData(pdfData, pdfConfig);
      
      if (pdfData.numpages > 1) {
        warnings.push(`PDF contains ${pdfData.numpages} pages`);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown PDF parsing error';
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

  private async parsePdfBuffer(
    buffer: Buffer,
    config: IPdfParserConfig
  ): Promise<any> {
    const options: any = {
      normalizeWhitespace: true,
      disableCombineTextItems: !config.mergeLines,
    };

    // Add page range if specified
    if (config.pageRange) {
      if (config.pageRange.start) options.min = config.pageRange.start;
      if (config.pageRange.end) options.max = config.pageRange.end;
    }

    try {
      const data = await pdf(buffer, options);
      return data;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createBlocksFromPdfData(
    pdfData: any,
    config: IPdfParserConfig
  ): Promise<TParsedBlock[]> {
    const blocks: TParsedBlock[] = [];
    const text = pdfData.text;
    
    // Create document metadata
    const documentMetadata: TBaseMetadata = {
      source: 'pdf-parser',
      confidence: 0.9,
    };

    // Add document summary block
    const summaryText = this.createSummaryText(pdfData);
    blocks.push(this.createTextBlock(
      summaryText,
      'PDF Document Summary',
      documentMetadata
    ));

    // Split text into logical sections
    const sections = this.splitIntoSections(text, config);
    
    sections.forEach((section, index) => {
      const sectionMetadata: TBaseMetadata = {
        ...documentMetadata,
        pageNumber: section.pageNumber,
        paragraphNumber: index + 1,
      };

      if (config.detectHeadings && this.isHeading(section.text)) {
        const level = this.detectHeadingLevel(section.text);
        blocks.push(this.createHeadingBlock(
          section.text.trim(),
          level,
          sectionMetadata
        ));
      } else if (config.detectLists && this.isList(section.text)) {
        const { items, ordered } = this.parseList(section.text);
        blocks.push(this.createListBlock(
          items,
          ordered,
          undefined,
          sectionMetadata
        ));
      } else if (section.text.trim().length >= (config.minLineLength || 3)) {
        blocks.push(this.createTextBlock(
          section.text.trim(),
          section.title,
          sectionMetadata
        ));
      }
    });

    // If no meaningful sections found, create page-based blocks
    if (blocks.length <= 1 && pdfData.numpages > 1) {
      const pageBlocks = this.createPageBasedBlocks(text, pdfData.numpages, documentMetadata);
      blocks.push(...pageBlocks);
    }

    return blocks;
  }

  private splitIntoSections(text: string, config: IPdfParserConfig): Array<{
    text: string;
    title?: string;
    pageNumber?: number;
  }> {
    // Split by double line breaks first
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    const sections: Array<{ text: string; title?: string; pageNumber?: number }> = [];
    let currentPageNumber = 1;
    
    paragraphs.forEach(paragraph => {
      const cleanedParagraph = paragraph.replace(/\s+/g, ' ').trim();
      
      if (cleanedParagraph.length === 0) return;
      
      // Estimate page number (this is a rough estimate)
      const estimatedPage = Math.ceil(sections.length / 10) + 1;
      
      // Check if this looks like a new section/heading
      const lines = paragraph.split('\n');
      let title: string | undefined;
      
      if (lines.length > 1) {
        const firstLine = lines[0].trim();
        if (this.isHeading(firstLine)) {
          title = firstLine;
        }
      }
      
      sections.push({
        text: cleanedParagraph,
        title,
        pageNumber: estimatedPage,
      });
    });

    return sections;
  }

  private createPageBasedBlocks(
    text: string,
    numPages: number,
    baseMetadata: TBaseMetadata
  ): TParsedBlock[] {
    const blocks: TParsedBlock[] = [];
    const averageCharsPerPage = Math.ceil(text.length / numPages);
    
    for (let page = 1; page <= numPages; page++) {
      const startIndex = (page - 1) * averageCharsPerPage;
      const endIndex = Math.min(page * averageCharsPerPage, text.length);
      const pageText = text.slice(startIndex, endIndex).trim();
      
      if (pageText.length > 0) {
        blocks.push(this.createTextBlock(
          pageText,
          `Page ${page}`,
          { ...baseMetadata, pageNumber: page }
        ));
      }
    }
    
    return blocks;
  }

  private isHeading(text: string): boolean {
    const cleanText = text.trim();
    
    // Check common heading patterns
    const headingPatterns = [
      /^[A-Z][A-Z\s]{10,}$/, // ALL CAPS
      /^\d+\.?\s+[A-Z]/, // Numbered sections
      /^[IVX]+\.?\s+[A-Z]/, // Roman numerals
      /^[A-Z][a-z\s]+:$/, // Title with colon
      /^[A-Z][^.!?]*$/, // Sentence case without punctuation
    ];
    
    // Check length (headings are usually shorter)
    if (cleanText.length > 100) return false;
    
    // Check if it matches heading patterns
    return headingPatterns.some(pattern => pattern.test(cleanText));
  }

  private detectHeadingLevel(text: string): number {
    const cleanText = text.trim();
    
    // Detect level based on formatting cues
    if (/^[A-Z][A-Z\s]{10,}$/.test(cleanText)) return 1; // ALL CAPS
    if (/^\d+\.?\s+/.test(cleanText)) return 2; // Numbered
    if (/^[IVX]+\.?\s+/.test(cleanText)) return 2; // Roman numerals
    if (/^[A-Z][a-z\s]+:$/.test(cleanText)) return 3; // With colon
    
    return 4; // Default level
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
    });
    
    return { items, ordered };
  }

  private createSummaryText(pdfData: any): string {
    let summary = `PDF document contains ${pdfData.numpages} page(s).\n\n`;
    
    // Add metadata if available
    if (pdfData.info) {
      const info = pdfData.info;
      if (info.Title) summary += `Title: ${info.Title}\n`;
      if (info.Author) summary += `Author: ${info.Author}\n`;
      if (info.Subject) summary += `Subject: ${info.Subject}\n`;
      if (info.Creator) summary += `Creator: ${info.Creator}\n`;
      if (info.Producer) summary += `Producer: ${info.Producer}\n`;
      if (info.CreationDate) summary += `Created: ${info.CreationDate}\n`;
      if (info.ModDate) summary += `Modified: ${info.ModDate}\n`;
      summary += '\n';
    }
    
    // Add text statistics
    const textLength = pdfData.text.length;
    const wordCount = pdfData.text.split(/\s+/).length;
    const lineCount = pdfData.text.split('\n').length;
    
    summary += `Text Statistics:\n`;
    summary += `- Characters: ${textLength.toLocaleString()}\n`;
    summary += `- Words: ${wordCount.toLocaleString()}\n`;
    summary += `- Lines: ${lineCount.toLocaleString()}\n`;
    
    // Add a preview of the content
    const preview = pdfData.text.slice(0, 300).trim();
    if (preview.length > 0) {
      summary += `\nContent Preview:\n${preview}${pdfData.text.length > 300 ? '...' : ''}`;
    }
    
    return summary;
  }

  async validateFile(buffer: Buffer, mimeType: string): Promise<void> {
    await super.validateFile(buffer, mimeType);

    // Check PDF signature
    const signature = buffer.slice(0, 5).toString('ascii');
    if (!signature.startsWith('%PDF-')) {
      throw new Error('File does not have a valid PDF signature');
    }

    // Check for PDF version
    const version = buffer.slice(5, 8).toString('ascii');
    const supportedVersions = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '2.0'];
    if (!supportedVersions.includes(version)) {
      throw new Error(`Unsupported PDF version: ${version}`);
    }

    // Check minimum file size (PDFs should be at least a few hundred bytes)
    if (buffer.length < 200) {
      throw new Error('File is too small to be a valid PDF');
    }
  }

  // Utility method to extract metadata only
  static async extractMetadata(buffer: Buffer): Promise<any> {
    try {
      const data = await pdf(buffer, { max: 1 }); // Only parse first page for metadata
      return data.info || {};
    } catch (error) {
      throw new Error(`Failed to extract PDF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility method to get page count without full parsing
  static async getPageCount(buffer: Buffer): Promise<number> {
    try {
      const data = await pdf(buffer, { max: 1 });
      return data.numpages;
    } catch (error) {
      throw new Error(`Failed to get PDF page count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}