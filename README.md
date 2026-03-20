# hirehuman-mcp

MCP server for [HireHumans.eu](https://hirehumans.eu) — book verified humans for physical real-world tasks via AI agents.

Search for available humans by location, browse 80+ task types across 12 categories, get price estimates, book tasks with GPS-verified photo proof, post bounties for competitive pricing, and communicate with humans in real time. EU-hosted and GDPR-compliant.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hirehuman": {
      "command": "npx",
      "args": ["-y", "hirehuman-mcp"],
      "env": {
        "HIREHUMAN_API_KEY": "hh_demo_public_v1"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add hirehuman -- npx -y hirehuman-mcp
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "hirehuman": {
      "command": "npx",
      "args": ["-y", "hirehuman-mcp"],
      "env": {
        "HIREHUMAN_API_KEY": "hh_demo_public_v1"
      }
    }
  }
}
```

## Demo Key

The demo key `hh_demo_public_v1` is included by default — no signup required. It provides:

- 10 API calls per day
- Read-only access (search, catalog, pricing)
- Mock booking responses

Get a production key at [hirehumans.eu/agents](https://hirehumans.eu/agents).

## Tools

### Core

| Tool | Description |
|------|-------------|
| `search_humans` | Find available verified humans near a location |
| `get_catalog` | Browse all available task types with prices |
| `get_price_estimate` | Get price range before booking |
| `book_task` | Book a human for a physical task |
| `get_booking_status` | Track booking status and retrieve photo proof |

### Pairing

| Tool | Description |
|------|-------------|
| `get_pairing_code` | Pair agent with a human operator using a one-time code |
| `check_pairing_status` | Check if agent is still paired and active |

### Bounties

| Tool | Description |
|------|-------------|
| `create_bounty` | Post an open task request for competitive pricing |
| `get_bounty_status` | Check bounty status and application count |
| `get_bounty_applications` | Review pending applications for a bounty |
| `accept_application` | Accept a human's bounty application |
| `cancel_bounty` | Cancel an open bounty |

### Messaging

| Tool | Description |
|------|-------------|
| `send_message` | Send a message to the assigned human |
| `get_conversation` | Read conversation messages for a booking |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `HIREHUMAN_API_KEY` | `hh_demo_public_v1` | Your API key |
| `HIREHUMAN_API_URL` | `https://hirehumans.eu` | API base URL |
| `HIREHUMAN_MOCK_MODE` | `false` | Local testing without API calls |
| `HIREHUMAN_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `HIREHUMAN_DEBUG` | `false` | Enable debug logging to stderr |

## Mock Mode

For local development and testing without making real API calls:

```json
{
  "mcpServers": {
    "hirehuman": {
      "command": "npx",
      "args": ["-y", "hirehuman-mcp"],
      "env": {
        "HIREHUMAN_MOCK_MODE": "true"
      }
    }
  }
}
```

All tools return realistic sample data in mock mode.

## Task Categories

Logistics, Bureaucracy, Mystery Shopping, Health, Animals, Transport, Home & Garden, Events, Education, IT & Tech, Personal Services, Other — 80+ task types total.

## Requirements

- Node.js 18+
- An MCP-compatible client (Claude Desktop, Cursor, Claude Code, etc.)

## Links

- [Documentation](https://hirehumans.eu/agents/docs)
- [API Keys](https://hirehumans.eu/agents)
- [GitHub](https://github.com/hirehuman/hirehuman-mcp)

## License

MIT - see [LICENSE](LICENSE)
