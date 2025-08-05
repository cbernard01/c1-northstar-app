import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test user (if not using Microsoft Entra ID)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created test user:', testUser.email);

  // Create sample accounts
  const accounts = await Promise.all([
    prisma.companyAccount.create({
      data: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        industry: 'Technology',
        size: 'Enterprise (1000+ employees)',
        location: 'San Francisco, CA',
        description: 'Leading provider of cloud-based solutions for enterprise customers.',
        website: 'https://acme.com',
        metadata: {
          foundedYear: 2010,
          revenue: '$500M',
          employees: 2500,
        },
      },
    }),
    prisma.companyAccount.create({
      data: {
        name: 'TechStart Inc',
        domain: 'techstart.io',
        industry: 'Software',
        size: 'Startup (1-50 employees)',
        location: 'Austin, TX',
        description: 'Innovative AI-powered analytics platform for small businesses.',
        website: 'https://techstart.io',
        metadata: {
          foundedYear: 2022,
          revenue: '$2M',
          employees: 25,
        },
      },
    }),
    prisma.companyAccount.create({
      data: {
        name: 'Global Retail Solutions',
        domain: 'globalretail.com',
        industry: 'Retail',
        size: 'Large (500-1000 employees)',
        location: 'New York, NY',
        description: 'End-to-end retail management and e-commerce solutions.',
        website: 'https://globalretail.com',
        metadata: {
          foundedYear: 2005,
          revenue: '$150M',
          employees: 750,
        },
      },
    }),
  ]);

  console.log(`✅ Created ${accounts.length} sample accounts`);

  // Add technologies to accounts
  const techData = [
    { accountId: accounts[0].id, techs: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes'] },
    { accountId: accounts[1].id, techs: ['Python', 'TensorFlow', 'MongoDB', 'Google Cloud', 'FastAPI'] },
    { accountId: accounts[2].id, techs: ['Java', 'Spring Boot', 'MySQL', 'Azure', 'Redis', 'RabbitMQ'] },
  ];

  for (const { accountId, techs } of techData) {
    await Promise.all(
      techs.map((techName) =>
        prisma.technology.create({
          data: {
            name: techName,
            category: getTechCategory(techName),
            confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
            source: 'seed_data',
            accountId,
          },
        })
      )
    );
  }

  console.log('✅ Added technologies to accounts');

  // Add contacts to accounts
  const contactData = [
    {
      accountId: accounts[0].id,
      contacts: [
        { name: 'John Smith', title: 'CTO', email: 'john.smith@acme.com', department: 'Engineering' },
        { name: 'Sarah Johnson', title: 'VP Sales', email: 'sarah.johnson@acme.com', department: 'Sales' },
      ],
    },
    {
      accountId: accounts[1].id,
      contacts: [
        { name: 'Mike Chen', title: 'Founder & CEO', email: 'mike@techstart.io', department: 'Executive' },
      ],
    },
    {
      accountId: accounts[2].id,
      contacts: [
        { name: 'Emily Davis', title: 'Director of IT', email: 'emily.davis@globalretail.com', department: 'IT' },
      ],
    },
  ];

  for (const { accountId, contacts } of contactData) {
    await Promise.all(
      contacts.map((contact) =>
        prisma.contact.create({
          data: {
            ...contact,
            accountId,
          },
        })
      )
    );
  }

  console.log('✅ Added contacts to accounts');

  // Create sample insights
  const insightData = [
    {
      accountId: accounts[0].id,
      insights: [
        {
          type: 'technical_opportunity',
          title: 'Kubernetes Migration Opportunity',
          description: 'Acme Corporation is currently using Docker but not Kubernetes. They could benefit from container orchestration for their microservices architecture.',
          confidence: 0.85,
          category: 'technical',
          tags: ['kubernetes', 'cloud', 'modernization'],
        },
        {
          type: 'business_opportunity',
          title: 'Enterprise Security Solution Need',
          description: 'With 2500 employees and enterprise status, Acme likely needs advanced security and compliance solutions.',
          confidence: 0.78,
          category: 'business',
          tags: ['security', 'compliance', 'enterprise'],
        },
      ],
    },
    {
      accountId: accounts[1].id,
      insights: [
        {
          type: 'business_opportunity',
          title: 'Scaling Infrastructure Required',
          description: 'As a fast-growing startup, TechStart will need scalable infrastructure solutions to support their AI platform growth.',
          confidence: 0.92,
          category: 'business',
          tags: ['scaling', 'infrastructure', 'growth'],
        },
      ],
    },
  ];

  for (const { accountId, insights } of insightData) {
    await Promise.all(
      insights.map((insight) =>
        prisma.insight.create({
          data: {
            ...insight,
            accountId,
            metadata: {
              generatedAt: new Date().toISOString(),
              source: 'seed_data',
            },
          },
        })
      )
    );
  }

  console.log('✅ Created sample insights');

  // Create a sample job
  const job = await prisma.job.create({
    data: {
      type: 'ACCOUNT_ANALYSIS',
      title: 'Analyze Acme Corporation',
      description: 'Deep analysis of Acme Corporation account data',
      status: 'COMPLETED',
      progress: 100,
      userId: testUser.id,
      completedAt: new Date(),
      metadata: {
        accountId: accounts[0].id,
        duration: 45000, // 45 seconds
      },
    },
  });

  console.log('✅ Created sample job');

  console.log('🎉 Database seed completed successfully!');
}

function getTechCategory(techName: string): string {
  const categories: Record<string, string[]> = {
    frontend: ['React', 'Vue', 'Angular', 'Next.js'],
    backend: ['Node.js', 'Python', 'Java', 'Spring Boot', 'FastAPI'],
    database: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'],
    cloud: ['AWS', 'Google Cloud', 'Azure'],
    devops: ['Docker', 'Kubernetes', 'Jenkins'],
    messaging: ['RabbitMQ', 'Kafka'],
    ml: ['TensorFlow', 'PyTorch', 'scikit-learn'],
  };

  for (const [category, techs] of Object.entries(categories)) {
    if (techs.includes(techName)) {
      return category;
    }
  }

  return 'other';
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });