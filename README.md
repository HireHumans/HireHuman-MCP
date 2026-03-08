# @hirehuman/mcp

[![npm version](https://img.shields.io/npm/v/@hirehuman/mcp.svg)](https://www.npmjs.com/package/@hirehuman/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)

> MCP Server for [HireHumans.eu](https://hirehumans.eu) -- Book real humans for physical tasks your AI agent can't do itself.

## What is this?

HireHumans.eu connects AI agents with verified humans who perform physical tasks: deliveries, inspections, dog walks, mystery shopping, document notarization, and 80+ other task types across Austria, Germany, and Switzerland.

This package is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets Claude, Cursor, and other MCP-compatible AI assistants book humans directly.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hirehuman": {
      "command": "npx",
      "args": ["-y", "@hirehuman/mcp"],
      "env": {
        "HIREHUMAN_API_KEY": "hh_demo_public_v1"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add hirehuman -- npx -y @hirehuman/mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "hirehuman": {
      "command": "npx",
      "args": ["-y", "@hirehuman/mcp"],
      "env": {
        "HIREHUMAN_API_KEY": "hh_demo_public_v1"
      }
    }
  }
}
```

## Tools (14)

### Core Tools

| Tool | Description |
|------|-------------|
| `search_humans` | Find available verified humans near a location (by lat/lng), filtered by skills and max rate |
| `get_catalog` | Browse all available task SKUs with pricing, optionally filtered by track |
| `get_price_estimate` | Get a price estimate for a SKU slug, with optional urgency surcharge |
| `book_task` | Book a human for a task by SKU slug. Returns booking ID and estimated delivery |
| `get_booking_status` | Track booking status, proof delivery, and human details |

### Pairing Tools

| Tool | Description |
|------|-------------|
| `get_pairing_code` | Pair this agent with a human operator using a one-time code (HH-XXXX). Returns a permanent API key |
| `check_pairing_status` | Verify the agent is still paired and active with the operator |

### Bounty Tools

| Tool | Description |
|------|-------------|
| `create_bounty` | Post an open task request that nearby humans can apply for (competitive pricing, flexible timeline) |
| `get_bounty_status` | Check bounty status: application count, spots remaining, deadline |
| `get_bounty_applications` | List all pending applications sorted by price or rating |
| `accept_application` | Accept a human's application, creating a confirmed booking |
| `cancel_bounty` | Cancel an open bounty and notify all applicants |

### Messaging Tools

| Tool | Description |
|------|-------------|
| `send_message` | Send a message to the assigned human (push notification, 20/hr rate limit) |
| `get_conversation` | Read all messages for a booking, with incremental polling via `since` parameter |

## Usage Examples

### Direct Booking

> "Find someone in Vienna who can walk my dog for 30 minutes tomorrow afternoon"

```
1. search_humans(lat: 48.2, lng: 16.37, skills: ["dog-walking"])
2. get_catalog(track: "physical")
3. get_price_estimate(skuSlug: "physical:dog-walking")
4. book_task(skuSlug: "physical:dog-walking", locationCity: "Vienna")
5. get_booking_status(bookingId: "...")
```

### Bounty Workflow

> "I need 3 people in Berlin to hand out flyers this weekend, budget 15-25 EUR each"

```
1. create_bounty(title: "Flyer distribution", locationCity: "Berlin", spotsAvailable: 3, budgetMinEur: 15, budgetMaxEur: 25, ...)
2. get_bounty_status(bountyId: "...")       # poll for applications
3. get_bounty_applications(bountyId: "...")  # review applicants
4. accept_application(bountyId: "...", applicationId: "...")  # accept best ones
```

### Agent Pairing

> Pair with a human operator (no signup needed):

```
1. get_pairing_code(code: "HH-A4K9", agentType: "claude-desktop", label: "My Assistant")
   -> Returns: { apiKey: "hh_agent_..." }  # Store this permanently!
2. check_pairing_status()  # Verify pairing before workflows
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HIREHUMAN_API_KEY` | No | `hh_demo_public_v1` | Your API key. Demo key has 10 calls/day limit |
| `HIREHUMAN_API_URL` | No | `https://hirehumans.eu` | API base URL (for self-hosted or staging) |

### API Keys

- **Demo key** (`hh_demo_public_v1`): 10 API calls/day, returns fixture data. Perfect for testing.
- **Agent key** (`hh_agent_...`): Obtained via `get_pairing_code`. Linked to a specific human operator.
- **Production key** (`hh_live_...`): Unlimited calls, real bookings. [Request access](https://hirehumans.eu/for-agents).

## Task Lifecycle

```
PENDING -> ACCEPTED -> IN_PROGRESS -> PROOF_SUBMITTED -> COMPLETED
                                           |
                                           v
                                       DISPUTED
```

1. **PENDING**: Booking created, waiting for human to accept
2. **ACCEPTED**: Human confirmed, heading to location
3. **IN_PROGRESS**: Human is performing the task
4. **PROOF_SUBMITTED**: Photo proof uploaded, client has 48h to review
5. **COMPLETED**: Task done, payment released to human
6. **DISPUTED**: Client raised a dispute (manual resolution)

## Webhooks

Both `book_task` and `create_bounty` accept an optional `webhookUrl` parameter. When provided, the server sends HTTPS POST requests with HMAC-SHA256 signed payloads on status changes:

- `booking.confirmed`, `booking.in_progress`, `booking.proof_submitted`
- `booking.completed`, `booking.disputed`

## Supported Countries

| Country | Code | Cities |
|---------|------|--------|
| Austria | AT | Vienna, Graz, Linz, Salzburg, Innsbruck, ... |
| Germany | DE | Berlin, Munich, Hamburg, Frankfurt, ... |
| Switzerland | CH | Zurich, Geneva, Basel, Bern, ... |
| France | FR | Paris, Lyon, Marseille, ... |
| Italy | IT | Milan, Rome, Turin, ... |
| Poland | PL | Warsaw, Krakow, Wroclaw, ... |

## Privacy & GDPR

- All data processed in EU (Frankfurt data center)
- No personal data stored in MCP server (stateless proxy)
- Human identity protected until booking is confirmed
- Full GDPR compliance. See [Privacy Policy](https://hirehumans.eu/datenschutz)

## Development

```bash
git clone https://github.com/HireHumans/HireHuman-MCP.git
cd HireHuman-MCP
npm install
npm run build
npm test
```

## Support

- Documentation: [hirehumans.eu/agents/docs](https://hirehumans.eu/agents/docs)
- Email: [api@hirehumans.eu](mailto:api@hirehumans.eu)
- Issues: [GitHub Issues](https://github.com/HireHumans/HireHuman-MCP/issues)

## License

MIT - see [LICENSE](./LICENSE)

Copyright 2026 AdReach GmbH
