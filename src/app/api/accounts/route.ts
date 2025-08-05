import { NextRequest, NextResponse } from 'next/server';

import { withAuth, getUserId } from '@/lib/middleware/auth';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withAccountsRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/prisma';
import { createAccountSchema, accountQuerySchema } from '@/lib/validations/account';

// GET /api/accounts - List accounts with search and filtering
const getHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const url = new URL(req.url);
      const params = Object.fromEntries(url.searchParams.entries());
      
      const {
        page,
        pageSize,
        search,
        industry,
        size,
        location,
        technology,
        sortBy,
        sortOrder,
        includeFacets,
      } = accountQuerySchema.parse(params);

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { domain: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      if (industry) {
        where.industry = { equals: industry, mode: 'insensitive' };
      }
      
      if (size) {
        where.size = size;
      }
      
      if (location) {
        where.location = { contains: location, mode: 'insensitive' };
      }
      
      if (technology) {
        where.technologies = {
          some: {
            name: { contains: technology, mode: 'insensitive' },
          },
        };
      }

      // Build order by clause
      const orderBy = { [sortBy]: sortOrder };

      // Get accounts and total count
      const [accounts, total] = await Promise.all([
        prisma.companyAccount.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          include: {
            technologies: {
              select: {
                id: true,
                name: true,
                category: true,
                confidence: true,
              },
              take: 10, // Limit technologies to avoid large responses
            },
            insights: {
              select: {
                id: true,
                type: true,
                title: true,
                confidence: true,
                isBookmarked: true,
              },
              take: 5, // Limit insights to avoid large responses
              orderBy: { createdAt: 'desc' },
            },
            contacts: {
              select: {
                id: true,
                name: true,
                title: true,
                email: true,
              },
              take: 5, // Limit contacts
            },
            _count: {
              select: {
                technologies: true,
                insights: true,
                contacts: true,
              },
            },
          },
        }),
        prisma.companyAccount.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      // Build response
      const response: any = {
        accounts,
        total,
        page,
        pageSize,
        totalPages,
      };

      // Add facets if requested
      if (includeFacets) {
        const [industries, sizes, locations, technologies] = await Promise.all([
          // Industries
          prisma.companyAccount.groupBy({
            by: ['industry'],
            where: { industry: { not: null } },
            _count: { industry: true },
            orderBy: { _count: { industry: 'desc' } },
            take: 20,
          }),
          // Sizes
          prisma.companyAccount.groupBy({
            by: ['size'],
            where: { size: { not: null } },
            _count: { size: true },
            orderBy: { _count: { size: 'desc' } },
          }),
          // Locations
          prisma.companyAccount.groupBy({
            by: ['location'],
            where: { location: { not: null } },
            _count: { location: true },
            orderBy: { _count: { location: 'desc' } },
            take: 20,
          }),
          // Technologies
          prisma.technology.groupBy({
            by: ['name'],
            _count: { name: true },
            orderBy: { _count: { name: 'desc' } },
            take: 50,
          }),
        ]);

        response.facets = {
          industries: industries.map(item => ({
            name: item.industry,
            count: item._count.industry,
          })),
          sizes: sizes.map(item => ({
            name: item.size,
            count: item._count.size,
          })),
          locations: locations.map(item => ({
            name: item.location,
            count: item._count.location,
          })),
          technologies: technologies.map(item => ({
            name: item.name,
            count: item._count.name,
          })),
        };
      }

      return NextResponse.json(response);
    })
  )
);

export async function GET(req: NextRequest) {
  return getHandler(req);
}

// POST /api/accounts - Create new account
const postHandler = withErrorHandler(
  withAccountsRateLimit(
    withAuth(async (req) => {
      const body = await req.json();
      const data = createAccountSchema.parse(body);

      // Check if account with same domain already exists
      if (data.domain) {
        const existing = await prisma.companyAccount.findUnique({
          where: { domain: data.domain },
        });
        
        if (existing) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Account with this domain already exists' },
            { status: 409 }
          );
        }
      }

      const account = await prisma.companyAccount.create({
        data,
        include: {
          technologies: true,
          insights: true,
          contacts: true,
          _count: {
            select: {
              technologies: true,
              insights: true,
              contacts: true,
            },
          },
        },
      });

      return NextResponse.json(account, { status: 201 });
    })
  )
);

export async function POST(req: NextRequest) {
  return postHandler(req);
}