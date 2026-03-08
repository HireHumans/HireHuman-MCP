import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.HIREHUMAN_API_URL ?? 'https://hirehumans.eu';
const TOOLS_BASE = `${API_BASE}/api/hh/mcp/tools`;
const VERSION = '0.2.0';

const server = new Server(
  { name: '@hirehuman/mcp', version: VERSION },
  { capabilities: { tools: {} } }
);

// ============================================================================
// TOOL DEFINITIONS — matches backend MCP_TOOLS exactly
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Core Tools ──
    {
      name: 'search_humans',
      description: 'Search for available humans near a location, optionally filtered by skills, max hourly rate, and availability.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          lat: { type: 'number', description: 'Latitude of the search center', minimum: -90, maximum: 90 },
          lng: { type: 'number', description: 'Longitude of the search center', minimum: -180, maximum: 180 },
          radiusKm: { type: 'number', description: 'Search radius in kilometers (default 15)', minimum: 1, maximum: 100, default: 15 },
          skills: { type: 'array', items: { type: 'string' }, description: 'Required skill tags to filter by' },
          maxRateEur: { type: 'number', description: 'Maximum hourly rate in EUR', minimum: 0 },
        },
        required: ['lat', 'lng'],
      },
    },
    {
      name: 'get_catalog',
      description: 'Get the catalog of available task SKUs (predefined task types with fixed pricing).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          track: { type: 'string', description: 'Filter by track (e.g. "physical", "digital")' },
        },
      },
    },
    {
      name: 'get_price_estimate',
      description: 'Get a price estimate for a task SKU, optionally factoring in location and urgency.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          skuSlug: { type: 'string', description: 'SKU slug to estimate price for' },
          locationCity: { type: 'string', description: 'City (may affect pricing)' },
          urgent: { type: 'boolean', description: 'If true, estimate includes urgency surcharge', default: false },
        },
        required: ['skuSlug'],
      },
    },
    {
      name: 'book_task',
      description: 'Book a task by SKU slug. Creates a booking with a matched human. Returns booking ID and estimated delivery.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          skuSlug: { type: 'string', description: 'SKU slug (e.g. "physical:parcel-pickup")' },
          locationCity: { type: 'string', description: 'City where the task should be performed' },
          locationCountry: { type: 'string', description: 'ISO 3166-1 alpha-2 country code', default: 'AT' },
          lat: { type: 'number', description: 'Latitude of the task location', minimum: -90, maximum: 90 },
          lng: { type: 'number', description: 'Longitude of the task location', minimum: -180, maximum: 180 },
          instructions: { type: 'string', description: 'Additional instructions for the human' },
          webhookUrl: { type: 'string', description: 'HTTPS URL to receive push notifications on booking status changes.' },
        },
        required: ['skuSlug', 'locationCity'],
      },
    },
    {
      name: 'get_booking_status',
      description: 'Get the current status of a booking by its ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bookingId: { type: 'string', description: 'The booking ID returned from book_task' },
        },
        required: ['bookingId'],
      },
    },
    // ── Pairing Tools ──
    {
      name: 'get_pairing_code',
      description:
        'Pair this agent with a human operator using a one-time pairing code. ' +
        'The operator generates a code at hirehumans.eu/humans/dashboard and gives it to you. ' +
        'Returns a permanent API key — store it immediately as HIREHUMAN_API_KEY. ' +
        'Call this only once per agent instance. No signup or credit card needed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          code: { type: 'string', description: 'The pairing code from your operator. Format: HH-XXXX (e.g. "HH-A4K9"). Case-insensitive.' },
          agentType: { type: 'string', description: 'Your agent framework identifier (e.g. "claude-desktop", "cursor", "autogen", "langchain", "n8n", "custom").' },
          label: { type: 'string', description: 'A human-readable name for this agent instance, shown in the operator dashboard.' },
        },
        required: ['code'],
      },
    },
    {
      name: 'check_pairing_status',
      description:
        'Check if this agent is still paired and active with the operator. ' +
        'Returns operator name, call count, and active status. ' +
        'Requires HIREHUMAN_API_KEY to be set to an agent key (hh_agent_...). ' +
        'Use this to verify your pairing before running long workflows.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    // ── Bounty Tools ──
    {
      name: 'create_bounty',
      description:
        'Post an open task request that verified humans nearby can apply for. ' +
        'Better than book_task when: you want competitive pricing, do not know which ' +
        'human to choose, or have a flexible timeline (2-48h). ' +
        'Matching humans receive a push notification immediately. ' +
        'WORKFLOW: create_bounty -> get_bounty_status (poll) -> get_bounty_applications -> accept_application.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Short task title. Max 80 chars.' },
          description: { type: 'string', description: 'Detailed task description and requirements.' },
          locationCity: { type: 'string', description: 'City where the task takes place (e.g. "Vienna").' },
          locationAddress: { type: 'string', description: 'Full street address. Optional but improves matching.' },
          taskSlug: { type: 'string', description: 'Task type slug from get_catalog (optional).' },
          budgetMinEur: { type: 'number', description: 'Minimum acceptable price in EUR.' },
          budgetMaxEur: { type: 'number', description: 'Maximum budget in EUR. Shown to humans as guidance.' },
          deadlineAt: { type: 'string', format: 'date-time', description: 'When the task must be completed. ISO 8601.' },
          applicationDeadlineHours: { type: 'number', description: 'How long humans have to apply. Default: 24h. Min: 2h. Max: 168h.', default: 24, minimum: 2, maximum: 168 },
          requiredSkills: { type: 'array', items: { type: 'string' }, description: 'Skill tags from get_catalog.' },
          requiredLevel: { type: 'string', enum: ['ROOKIE', 'READY', 'PRO', 'VERIFIED'], default: 'READY' },
          spotsAvailable: { type: 'number', description: 'How many humans needed. Default: 1. Use >1 for team tasks.', default: 1, minimum: 1, maximum: 50 },
          clientEmail: { type: 'string', format: 'email', description: 'Email for booking confirmation and updates.' },
          webhookUrl: { type: 'string', format: 'uri', description: 'Receive push updates when applications arrive.' },
          lang: { type: 'string', enum: ['de', 'en', 'fr', 'it', 'pl'], default: 'de' },
        },
        required: ['title', 'description', 'locationCity', 'clientEmail'],
      },
    },
    {
      name: 'get_bounty_status',
      description:
        'Check the current status of a bounty: how many applications received, spots remaining, and deadline. Poll this after create_bounty.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bountyId: { type: 'string', description: 'Bounty ID from create_bounty.' },
        },
        required: ['bountyId'],
      },
    },
    {
      name: 'get_bounty_applications',
      description:
        'Get all pending applications for a bounty, sorted by price (cheapest first). Each entry includes human profile, proposed price, delivery time, and message.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bountyId: { type: 'string', description: 'Bounty ID from create_bounty.' },
          sortBy: { type: 'string', enum: ['price', 'rating'], default: 'price', description: 'Sort by price or rating.' },
        },
        required: ['bountyId'],
      },
    },
    {
      name: 'accept_application',
      description:
        'Accept a human\'s application for a bounty. Creates a confirmed booking automatically. ' +
        'All other pending applicants are notified. Track with get_booking_status(bookingId).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bountyId: { type: 'string', description: 'Bounty ID from create_bounty.' },
          applicationId: { type: 'string', description: 'Application ID from get_bounty_applications.' },
        },
        required: ['bountyId', 'applicationId'],
      },
    },
    {
      name: 'cancel_bounty',
      description: 'Cancel an open bounty. All pending applicants are notified. Use this if the task is no longer needed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bountyId: { type: 'string', description: 'Bounty ID from create_bounty.' },
          reason: { type: 'string', description: 'Optional cancellation reason.' },
        },
        required: ['bountyId'],
      },
    },
    // ── Messaging Tools ──
    {
      name: 'send_message',
      description:
        'Send a message to the human assigned to a booking. ' +
        'The human receives a push notification immediately. ' +
        'Only works for bookings with status: ACCEPTED, IN_PROGRESS, or PROOF_SUBMITTED. ' +
        'Rate limit: 20 messages per hour per booking.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bookingId: { type: 'string', description: 'The booking ID from book_task or accept_application.' },
          content: { type: 'string', description: 'Message text. Max 1000 characters.' },
          messageType: {
            type: 'string',
            enum: ['text', 'status_update', 'problem_report', 'confirmation'],
            description: 'text = general (default). status_update = progress. problem_report = flags issue. confirmation = confirms action.',
            default: 'text',
          },
        },
        required: ['bookingId', 'content'],
      },
    },
    {
      name: 'get_conversation',
      description:
        'Read all messages for a booking, including replies from the human. ' +
        'Human messages are marked as read when this tool is called. ' +
        'Use the returned nextSince value to poll only for new messages.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          bookingId: { type: 'string', description: 'The booking ID.' },
          limit: { type: 'number', description: 'Max messages to return. Default: 50. Max: 200.', default: 50, maximum: 200 },
          since: { type: 'string', format: 'date-time', description: 'Only return messages newer than this. Use nextSince from previous call.' },
        },
        required: ['bookingId'],
      },
    },
  ],
}));

