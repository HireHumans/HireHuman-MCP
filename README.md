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

## Tools

| Tool | Description |
|------|-------------|
| `search_humans` | Find available verified humans near a location |
| `get_catalog` | Browse all available task types with pricing |
| `get_price_estimate` | Get a price estimate before booking |
| `book_task` | Book a human for a physical task (escrow payment) |
| `get_booking_status` | Track booking status and proof delivery |

## Usage Example

Once configured, just ask Claude naturally:

> "Find someone in Vienna who can walk my dog for 30 minutes tomorrow afternoon"

Claude will:
1. Call `search_humans` to find available humans near Vienna
2. Call `get_catalog` to find the right task type
3. Call `get_price_estimate` to check pricing
4. Call `book_task` to create the booking
5. Return the booking ID for tracking

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HIREHUMAN_API_KEY` | No | `hh_demo_public_v1` | Your API key. Demo key has 10 calls/day limit |
| `HIREHUMAN_API_URL` | No | `https://hirehumans.eu/api/hh` | API base URL (for self-hosted or staging) |

### API Keys

- **Demo key** (`hh_demo_public_v1`): 10 API calls/day, returns fixture data. Perfect for testing.
- **Production key** (`hh_live_...`): Unlimited calls, real bookings with real humans. [Request access](https://hirehumans.eu/for-agents).

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
git clone https://github.com/hirehumans-eu/hirehuman-mcp.git
cd hirehuman-mcp
npm install
npm run build
npm test
```

## Support

- Documentation: [hirehumans.eu/for-agents/docs](https://hirehumans.eu/for-agents/docs)
- Email: [api@hirehumans.eu](mailto:api@hirehumans.eu)
- Issues: [GitHub Issues](https://github.com/hirehumans-eu/hirehuman-mcp/issues)

## License

MIT - see [LICENSE](./LICENSE)

Copyright 2026 AdReach GmbH
