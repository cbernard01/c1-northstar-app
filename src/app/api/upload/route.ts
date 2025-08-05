import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler, ValidationError } from '@/lib/middleware/error-handler';
import { withUploadRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';
import { QueueManager } from '@/lib/queue';
import { FileProcessor } from '@/lib/services/file-processor';

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

// POST /api/upload - Simple file upload
export const POST = withErrorHandler(
  withUploadRateLimit(
    withAuth(async (req) => {
      const userId = getUserId(req);

      try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const metadata = formData.get('metadata') as string;

        if (!file) {
          throw new ValidationError('No file provided');
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          throw new ValidationError('File size exceeds maximum limit of 50MB');
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new ValidationError(`Unsupported file type: ${file.type}`);
        }

        // Parse metadata if provided
        let parsedMetadata = {};
        if (metadata) {
          try {
            parsedMetadata = JSON.parse(metadata);
          } catch (error) {
            throw new ValidationError('Invalid metadata format');
          }
        }

        // Create upload directory if it doesn't exist
        const uploadDir = join(process.cwd(), 'uploads', userId);
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = FileProcessor.getFileExtension(file.type);
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = join(uploadDir, fileName);

        // Save file to filesystem
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Create upload record in database
        const upload = await prisma.upload.create({
          data: {
            fileName,
            originalName: file.name,
            fileSize: file.size,
            fileType: file.type,
            userId,
            metadata: {
              ...parsedMetadata,
              filePath,
              uploadTimestamp: timestamp,
            },
          },
        });

        // Create processing job
        const job = await prisma.job.create({
          data: {
            type: 'FILE_PROCESSING',
            title: `Process ${file.name}`,
            description: `Processing uploaded file: ${file.name}`,
            userId,
            metadata: {
              uploadId: upload.id,
              fileName: file.name,
              fileType: file.type,
              filePath,
            },
          },
        });

        // Link upload to job
        await prisma.upload.update({
          where: { id: upload.id },
          data: { jobId: job.id },
        });

        // Add to processing queue
        try {
          await QueueManager.addFileProcessingJob(
            {
              uploadId: upload.id,
              userId,
              fileName: file.name,
              fileType: file.type,
              filePath,
            },
            job.id
          );
        } catch (queueError) {
          console.error('Failed to add file processing job to queue:', queueError);
          // Update job status to failed
          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              errorMessage: 'Failed to queue file for processing',
            },
          });
        }

        return NextResponse.json({
          fileId: upload.id,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: upload.createdAt.toISOString(),
          processingJobId: job.id,
        }, { status: 201 });

      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        console.error('Upload error:', error);
        throw new Error('Failed to process upload');
      }
    })
  )
);