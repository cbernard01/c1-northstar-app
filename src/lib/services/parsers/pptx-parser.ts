import { 
  BaseFileParser, 
  IParserConfig, 
  TParserResult, 
  TParsedBlock,
  TBaseMetadata 
} from './file-parser.interface';

// Note: pptx2json doesn't have proper TypeScript types, so we'll define our own
declare module 'pptx2json' {
  interface SlideText {
    text: string;
    type: string;
    level?: number;
  }

  interface Slide {
    slide: number;
    texts: SlideText[];
    images?: any[];
    tables?: any[];
  }

  interface PptxData {
    slides: Slide[];
    slideCount: number;
  }

  function parse(buffer: Buffer): Promise<PptxData>;
}

export interface IPptxParserConfig extends IParserConfig {
  extractImages?: boolean;
  extractTables?: boolean;
  extractNotes?: boolean;
  combineSlides?: boolean;
  minTextLength?: number;
  detectTitles?: boolean;
  includeSlideNumbers?: boolean;
}

export interface IPptxSlideContent {
  slideNumber: number;
  title?: string;
  content: string[];
  notes?: string;
  images?: any[];
  tables?: any[];
}

export class PptxParser extends BaseFileParser {
  readonly name = 'PPTX Parser';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint', // Legacy .ppt files (limited support)
  ];

  protected getFeatures(): string[] {
    return [
      'Slide text extraction',
      'Title detection',
      'Bullet point extraction',
      'Table extraction',
      'Image extraction',
      'Speaker notes',
      'Slide-by-slide parsing',
      'Content combination',
    ];
  }

  async parseFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    config?: IPptxParserConfig
  ): Promise<TParserResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await this.validateFile(buffer, mimeType);

      const pptxConfig: IPptxParserConfig = {
        extractImages: false,
        extractTables: true,
        extractNotes: false,
        combineSlides: false,
        minTextLength: 3,
        detectTitles: true,
        includeSlideNumbers: true,
        ...config,
      };

      const pptxData = await this.parsePptxBuffer(buffer, pptxConfig);
      
      if (!pptxData.slides || pptxData.slides.length === 0) {
        warnings.push('No slides found in PPTX file');
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

      const blocks = await this.createBlocksFromPptxData(pptxData, pptxConfig);
      
      if (pptxData.slideCount > 0) {
        warnings.push(`Presentation contains ${pptxData.slideCount} slide(s)`);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown PPTX parsing error';
      errors.push(errorMessage);
      
      // Fallback: Try basic ZIP-based text extraction
      try {
        const fallbackBlocks = await this.fallbackTextExtraction(buffer, fileName);
        if (fallbackBlocks.length > 0) {
          warnings.push('Used fallback text extraction method');
          return this.createParserResult(
            fallbackBlocks,
            fileName,
            buffer.length,
            mimeType,
            Date.now() - startTime,
            errors,
            warnings
          );
        }
      } catch (fallbackError) {
        errors.push(`Fallback extraction also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
      
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

  private async parsePptxBuffer(
    buffer: Buffer,
    config: IPptxParserConfig
  ): Promise<any> {
    try {
      // First, try using pptx2json if available
      let pptx2json;
      try {
        pptx2json = require('pptx2json');
      } catch (importError) {
        throw new Error('pptx2json library not available');
      }

      const data = await pptx2json.parse(buffer);
      return data;
    } catch (error) {
      throw new Error(`PPTX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createBlocksFromPptxData(
    pptxData: any,
    config: IPptxParserConfig
  ): Promise<TParsedBlock[]> {
    const blocks: TParsedBlock[] = [];
    
    // Create document metadata
    const documentMetadata: TBaseMetadata = {
      source: 'pptx-parser',
      confidence: 0.9,
    };

    // Add presentation summary block
    const summaryText = this.createSummaryText(pptxData);
    blocks.push(this.createTextBlock(
      summaryText,
      'PPTX Presentation Summary',
      documentMetadata
    ));

    // Process each slide
    if (pptxData.slides && Array.isArray(pptxData.slides)) {
      const slideContents = this.extractSlideContents(pptxData.slides, config);
      
      if (config.combineSlides) {
        // Combine all slides into fewer blocks
        const combinedBlocks = this.createCombinedBlocks(slideContents, documentMetadata);
        blocks.push(...combinedBlocks);
      } else {
        // Create individual blocks for each slide
        slideContents.forEach(slide => {
          const slideBlocks = this.createSlideBlocks(slide, documentMetadata, config);
          blocks.push(...slideBlocks);
        });
      }
    }

    return blocks;
  }

  private extractSlideContents(slides: any[], config: IPptxParserConfig): IPptxSlideContent[] {
    return slides.map(slide => {
      const slideNumber = slide.slide || 0;
      const texts = slide.texts || [];
      
      // Extract title (usually the first text or text with type 'title')
      let title: string | undefined;
      const contentTexts: string[] = [];
      
      texts.forEach((textItem: any) => {
        const text = textItem.text ? textItem.text.trim() : '';
        if (text.length < (config.minTextLength || 3)) return;
        
        if (config.detectTitles && !title && (
          textItem.type === 'title' || 
          textItem.type === 'ctrTitle' ||
          (textItem.level === 0 || textItem.level === 1)
        )) {
          title = text;
        } else {
          contentTexts.push(text);
        }
      });

      return {
        slideNumber,
        title,
        content: contentTexts,
        notes: slide.notes,
        images: config.extractImages ? slide.images : undefined,
        tables: config.extractTables ? slide.tables : undefined,
      };
    });
  }

  private createSlideBlocks(
    slide: IPptxSlideContent,
    baseMetadata: TBaseMetadata,
    config: IPptxParserConfig
  ): TParsedBlock[] {
    const blocks: TParsedBlock[] = [];
    const slideMetadata = {
      ...baseMetadata,
      slideNumber: slide.slideNumber,
    };

    // Add slide title as heading if present
    if (slide.title) {
      blocks.push(this.createHeadingBlock(
        slide.title,
        1,
        slideMetadata
      ));
    }

    // Add slide content
    if (slide.content.length > 0) {
      if (this.isListContent(slide.content)) {
        // Create as list block
        blocks.push(this.createListBlock(
          slide.content,
          false, // PowerPoint bullets are usually unordered
          slide.title ? undefined : `Slide ${slide.slideNumber} Content`,
          slideMetadata
        ));
      } else {
        // Create as text block
        const combinedContent = slide.content.join('\n');
        blocks.push(this.createTextBlock(
          combinedContent,
          slide.title ? undefined : `Slide ${slide.slideNumber} Content`,
          slideMetadata
        ));
      }
    }

    // Add tables if present
    if (slide.tables && slide.tables.length > 0 && config.extractTables) {
      slide.tables.forEach((table: any, index: number) => {
        const tableBlock = this.createTableFromPptxTable(table, slideMetadata, index);
        if (tableBlock) {
          blocks.push(tableBlock);
        }
      });
    }

    // Add speaker notes if present
    if (slide.notes && config.extractNotes) {
      blocks.push(this.createTextBlock(
        slide.notes,
        `Slide ${slide.slideNumber} Notes`,
        { ...slideMetadata, source: 'speaker-notes' }
      ));
    }

    return blocks;
  }

  private createCombinedBlocks(
    slides: IPptxSlideContent[],
    baseMetadata: TBaseMetadata
  ): TParsedBlock[] {
    const blocks: TParsedBlock[] = [];
    
    // Combine all titles
    const titles = slides.filter(slide => slide.title).map(slide => slide.title!);
    if (titles.length > 0) {
      blocks.push(this.createListBlock(
        titles,
        false,
        'Presentation Titles',
        baseMetadata
      ));
    }

    // Combine all content
    const allContent: string[] = [];
    slides.forEach(slide => {
      if (slide.content.length > 0) {
        allContent.push(...slide.content);
      }
    });

    if (allContent.length > 0) {
      if (this.isListContent(allContent)) {
        blocks.push(this.createListBlock(
          allContent,
          false,
          'Presentation Content',
          baseMetadata
        ));
      } else {
        blocks.push(this.createTextBlock(
          allContent.join('\n\n'),
          'Presentation Content',
          baseMetadata
        ));
      }
    }

    return blocks;
  }

  private isListContent(content: string[]): boolean {
    if (content.length < 2) return false;
    
    // Check if most items look like bullet points
    const bulletLikeCount = content.filter(item => 
      item.length < 200 && // Reasonable length for bullet points
      !item.includes('\n') && // Single line
      item.match(/^[A-Z]/) // Starts with capital letter
    ).length;
    
    return bulletLikeCount >= Math.ceil(content.length * 0.7); // 70% look like bullets
  }

  private createTableFromPptxTable(table: any, metadata: TBaseMetadata, index: number): TParsedBlock | null {
    try {
      // This is a simplified table extraction - the actual structure depends on pptx2json output
      if (!table.rows || !Array.isArray(table.rows)) {
        return null;
      }

      const headers: string[] = [];
      const rows: string[][] = [];

      table.rows.forEach((row: any, rowIndex: number) => {
        if (!row.cells || !Array.isArray(row.cells)) return;
        
        const cellTexts = row.cells.map((cell: any) => 
          typeof cell === 'string' ? cell : (cell.text || '')
        );

        if (rowIndex === 0 && this.looksLikeHeaders(cellTexts)) {
          headers.push(...cellTexts);
        } else {
          rows.push(cellTexts);
        }
      });

      if (headers.length === 0 && rows.length > 0) {
        // Use first row as headers if no headers detected
        const firstRow = rows.shift();
        if (firstRow) {
          headers.push(...firstRow);
        }
      }

      if (headers.length > 0 || rows.length > 0) {
        return this.createTableBlock(
          headers,
          rows,
          `Table ${index + 1}`,
          metadata
        );
      }

      return null;
    } catch (error) {
      return null; // Skip malformed tables
    }
  }

  private looksLikeHeaders(cells: string[]): boolean {
    return cells.some(cell => 
      cell.trim().length > 0 && 
      cell.trim().length < 50 && 
      !cell.includes('\n')
    );
  }

  private createSummaryText(pptxData: any): string {
    const slideCount = pptxData.slideCount || (pptxData.slides ? pptxData.slides.length : 0);
    
    let summary = `PowerPoint presentation contains ${slideCount} slide(s).\n\n`;
    
    if (pptxData.slides && pptxData.slides.length > 0) {
      // Count total text elements
      let totalTexts = 0;
      let totalTables = 0;
      let totalImages = 0;
      
      pptxData.slides.forEach((slide: any) => {
        if (slide.texts) totalTexts += slide.texts.length;
        if (slide.tables) totalTables += slide.tables.length;
        if (slide.images) totalImages += slide.images.length;
      });
      
      summary += `Content Summary:\n`;
      summary += `- Text elements: ${totalTexts}\n`;
      summary += `- Tables: ${totalTables}\n`;
      summary += `- Images: ${totalImages}\n\n`;
      
      // Add slide titles if available
      const titles = pptxData.slides
        .map((slide: any) => slide.texts ? slide.texts.find((t: any) => t.type === 'title' || t.level === 0)?.text : null)
        .filter((title: string | null) => title && title.trim().length > 0);
      
      if (titles.length > 0) {
        summary += `Slide Titles:\n`;
        titles.slice(0, 5).forEach((title: string, index: number) => {
          summary += `${index + 1}. ${title}\n`;
        });
        if (titles.length > 5) {
          summary += `... and ${titles.length - 5} more slides\n`;
        }
      }
    }
    
    return summary;
  }

  private async fallbackTextExtraction(buffer: Buffer, fileName: string): TParsedBlock[] {
    // Simple fallback: try to extract XML content from the ZIP structure
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      
      const textContents: string[] = [];
      
      entries.forEach((entry: any) => {
        if (entry.entryName.includes('slide') && entry.entryName.endsWith('.xml')) {
          const content = entry.getData().toString('utf8');
          // Extract text between XML tags (very basic)
          const textMatches = content.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
          if (textMatches) {
            textMatches.forEach(match => {
              const text = match.replace(/<[^>]+>/g, '').trim();
              if (text.length > 0) {
                textContents.push(text);
              }
            });
          }
        }
      });
      
      if (textContents.length > 0) {
        return [this.createTextBlock(
          textContents.join('\n'),
          'Extracted PPTX Content (Fallback)',
          { source: 'fallback-extraction', confidence: 0.6 }
        )];
      }
      
      return [];
    } catch (error) {
      throw new Error(`Fallback extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateFile(buffer: Buffer, mimeType: string): Promise<void> {
    await super.validateFile(buffer, mimeType);

    // Check for ZIP signature (PPTX files are ZIP archives)
    const signature = buffer.slice(0, 4);
    const zipSignatures = [
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // Standard ZIP
      Buffer.from([0x50, 0x4b, 0x05, 0x06]), // Empty ZIP
      Buffer.from([0x50, 0x4b, 0x07, 0x08]), // Spanned ZIP
    ];

    const hasValidSignature = zipSignatures.some(sig => sig.equals(signature));
    if (!hasValidSignature) {
      throw new Error('File does not have a valid PPTX/ZIP signature');
    }

    // Check minimum file size (PPTX files should be at least a few KB)
    if (buffer.length < 2000) {
      throw new Error('File is too small to be a valid PPTX presentation');
    }

    // Try to verify it's actually a PPTX by looking for PowerPoint content
    const fileContent = buffer.toString('utf-8', 0, Math.min(5000, buffer.length));
    if (!fileContent.includes('ppt/') && !fileContent.includes('presentation')) {
      // Might not be a PowerPoint document, but we'll try to parse it anyway
    }
  }

  // Utility method to get slide count without full parsing
  static async getSlideCount(buffer: Buffer): Promise<number> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      
      const slideEntries = entries.filter((entry: any) => 
        entry.entryName.match(/ppt\/slides\/slide\d+\.xml/)
      );
      
      return slideEntries.length;
    } catch (error) {
      throw new Error(`Failed to get slide count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility method to extract only slide titles
  static async extractTitles(buffer: Buffer): Promise<string[]> {
    try {
      const parser = new PptxParser();
      const result = await parser.parseFromBuffer(buffer, 'temp.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', {
        combineSlides: false,
        detectTitles: true,
        minTextLength: 1,
      });
      
      return result.blocks
        .filter(block => block.content.type === 'heading')
        .map(block => block.content.type === 'heading' ? block.content.text : '')
        .filter(title => title.length > 0);
    } catch (error) {
      throw new Error(`Failed to extract titles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}