// ============================================================================
// TOOL HANDLERS — calls individual backend endpoints
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = process.env.HIREHUMAN_API_KEY ?? 'hh_demo_public_v1';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-HH-Api-Key': apiKey,
    'User-Agent': `@hirehuman/mcp/${VERSION}`,
  };

  async function toolGet(tool: string, params: URLSearchParams): Promise<unknown> {
    const url = `${TOOLS_BASE}/${tool}?${params}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const body = await resp.text().catch(() => 'Unknown error');
      throw new Error(`API ${resp.status}: ${body}`);
    }
    return resp.json();
  }

  async function toolPost(tool: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${TOOLS_BASE}/${tool}`;
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const text = await resp.text().catch(() => 'Unknown error');
      throw new Error(`API ${resp.status}: ${text}`);
    }
    return resp.json();
  }

  function ok(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  try {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    switch (name) {

      // ── Core ──

      case 'search_humans': {
        const params = new URLSearchParams();
        params.set('lat', String(a.lat));
        params.set('lng', String(a.lng));
        if (a.radiusKm) params.set('radiusKm', String(a.radiusKm));
        if (a.skills && Array.isArray(a.skills)) params.set('skills', (a.skills as string[]).join(','));
        if (a.maxRateEur) params.set('maxRateEur', String(a.maxRateEur));
        return ok(await toolGet('search_humans', params));
      }

      case 'get_catalog': {
        const params = new URLSearchParams();
        if (a.track) params.set('track', String(a.track));
        return ok(await toolGet('get_catalog', params));
      }

      case 'get_price_estimate': {
        const params = new URLSearchParams();
        params.set('skuSlug', String(a.skuSlug));
        if (a.locationCity) params.set('locationCity', String(a.locationCity));
        if (a.urgent) params.set('urgent', 'true');
        return ok(await toolGet('get_price_estimate', params));
      }

      case 'book_task':
        return ok(await toolPost('book_task', {
          skuSlug: a.skuSlug,
          locationCity: a.locationCity,
          locationCountry: a.locationCountry,
          lat: a.lat,
          lng: a.lng,
          instructions: a.instructions,
          webhookUrl: a.webhookUrl,
        }));

      case 'get_booking_status': {
        const params = new URLSearchParams();
        params.set('bookingId', String(a.bookingId));
        return ok(await toolGet('get_booking_status', params));
      }

      // ── Pairing ──

      case 'get_pairing_code':
        return ok(await toolPost('get_pairing_code', {
          code: a.code,
          agentType: a.agentType,
          label: a.label,
        }));

      case 'check_pairing_status':
        return ok(await toolPost('check_pairing_status', {}));

      // ── Bounty ──

      case 'create_bounty':
        return ok(await toolPost('create_bounty', {
          title: a.title,
          description: a.description,
          locationCity: a.locationCity,
          locationAddress: a.locationAddress,
          taskSlug: a.taskSlug,
          budgetMinEur: a.budgetMinEur,
          budgetMaxEur: a.budgetMaxEur,
          deadlineAt: a.deadlineAt,
          applicationDeadlineHours: a.applicationDeadlineHours,
          requiredSkills: a.requiredSkills,
          requiredLevel: a.requiredLevel,
          spotsAvailable: a.spotsAvailable,
          clientEmail: a.clientEmail,
          webhookUrl: a.webhookUrl,
          lang: a.lang,
        }));

      case 'get_bounty_status':
        return ok(await toolPost('get_bounty_status', { bountyId: a.bountyId }));

      case 'get_bounty_applications':
        return ok(await toolPost('get_bounty_applications', {
          bountyId: a.bountyId,
          sortBy: a.sortBy,
        }));

      case 'accept_application':
        return ok(await toolPost('accept_application', {
          bountyId: a.bountyId,
          applicationId: a.applicationId,
        }));

      case 'cancel_bounty':
        return ok(await toolPost('cancel_bounty', {
          bountyId: a.bountyId,
          reason: a.reason,
        }));

      // ── Messaging ──

      case 'send_message':
        return ok(await toolPost('send_message', {
          bookingId: a.bookingId,
          content: a.content,
          messageType: a.messageType,
        }));

      case 'get_conversation':
        return ok(await toolPost('get_conversation', {
          bookingId: a.bookingId,
          limit: a.limit,
          since: a.since,
        }));

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export { server };

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`@hirehuman/mcp v${VERSION} server started`);
}
