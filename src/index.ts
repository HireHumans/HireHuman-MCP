import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = process.env.HIREHUMAN_API_URL ?? 'https://hirehumans.eu/api/hh';

const server = new Server(
  { name: '@hirehuman/mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_humans',
      description: 'Find available verified humans near a location. Returns a list of humans with their skills, ratings and availability.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          city: { type: 'string', description: 'City name (e.g. "Vienna", "Berlin", "Zurich")' },
          country: { type: 'string', description: 'ISO country code: AT, DE, CH, FR, IT, PL', enum: ['AT', 'DE', 'CH', 'FR', 'IT', 'PL'] },
          radius_km: { type: 'number', description: 'Search radius in kilometers (default: 10)', default: 10 },
          skill: { type: 'string', description: 'Required skill category (optional)', enum: ['logistics', 'mystery', 'animals', 'bureaucracy', 'social', 'documentation', 'transport', 'health', 'audit', 'compliance', 'real_estate', 'events'] },
          min_rating: { type: 'number', description: 'Minimum rating (1.0-5.0, default: 0)', default: 0 },
          available_now: { type: 'boolean', description: 'Only return humans available right now (default: false)', default: false },
        },
        required: ['city', 'country'],
      },
    },
    {
      name: 'get_catalog',
      description: 'Browse all available task types with pricing, typical duration and deliverables. Use this before booking to find the right task slug.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          category: { type: 'string', description: 'Filter by category (optional)' },
          country: { type: 'string', description: 'Country for local pricing (AT, DE, CH)', default: 'AT' },
        },
      },
    },
    {
      name: 'get_price_estimate',
      description: 'Get a price estimate for a task before booking. Returns min/max price range and typical duration.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task_slug: { type: 'string', description: 'Task identifier from get_catalog (e.g. "dog-walk-30min")' },
          city: { type: 'string', description: 'City for location-based pricing' },
          country: { type: 'string', enum: ['AT', 'DE', 'CH', 'FR', 'IT', 'PL'] },
        },
        required: ['task_slug', 'city', 'country'],
      },
    },
    {
      name: 'book_task',
      description: 'Book a human to perform a physical task. Payment is held in escrow until the human uploads photo proof. Returns a booking ID for status tracking.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task_slug: { type: 'string', description: 'Task identifier from get_catalog' },
          city: { type: 'string', description: 'City where the task should be performed' },
          country: { type: 'string', enum: ['AT', 'DE', 'CH', 'FR', 'IT', 'PL'] },
          deadline_iso: { type: 'string', description: 'Task deadline in ISO 8601 format (e.g. "2026-03-15T18:00:00Z")' },
          notes: { type: 'string', description: 'Additional instructions for the human (max 500 chars)', maxLength: 500 },
          human_id: { type: 'string', description: 'Specific human ID from search_humans (optional - if omitted, best match is auto-selected)' },
          payment_method_id: { type: 'string', description: 'Stripe payment method ID (required for production keys)' },
        },
        required: ['task_slug', 'city', 'country', 'deadline_iso'],
      },
    },
    {
      name: 'get_booking_status',
      description: 'Track the status of a booking. Returns current status, human details, proof photo URL (if uploaded), and payout info.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          booking_id: { type: 'string', description: 'Booking ID returned by book_task' },
        },
        required: ['booking_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = process.env.HIREHUMAN_API_KEY ?? 'hh_demo_public_v1';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    'User-Agent': '@hirehuman/mcp/0.1.0',
  };

  async function apiCall(method: string, endpoint: string, body?: Record<string, unknown>): Promise<unknown> {
    const resp = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Unknown error');
      throw new Error(`API error ${resp.status}: ${errorText}`);
    }
    return resp.json();
  }

  try {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    switch (name) {
      case 'search_humans': {
        const params = new URLSearchParams({
          city: String(a.city),
          country: String(a.country),
          radius_km: String(a.radius_km ?? 10),
          ...(a.skill ? { skill: String(a.skill) } : {}),
          ...(a.min_rating ? { min_rating: String(a.min_rating) } : {}),
          ...(a.available_now ? { available_now: 'true' } : {}),
        });
        const data = await apiCall('GET', `/humans/search?${params}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_catalog': {
        const params = new URLSearchParams({
          ...(a.category ? { category: String(a.category) } : {}),
          country: String(a.country ?? 'AT'),
        });
        const data = await apiCall('GET', `/catalog?${params}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_price_estimate': {
        const data = await apiCall('POST', '/price-estimate', {
          taskSlug: a.task_slug, city: a.city, country: a.country,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
      case 'book_task': {
        const data = await apiCall('POST', '/bookings', {
          taskSlug: a.task_slug, cityName: a.city, country: a.country,
          deadline: a.deadline_iso, notes: a.notes, humanId: a.human_id,
          paymentMethodId: a.payment_method_id,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_booking_status': {
        const data = await apiCall('GET', `/bookings/${a.booking_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
  }
});

export { server };

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('@hirehuman/mcp server started');
}
