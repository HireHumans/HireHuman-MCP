#!/usr/bin/env node
/**
 * hirehuman-mcp v1.1.0
 * MCP Server for HireHumans.eu
 *
 * Book verified humans for physical real-world tasks via AI agents.
 * EU-hosted, GDPR-compliant. Demo key: hh_demo_public_v1
 *
 * Docs:   https://hirehumans.eu/agents/docs
 * GitHub: https://github.com/hirehuman/hirehuman-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// ─── CLI: --version Flag ──────────────────────────────────────────
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log('hirehuman-mcp v1.1.0');
  process.exit(0);
}

// ─── Configuration ────────────────────────────────────────────────
const API_BASE  = (process.env.HIREHUMAN_API_URL  || 'https://hirehumans.eu').replace(/\/$/, '');
const API_KEY   = process.env.HIREHUMAN_API_KEY   || 'hh_demo_public_v1';
const MOCK_MODE = process.env.HIREHUMAN_MOCK_MODE === 'true';
const TIMEOUT   = parseInt(process.env.HIREHUMAN_TIMEOUT_MS || '10000', 10);
const DEBUG     = process.env.HIREHUMAN_DEBUG === 'true';
const IS_DEMO   = API_KEY === 'hh_demo_public_v1';

const CLIENT_ID = `mcp-npm-${process.platform}-node${process.version.replace('v', '')}`;

function log(msg: string): void {
  if (DEBUG) console.error(`[hirehuman-mcp] ${msg}`);
}

function warn(msg: string): void {
  console.error(`[hirehuman-mcp] WARNING: ${msg}`);
}

// ─── Tool Definitions ────────────────────────────────────────────
const TOOLS: Tool[] = [
  // ── Core Tools ──────────────────────────────────────────────────
  {
    name: 'search_humans',
    description:
      'Find available verified humans near a location who can perform physical real-world tasks. ' +
      'Returns a ranked list sorted by match score (skills x proximity x rating x availability). ' +
      'IMPORTANT: Always call get_catalog first to discover valid taskSlug and skill tag values. ' +
      'Always call this before book_task to get a valid humanId.',
    inputSchema: {
      type: 'object',
      required: ['location'],
      properties: {
        location: {
          type: 'string',
          description: 'City name (e.g. "Vienna", "Berlin") or GPS coordinates as "lat,lng".',
        },
        taskSlug: {
          type: 'string',
          description: 'Filter by task type slug from get_catalog (e.g. "physical:parcel-pickup").',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by skill tags (e.g. ["logistics:parcel", "transport:driving"]).',
        },
        radiusKm: {
          type: 'number',
          description: 'Search radius in km. Default: 10. Max: 100.',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
        availableNow: {
          type: 'boolean',
          description: 'Only return humans available for short-notice tasks (start within 2h).',
          default: false,
        },
        minLevel: {
          type: 'string',
          enum: ['ROOKIE', 'READY', 'PRO', 'VERIFIED'],
          description:
            'Minimum trust level. ROOKIE = new. READY = verified + 1 task. ' +
            'PRO = 50+ tasks. VERIFIED = PRO + ID verified. Default: READY.',
          default: 'READY',
        },
        maxBudgetEur: {
          type: 'number',
          description: 'Maximum hourly rate in EUR.',
        },
        lang: {
          type: 'string',
          enum: ['de', 'en', 'fr', 'it', 'pl'],
          description: 'Preferred language. Default: en.',
          default: 'en',
        },
        limit: {
          type: 'number',
          description: 'Max results. Default: 10. Max: 50.',
          default: 10,
          maximum: 50,
        },
      },
    },
  },

  {
    name: 'get_catalog',
    description:
      'Get the complete catalog of available task types (SKUs) and skill tags. ' +
      'Call this FIRST before search_humans or book_task to discover valid slugs, ' +
      'skill tags, prices, and delivery times. ' +
      'Categories: logistics, bureaucracy, mystery, documentation, real_estate, ' +
      'health, presence, business, household, animals, social, transport.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category slug. Omit to return all.',
        },
        lang: {
          type: 'string',
          enum: ['de', 'en', 'fr', 'it', 'pl'],
          description: 'Language for names and descriptions. Default: en.',
          default: 'en',
        },
      },
    },
  },

  {
    name: 'get_price_estimate',
    description:
      'Get a price estimate for a task before committing. ' +
      'Returns min/max/typical price based on available humans, complexity, urgency, and location. ' +
      'Prices are in EUR including service fee.',
    inputSchema: {
      type: 'object',
      required: ['taskSlug', 'location'],
      properties: {
        taskSlug: {
          type: 'string',
          description: 'Task type slug from get_catalog.',
        },
        location: {
          type: 'string',
          description: 'City name or "lat,lng" coordinates.',
        },
        urgency: {
          type: 'string',
          enum: ['standard', 'express', 'asap'],
          description: 'standard = lowest price. express = +30%. asap = +50%. Default: standard.',
          default: 'standard',
        },
      },
    },
  },

  {
    name: 'book_task',
    description:
      'Book a verified human for a physical real-world task. ' +
      'Human is notified immediately, must confirm within 15 min, performs task, ' +
      'submits GPS-verified photo proof, client confirms, payment released. ' +
      'Returns bookingId - use get_booking_status to track. ' +
      'TIP: Provide webhookUrl for push notifications instead of polling.',
    inputSchema: {
      type: 'object',
      required: ['humanId', 'taskSlug', 'location', 'instructions', 'clientEmail'],
      properties: {
        humanId: {
          type: 'string',
          description: 'Human ID from search_humans.',
        },
        taskSlug: {
          type: 'string',
          description: 'Task type slug from get_catalog.',
        },
        location: {
          type: 'object',
          required: ['address'],
          description: 'Where the task takes place.',
          properties: {
            address: { type: 'string', description: 'Full street address with city and postal code.' },
            lat: { type: 'number', description: 'GPS latitude.' },
            lng: { type: 'number', description: 'GPS longitude.' },
            notes: { type: 'string', description: 'Access notes: door codes, floor, parking, etc.' },
          },
        },
        instructions: {
          type: 'string',
          description: 'Detailed task instructions for the human. Be specific.',
        },
        clientEmail: {
          type: 'string',
          format: 'email',
          description: 'Email for confirmations and proof delivery.',
        },
        budgetEur: { type: 'number', description: 'Max total budget in EUR.' },
        deadlineAt: {
          type: 'string',
          format: 'date-time',
          description: 'Completion deadline (ISO 8601).',
        },
        agentType: {
          type: 'string',
          description: 'Agent framework (e.g. "claude-desktop", "cursor", "n8n").',
        },
        webhookUrl: {
          type: 'string',
          format: 'uri',
          description: 'HTTPS URL for HMAC-signed status push notifications.',
        },
        lang: {
          type: 'string',
          enum: ['de', 'en', 'fr', 'it', 'pl'],
          default: 'en',
        },
      },
    },
  },

  {
    name: 'get_booking_status',
    description:
      'Get current status of a booking. ' +
      'Flow: PENDING -> ACCEPTED -> IN_PROGRESS -> PROOF_SUBMITTED -> COMPLETED. ' +
      'Terminal: CANCELLED, DISPUTED. ' +
      'On PROOF_SUBMITTED/COMPLETED: includes photo URLs and GPS data. ' +
      'Poll every 60s, or use webhookUrl in book_task.',
    inputSchema: {
      type: 'object',
      required: ['bookingId'],
      properties: {
        bookingId: { type: 'string', description: 'Booking ID from book_task.' },
      },
    },
  },

  // ── Pairing Tools ──────────────────────────────────────────────
  {
    name: 'get_pairing_code',
    description:
      'Pair this agent with a human operator using a one-time pairing code. ' +
      'The operator generates a code at hirehumans.eu/humans/dashboard. ' +
      'Returns a permanent API key - store it as HIREHUMAN_API_KEY. ' +
      'Call once per agent instance. No signup or credit card needed.',
    inputSchema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', description: 'Pairing code (format: HH-XXXX). Case-insensitive.' },
        agentType: { type: 'string', description: 'Agent framework identifier.' },
        label: { type: 'string', description: 'Name for this agent instance.' },
      },
    },
  },

  {
    name: 'check_pairing_status',
    description:
      'Check if this agent is paired and active. ' +
      'Returns operator name, call count, active status. ' +
      'Requires HIREHUMAN_API_KEY set to an agent key (hh_agent_...).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ── Bounty Tools ───────────────────────────────────────────────
  {
    name: 'create_bounty',
    description:
      'Post an open task request that verified humans can apply for. ' +
      'Better than book_task when you want competitive pricing or flexible timeline. ' +
      'Matching humans are notified immediately. ' +
      'Flow: create_bounty -> get_bounty_status -> get_bounty_applications -> accept_application.',
    inputSchema: {
      type: 'object',
      required: ['title', 'description', 'locationCity', 'clientEmail'],
      properties: {
        title: { type: 'string', description: 'Short task title. Max 80 chars.' },
        description: { type: 'string', description: 'Detailed requirements.' },
        locationCity: { type: 'string', description: 'City where task takes place.' },
        locationAddress: { type: 'string', description: 'Street address (optional).' },
        taskSlug: { type: 'string', description: 'Task type from get_catalog (optional).' },
        budgetMinEur: { type: 'number', description: 'Min acceptable price in EUR.' },
        budgetMaxEur: { type: 'number', description: 'Max budget in EUR.' },
        deadlineAt: { type: 'string', format: 'date-time', description: 'Task completion deadline.' },
        applicationDeadlineHours: { type: 'number', description: 'Hours for humans to apply (2-168). Default: 24.', default: 24 },
        requiredSkills: { type: 'array', items: { type: 'string' }, description: 'Skill tags from get_catalog.' },
        requiredLevel: { type: 'string', enum: ['ROOKIE', 'READY', 'PRO', 'VERIFIED'], default: 'READY' },
        spotsAvailable: { type: 'number', description: 'How many humans needed. Default: 1.', default: 1 },
        clientEmail: { type: 'string', format: 'email' },
        webhookUrl: { type: 'string', format: 'uri' },
        lang: { type: 'string', enum: ['de', 'en', 'fr', 'it', 'pl'], default: 'de' },
      },
    },
  },

  {
    name: 'get_bounty_status',
    description: 'Check bounty status: applications received, spots remaining, deadline.',
    inputSchema: {
      type: 'object',
      required: ['bountyId'],
      properties: {
        bountyId: { type: 'string' },
      },
    },
  },

  {
    name: 'get_bounty_applications',
    description: 'Get pending applications for a bounty, sorted by price. Includes human profile, proposed price, delivery time.',
    inputSchema: {
      type: 'object',
      required: ['bountyId'],
      properties: {
        bountyId: { type: 'string' },
        sortBy: { type: 'string', enum: ['price', 'rating'], default: 'price' },
      },
    },
  },

  {
    name: 'accept_application',
    description: 'Accept a human\'s bounty application. Creates a confirmed booking. Other applicants are notified.',
    inputSchema: {
      type: 'object',
      required: ['bountyId', 'applicationId'],
      properties: {
        bountyId: { type: 'string' },
        applicationId: { type: 'string' },
      },
    },
  },

  {
    name: 'cancel_bounty',
    description: 'Cancel an open bounty. All pending applicants are notified.',
    inputSchema: {
      type: 'object',
      required: ['bountyId'],
      properties: {
        bountyId: { type: 'string' },
        reason: { type: 'string', description: 'Cancellation reason (optional).' },
      },
    },
  },

  // ── Conversation Tools ─────────────────────────────────────────
  {
    name: 'send_message',
    description:
      'Send a message to the human assigned to a booking. ' +
      'Human receives notification immediately. ' +
      'Only works for ACCEPTED, IN_PROGRESS, or PROOF_SUBMITTED bookings. ' +
      'Rate limit: 20 messages per hour per booking.',
    inputSchema: {
      type: 'object',
      required: ['bookingId', 'content'],
      properties: {
        bookingId: { type: 'string', description: 'Booking ID from book_task or accept_application.' },
        content: { type: 'string', description: 'Message text. Max 1000 characters.' },
        messageType: {
          type: 'string',
          enum: ['text', 'status_update', 'problem_report', 'confirmation'],
          description: 'text (default), status_update, problem_report (warning icon), confirmation.',
          default: 'text',
        },
      },
    },
  },

  {
    name: 'get_conversation',
    description:
      'Read messages for a booking including human replies. ' +
      'Human messages are marked as read when called. ' +
      'Use nextSince value for efficient polling.',
    inputSchema: {
      type: 'object',
      required: ['bookingId'],
      properties: {
        bookingId: { type: 'string' },
        limit: { type: 'number', description: 'Max messages. Default: 50. Max: 200.', default: 50 },
        since: {
          type: 'string',
          format: 'date-time',
          description: 'Only messages newer than this timestamp. Use nextSince from previous call.',
        },
      },
    },
  },

  // ── Profile & Proof Tools ──────────────────────────────────────
  {
    name: 'get_human_profile',
    description:
      'View the public profile of a human. Includes bio, skills, ratings, reviews, ' +
      'availability, vehicles, languages, and rank. ' +
      'Use the slug from search_humans results.',
    inputSchema: {
      type: 'object',
      required: ['humanSlug'],
      properties: {
        humanSlug: { type: 'string', description: 'Human profile slug (e.g. "anna-m-wien").' },
      },
    },
  },

  {
    name: 'get_proof_status',
    description:
      'Check the AI Guardian verification status of a booking\'s photo proof. ' +
      'Returns confidence score, feedback, and photo URL. ' +
      'Only available after proof has been submitted (PROOF_SUBMITTED or COMPLETED status).',
    inputSchema: {
      type: 'object',
      required: ['bookingId'],
      properties: {
        bookingId: { type: 'string', description: 'Booking ID from book_task or accept_application.' },
      },
    },
  },

  // ── Booking Management Tools ───────────────────────────────────
  {
    name: 'cancel_booking',
    description:
      'Cancel a booking before the human starts working. ' +
      'Only works for bookings with status: PENDING, PENDING_PAYMENT, PAID, ACCEPTED. ' +
      'Cannot cancel IN_PROGRESS or later bookings.',
    inputSchema: {
      type: 'object',
      required: ['bookingId'],
      properties: {
        bookingId: { type: 'string', description: 'Booking ID to cancel.' },
        reason: { type: 'string', description: 'Cancellation reason (optional).' },
      },
    },
  },

  {
    name: 'list_bookings',
    description:
      'List all bookings created by this agent. ' +
      'Filter by status and paginate with limit. ' +
      'Returns summary info for each booking (status, task, human, dates).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['PENDING', 'PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'IN_PROGRESS', 'PROOF_SUBMITTED', 'COMPLETED', 'CANCELLED', 'DISPUTED'],
          description: 'Filter by booking status. Omit to return all.',
        },
        limit: { type: 'number', description: 'Max results. Default: 20. Max: 100.', default: 20, maximum: 100 },
      },
    },
  },
];

// ─── Mock Responses ─────────────────────────────────────────────
const MOCK_RESPONSES: Record<string, object> = {
  search_humans: {
    success: true,
    count: 3,
    location: { city: 'Vienna', country: 'AT', lat: 48.2082, lng: 16.3738 },
    radiusKm: 10,
    humans: [
      {
        id: 'mock-human-001', displayName: 'Anna M.', locationCity: 'Vienna',
        locationCountry: 'AT', distanceKm: 2.3, level: 'PRO',
        ratingAvg: 4.8, ratingCount: 47, completedTasks: 61, hourlyRateEur: 25,
        skills: ['logistics:parcel', 'bureaucracy:forms', 'documentation:photo', 'health:pharmacy'],
        availableNow: true, acceptsShortNotice: true, vehicles: ['car', 'bicycle'],
        languages: ['de', 'en'], responseTimeMin: 8, matchScore: 0.94,
      },
      {
        id: 'mock-human-002', displayName: 'Thomas K.', locationCity: 'Vienna',
        locationCountry: 'AT', distanceKm: 4.1, level: 'VERIFIED',
        ratingAvg: 4.9, ratingCount: 123, completedTasks: 189, hourlyRateEur: 30,
        skills: ['mystery:food', 'mystery:retail', 'documentation:photo', 'business:audit'],
        availableNow: false, acceptsShortNotice: false, vehicles: ['car'],
        languages: ['de', 'en', 'it'], responseTimeMin: 15, matchScore: 0.87,
      },
      {
        id: 'mock-human-003', displayName: 'Maria S.', locationCity: 'Vienna',
        locationCountry: 'AT', distanceKm: 1.8, level: 'READY',
        ratingAvg: 4.6, ratingCount: 12, completedTasks: 14, hourlyRateEur: 18,
        skills: ['animals:dog-walking', 'social:senior-companion', 'household:shopping'],
        availableNow: true, acceptsShortNotice: true, vehicles: ['bicycle', 'public'],
        languages: ['de', 'pl'], responseTimeMin: 5, matchScore: 0.79,
      },
    ],
    _mock: true,
    _note: 'Demo data. Real results require a valid API key.',
  },

  get_catalog: {
    success: true,
    count: 5,
    categories: ['logistics', 'animals', 'mystery', 'bureaucracy', 'health'],
    skus: [
      { slug: 'physical:parcel-pickup', name: 'Parcel Pickup', category: 'logistics', basePriceEur: 15, maxPriceEur: 35, deliveryWithinHours: 4, requiredSkills: ['logistics:parcel'] },
      { slug: 'physical:dog-walking-30min', name: 'Dog Walk (30 min)', category: 'animals', basePriceEur: 12, maxPriceEur: 20, deliveryWithinHours: 2, requiredSkills: ['animals:dog-walking'] },
      { slug: 'physical:mystery-restaurant', name: 'Restaurant Mystery Check', category: 'mystery', basePriceEur: 40, maxPriceEur: 80, deliveryWithinHours: 48, requiredSkills: ['mystery:food'] },
      { slug: 'physical:bureaucracy-standard', name: 'Gov Office Run', category: 'bureaucracy', basePriceEur: 30, maxPriceEur: 60, deliveryWithinHours: 24, requiredSkills: ['bureaucracy:forms'] },
      { slug: 'physical:pharmacy-errand', name: 'Pharmacy Errand', category: 'health', basePriceEur: 15, maxPriceEur: 30, deliveryWithinHours: 3, requiredSkills: ['health:pharmacy'] },
    ],
    _mock: true,
    _note: 'Showing 5 of 80+ SKUs. Full catalog via API.',
  },

  get_price_estimate: {
    success: true,
    taskSlug: 'physical:parcel-pickup', taskName: 'Parcel Pickup',
    location: 'Vienna', urgency: 'standard',
    estimate: {
      minEur: 15, maxEur: 35, typicalEur: 20, currency: 'EUR',
      includesServiceFee: true, availableHumans: 3, estimatedDeliveryHours: 4,
    },
    urgencyOptions: {
      standard: { typicalEur: 20, deliveryHours: 4 },
      express:  { typicalEur: 26, deliveryHours: 2 },
      asap:     { typicalEur: 30, deliveryHours: 1 },
    },
    _mock: true,
  },

  book_task: {
    success: true,
    bookingId: 'mock-booking-hh-001', status: 'PENDING',
    humanId: 'mock-human-001', humanName: 'Anna M.',
    taskSlug: 'physical:parcel-pickup', taskName: 'Parcel Pickup',
    priceEur: 20, escrowStatus: 'HELD',
    confirmationDeadlineAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    estimatedCompletionAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    trackingUrl: 'https://hirehumans.eu/tasks/mock-booking-hh-001',
    message: 'Human notified. Confirmation expected within 15 minutes.',
    _mock: true, _note: 'Demo booking. No real human was assigned.',
  },

  get_booking_status: {
    success: true,
    bookingId: 'mock-booking-hh-001', status: 'COMPLETED',
    humanId: 'mock-human-001', humanName: 'Anna M.',
    taskSlug: 'physical:parcel-pickup', taskName: 'Parcel Pickup',
    completedAt: new Date().toISOString(),
    proof: {
      photos: ['https://hirehumans.eu/mock/proof-1.jpg', 'https://hirehumans.eu/mock/proof-2.jpg'],
      gpsLat: 48.2082, gpsLng: 16.3738, gpsVerified: true,
      notes: 'Parcel collected from locker #42.',
    },
    paymentStatus: 'RELEASED', amountPaidEur: 20,
    _mock: true,
  },

  get_pairing_code: {
    success: true,
    agentId: 'mock-agent-001',
    apiKey: 'hh_agent_mock_key_not_real',
    operatorName: 'Demo Operator',
    message: '[MOCK] Pairing successful. Store your apiKey.',
    _mock: true,
  },

  check_pairing_status: {
    success: true, paired: true,
    agentId: 'mock-agent-001', label: 'Mock Agent',
    agentType: 'claude', operatorName: 'Demo Operator',
    isActive: true, callCount: 42,
    message: '[MOCK] Agent is active and authorized.',
    _mock: true,
  },

  create_bounty: {
    success: true,
    bountyId: 'mock-bounty-001', status: 'OPEN',
    title: 'Sample Bounty', applicationDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    notifiedHumans: 7, spotsAvailable: 1,
    message: '[MOCK] No real bounty created.',
    nextStep: 'Poll get_bounty_status.',
    _mock: true,
  },

  get_bounty_status: {
    success: true,
    bountyId: 'mock-bounty-001', title: 'Sample Bounty',
    status: 'APPLICATIONS_RECEIVED',
    spotsAvailable: 1, spotsAccepted: 0, spotsRemaining: 1,
    applicationCounts: { total: 3, pending: 3, accepted: 0 },
    deadlinePassed: false,
    hint: '3 application(s) waiting. Call get_bounty_applications to review.',
    _mock: true,
  },

  get_bounty_applications: {
    success: true,
    bountyId: 'mock-bounty-001', total: 2,
    applications: [
      { applicationId: 'mock-app-001', human: { id: 'mock-human-003', displayName: 'Maria S.', ratingAvg: 4.6, matchScore: 100 }, proposedPriceEur: 15, proposedDeliveryHours: 2, message: 'Bin in der Naehe.' },
      { applicationId: 'mock-app-002', human: { id: 'mock-human-001', displayName: 'Anna M.', ratingAvg: 4.8, matchScore: 100 }, proposedPriceEur: 22, proposedDeliveryHours: 3, message: null },
    ],
    priceRange: { minEur: 15, maxEur: 22, avgEur: 19 },
    _mock: true,
  },

  accept_application: {
    success: true,
    bookingId: 'mock-booking-from-bounty-001', status: 'CONFIRMED',
    humanName: 'Maria S.', priceEur: 15, rejectedApplicants: 1,
    message: '[MOCK] No real booking created.',
    _mock: true,
  },

  cancel_bounty: {
    success: true,
    bountyId: 'mock-bounty-001', status: 'CANCELLED',
    notifiedApplicants: 2,
    message: '[MOCK] Bounty cancelled.',
    _mock: true,
  },

  send_message: {
    success: true,
    messageId: 'mock-message-001',
    bookingId: 'mock-booking-hh-001',
    sentAt: new Date().toISOString(),
    characterCount: 42,
    rateLimitRemaining: 19,
    humanNotified: false, humanOnline: false,
    _mock: true,
    _note: '[MOCK] Message not stored. Human was not notified.',
  },

  get_conversation: {
    success: true,
    bookingId: 'mock-booking-hh-001',
    bookingStatus: 'IN_PROGRESS',
    humanName: 'Anna M.',
    messages: [
      { id: 'mock-msg-001', from: 'you (agent)', senderType: 'agent', content: 'Please check if parcel has tracking sticker TN-123.', type: 'text', sentAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), readByHuman: true },
      { id: 'mock-msg-002', from: 'human', senderType: 'human', content: 'Bin angekommen', type: 'status_update', sentAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), readByHuman: true },
      { id: 'mock-msg-003', from: 'human', senderType: 'human', content: 'Sticker TN-123 ist drauf. Hole gerade ab.', type: 'text', sentAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), readByHuman: true },
    ],
    total: 3,
    nextSince: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    unreadFromHuman: 0,
    _mock: true,
  },

  get_human_profile: {
    success: true,
    profile: {
      id: 'mock-human-001', displayName: 'Anna M.', slug: 'anna-m-wien',
      bio: 'Reliable and fast. I specialize in logistics and errands across Vienna.',
      locationCity: 'Wien', locationCountry: 'AT',
      skills: ['logistics:parcel', 'bureaucracy:forms', 'documentation:photo', 'health:pharmacy'],
      languages: ['de', 'en'], level: 'PRO', rank: 'Gold',
      ratingAvg: 4.8, ratingCount: 47, activatedServices: 8,
      hourlyRateEur: 25, acceptsShortNotice: true, vehicles: ['car', 'bicycle'],
      recentReviews: [
        { rating: 5, text: 'Super schnell und zuverlässig!', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { rating: 5, text: 'Very professional, great communication.', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      ],
    },
    _mock: true,
  },

  get_proof_status: {
    success: true,
    data: {
      bookingId: 'mock-booking-hh-001',
      guardianStatus: 'APPROVED', confidence: 92,
      feedback: 'Photo shows completed task matching description. Location verified.',
      proofPhotoUrl: 'https://hirehumans.eu/mock/proof-verified.jpg',
      checkedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    _mock: true,
  },

  cancel_booking: {
    success: true,
    bookingId: 'mock-booking-hh-001', status: 'CANCELLED',
    reason: 'Client cancelled',
    refundStatus: 'REFUNDED', refundAmountEur: 20,
    message: '[MOCK] Booking cancelled. No real booking was affected.',
    _mock: true,
  },

  list_bookings: {
    success: true,
    data: [
      {
        id: 'mock-booking-hh-001', status: 'COMPLETED',
        taskTitle: 'Parcel Pickup', humanName: 'Anna M.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
        guardianStatus: 'APPROVED',
      },
      {
        id: 'mock-booking-hh-002', status: 'IN_PROGRESS',
        taskTitle: 'Dog Walk (30 min)', humanName: 'Maria S.',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        completedAt: null,
        guardianStatus: 'PENDING',
      },
    ],
    total: 2, returned: 2,
    _mock: true,
  },
};

// ─── Rate-Limit Tracking (Demo Key Warning) ─────────────────────
function checkRateLimitHeaders(headers: Headers): void {
  const remaining = headers.get('x-hh-demo-calls-remaining');
  const limit = headers.get('x-hh-demo-calls-limit');
  if (remaining !== null && parseInt(remaining, 10) <= 2) {
    warn(
      `Demo key nearly exhausted: ${remaining}/${limit ?? '10'} calls remaining today. ` +
      `Resets at midnight UTC. Get a developer key: api@hirehumans.eu`
    );
  }
}

// ─── API Calls ──────────────────────────────────────────────────
async function callApi(toolName: string, args: unknown): Promise<object> {
  const url = `${API_BASE}/api/hh/mcp/tools/${toolName}`;
  log(`POST ${url} | key=${API_KEY.substring(0, 15)}...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hh-api-key': API_KEY,
        'x-hh-client': 'hirehuman-mcp/1.1.0',
        'x-hh-client-id': CLIENT_ID,
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (IS_DEMO) checkRateLimitHeaders(res.headers);

    const data = await res.json() as object;
    log(`Response ${res.status}: ${JSON.stringify(data).substring(0, 120)}`);
    return data;

  } catch (err: unknown) {
    clearTimeout(timer);
    const error = err as Error & { name: string };

    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'TIMEOUT',
        message: `Request timed out after ${TIMEOUT}ms.`,
        suggestion: `Verify API is reachable: curl ${API_BASE}/api/hh/health`,
        tip: 'For local testing use: HIREHUMAN_MOCK_MODE=true',
      };
    }

    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: error.message,
      suggestion:
        'Check that HIREHUMAN_API_URL is correct and the server is running. ' +
        'For local testing use: HIREHUMAN_MOCK_MODE=true',
      apiUrl: API_BASE,
    };
  }
}

// ─── MCP Server ─────────────────────────────────────────────────
const server = new Server(
  { name: 'hirehuman', version: '1.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`Tool called: ${name}`);

  let result: object;

  if (MOCK_MODE) {
    result = MOCK_RESPONSES[name] ?? {
      success: false,
      error: 'UNKNOWN_TOOL',
      message: `Tool "${name}" not found in mock responses.`,
      availableTools: Object.keys(MOCK_RESPONSES),
    };
  } else {
    result = await callApi(name, args ?? {});
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
});

// ─── Start ──────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `\nhirehuman-mcp v1.1.0 ready\n` +
    `  API:   ${API_BASE}\n` +
    `  Key:   ${IS_DEMO ? 'Demo (10 calls/day, resets midnight UTC)' : 'Custom key'}\n` +
    `  Mock:  ${MOCK_MODE ? 'ON - no real API calls made' : 'OFF'}\n` +
    `  Debug: ${DEBUG ? 'ON' : 'OFF'}\n` +
    `  Tools: ${TOOLS.length}\n`
  );

  if (IS_DEMO && !MOCK_MODE) {
    console.error(
      `  To get a developer key (1000 calls/month): api@hirehumans.eu\n`
    );
  }
}

main().catch((err) => {
  console.error('[hirehuman-mcp] Fatal error:', err);
  process.exit(1);
});
