import { NextRequest, NextResponse } from 'next/server';
 
import { auth } from '@/lib/auth';

import type { Session } from 'next-auth';

export interface AuthenticatedRequest extends NextRequest {
  user: Session['user'];
  session: Session;
}

// Authentication middleware
export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse | Response> | NextResponse | Response
) {
  return async (req: NextRequest) => {
    try {
      const session = await auth();
      
      if (!session || !session.user) {
        return NextResponse.json(
          { 
            error: 'Unauthorized',
            message: 'Authentication required'
          },
          { status: 401 }
        );
      }

      // Attach user and session to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = session.user;
      authenticatedReq.session = session;

      return handler(authenticatedReq);
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          message: 'Authentication failed'
        },
        { status: 500 }
      );
    }
  };
}

// Optional authentication middleware (for public endpoints that can benefit from user context)
export function withOptionalAuth(
  handler: (req: NextRequest, user?: Session['user']) => Promise<NextResponse | Response> | NextResponse | Response
) {
  return async (req: NextRequest) => {
    try {
      const session = await auth();
      return handler(req, session?.user);
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      return handler(req, undefined);
    }
  };
}

// Role-based authorization middleware
export function withRoles(roles: string[]) {
  return function (
    handler: (req: AuthenticatedRequest) => Promise<NextResponse> | NextResponse
  ) {
    return withAuth(async (req: AuthenticatedRequest) => {
      const userRole = req.user?.role || 'user';
      
      if (!roles.includes(userRole)) {
        return NextResponse.json(
          { 
            error: 'Forbidden',
            message: 'Insufficient permissions'
          },
          { status: 403 }
        );
      }

      return handler(req);
    });
  };
}

// Extract user ID from authenticated request
export function getUserId(req: AuthenticatedRequest): string {
  if (!req.user?.id) {
    throw new Error('User ID not found in authenticated request');
  }
  return req.user.id;
}

// Check if user owns resource
export async function checkResourceOwnership(
  userId: string,
  resourceId: string,
  resourceType: 'job' | 'upload' | 'chat'
): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma');
  
  try {
    switch (resourceType) {
      case 'job':
        const job = await prisma.job.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return job?.userId === userId;
        
      case 'upload':
        const upload = await prisma.upload.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return upload?.userId === userId;
        
      case 'chat':
        const chatSession = await prisma.chatSession.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return chatSession?.userId === userId;
        
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking resource ownership:', error);
    return false;
  }
}