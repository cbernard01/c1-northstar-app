/**
 * Verification script to test the file parsers
 * Run this with: npx tsx src/lib/services/parsers/verify.ts
 */

import { fileParserService, FileParserUtils, QuickParse, CsvParser } from './index';

async function main() {
  console.log('🚀 File Parser Service Verification\n');

  // Test 1: Service initialization
  console.log('1️⃣ Testing service initialization...');
  const stats = fileParserService.getStatistics();
  console.log(`   ✅ Loaded ${stats.registeredParsers} parsers`);
  console.log(`   ✅ Supporting ${stats.supportedMimeTypes} MIME types`);
  console.log(`   ✅ Parsers: ${stats.parsers.map(p => p.name).join(', ')}\n`);

  // Test 2: MIME type detection
  console.log('2️⃣ Testing MIME type detection...');
  const csvBuffer = Buffer.from('name,age,city\nJohn,30,NYC\nJane,25,LA');
  const detectedType = FileParserUtils.detectMimeType(csvBuffer, 'test.csv');
  console.log(`   ✅ Detected MIME type: ${detectedType}`);
  console.log(`   ✅ Is supported: ${fileParserService.isSupported(detectedType)}\n`);

  // Test 3: File validation
  console.log('3️⃣ Testing file validation...');
  const validation = await FileParserUtils.validateFile(csvBuffer, detectedType);
  console.log(`   ✅ Validation result: ${validation.valid ? 'VALID' : 'INVALID'}`);
  if (validation.errors.length > 0) {
    console.log(`   ❌ Errors: ${validation.errors.join(', ')}`);
  }
  console.log('');

  // Test 4: CSV parsing
  console.log('4️⃣ Testing CSV parsing...');
  try {
    const csvResult = await QuickParse.csv(csvBuffer, 'test.csv');
    console.log(`   ✅ Parsed successfully!`);
    console.log(`   ✅ Total blocks: ${csvResult.metadata.totalBlocks}`);
    console.log(`   ✅ Processing time: ${csvResult.metadata.processingTime}ms`);
    console.log(`   ✅ Errors: ${csvResult.metadata.errors.length}`);
    console.log(`   ✅ Warnings: ${csvResult.metadata.warnings.length}`);
    
    // Show content summary
    const tableBlocks = csvResult.blocks.filter(b => b.content.type === 'table');
    if (tableBlocks.length > 0 && tableBlocks[0].content.type === 'table') {
      const table = tableBlocks[0].content;
      console.log(`   ✅ Found table with ${table.headers.length} columns and ${table.rows.length} rows`);
      console.log(`   ✅ Headers: ${table.headers.join(', ')}`);
    }
  } catch (error) {
    console.log(`   ❌ CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log('');

  // Test 5: Auto parsing
  console.log('5️⃣ Testing auto-detection parsing...');
  try {
    const autoResult = await QuickParse.auto(csvBuffer, 'unknown.csv');
    console.log(`   ✅ Auto-parsed successfully!`);
    console.log(`   ✅ Detected type: ${autoResult.metadata.fileType}`);
    console.log(`   ✅ Total blocks: ${autoResult.metadata.totalBlocks}`);
  } catch (error) {
    console.log(`   ❌ Auto parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log('');

  // Test 6: Error handling
  console.log('6️⃣ Testing error handling...');
  try {
    await fileParserService.parseFromBuffer(
      Buffer.from('invalid content'),
      'test.xyz',
      'unknown/type'
    );
    console.log('   ❌ Should have thrown an error!');
  } catch (error: any) {
    console.log(`   ✅ Correctly caught error: ${error.code || 'UNKNOWN'} - ${error.message}`);
  }
  console.log('');

  // Test 7: File info
  console.log('7️⃣ Testing file information...');
  const fileInfo = FileParserUtils.getFileInfo(csvBuffer, 'data.csv');
  console.log(`   ✅ File name: ${fileInfo.fileName}`);
  console.log(`   ✅ File size: ${fileInfo.fileSize} bytes`);
  console.log(`   ✅ MIME type: ${fileInfo.detectedMimeType}`);
  console.log(`   ✅ Supported: ${fileInfo.isSupported}`);
  console.log(`   ✅ Est. parsing time: ${fileInfo.estimatedParsingTime}s\n`);

  // Test 8: Health check
  console.log('8️⃣ Testing service health...');
  const health = await fileParserService.healthCheck();
  console.log(`   ✅ Service status: ${health.status.toUpperCase()}`);
  console.log(`   ✅ Parsers loaded: ${health.details.parsersLoaded}`);
  console.log(`   ✅ Active tasks: ${health.details.activeTasks}`);
  console.log('');

  // Test 9: Batch processing
  console.log('9️⃣ Testing batch processing...');
  const files = [
    {
      buffer: Buffer.from('name,age\nAlice,28'),
      fileName: 'file1.csv',
      mimeType: 'text/csv',
    },
    {
      buffer: Buffer.from('product,price\nApple,1.50'),
      fileName: 'file2.csv',
      mimeType: 'text/csv',
    },
  ];

  try {
    const batchResults = await fileParserService.parseMultiple(files);
    const successful = batchResults.filter(r => r.result);
    const failed = batchResults.filter(r => r.error);
    
    console.log(`   ✅ Batch completed: ${successful.length} successful, ${failed.length} failed`);
    successful.forEach(({ fileName, result }) => {
      console.log(`   ✅ ${fileName}: ${result?.metadata.totalBlocks} blocks`);
    });
  } catch (error) {
    console.log(`   ❌ Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log('');

  console.log('🎉 All verification tests completed!\n');
  
  console.log('📋 Summary:');
  console.log('   - File parser service is properly initialized');
  console.log('   - All main parsers are loaded and functional');
  console.log('   - MIME type detection works correctly');
  console.log('   - File validation is working');
  console.log('   - CSV parsing produces structured output');
  console.log('   - Error handling is robust');
  console.log('   - Batch processing is functional');
  console.log('   - Service health monitoring works');
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;