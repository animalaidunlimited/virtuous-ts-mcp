# virtuous-ts-mcp

Read-only [MCP](https://modelcontextprotocol.io) server for [Virtuous CRM+](https://www.virtuoussoftware.com/). It gives a host (Claude Desktop, Cursor, Grok Bot) twelve curated tools for contacts, gifts, and campaigns. The model never sees your API key. The host calls this process, and this process calls Virtuous.

v0.1 is read-only on purpose. The client is created with `readOnly: true`, so a write is rejected before it is sent. `VIRTUOUS_ALLOW_WRITES` is parsed, but it does not register write tools. Writes arrive in v0.2, behind that flag and a confirm step.

Built on [virtuous-ts](https://github.com/animalaidunlimited/virtuous-ts) ^1.1.2 from npm.

## Install and run

Requires Node 20+. No clone is required:

```bash
npx -y virtuous-ts-mcp
```

The process speaks MCP on stdin/stdout. Logs go to stderr only. Set these variables in the host `env` (see Client setup). From a shell, export them before the command. Names and defaults match `.env.example`.

| Variable | Default | Notes |
|---|---|---|
| `VIRTUOUS_API_KEY` | required | Fail fast if missing. Use a dedicated read-only user. |
| `VIRTUOUS_BASE_URL` | `https://api.virtuoussoftware.com/api/` | Include the trailing slash. |
| `VIRTUOUS_MAX_RECORDS` | `10000` | Hard cap for `query_gifts` and `query_contacts`. |
| `VIRTUOUS_RATE_RESERVE` | `50` | Refuse a call when remaining quota is at or below this. |
| `VIRTUOUS_ALLOW_WRITES` | `false` | Parsed. v0.1 ignores it and stays read-only. |

### From source

```bash
git clone https://github.com/animalaidunlimited/virtuous-ts-mcp.git
cd virtuous-ts-mcp
npm install
npm run build
node dist/index.js
```

## Client setup

The host launches this process and passes the key in `env`. Do not put the key in a prompt.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "virtuous": {
      "command": "npx",
      "args": ["-y", "virtuous-ts-mcp"],
      "env": {
        "VIRTUOUS_API_KEY": "your-read-only-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add virtuous --env VIRTUOUS_API_KEY=your-read-only-key -- npx -y virtuous-ts-mcp
```

### Cursor

`.cursor/mcp.json` in the project, or Cursor Settings, MCP:

```json
{
  "mcpServers": {
    "virtuous": {
      "command": "npx",
      "args": ["-y", "virtuous-ts-mcp"],
      "env": {
        "VIRTUOUS_API_KEY": "your-read-only-key"
      }
    }
  }
}
```

### Grok Bot

Same shape: a `command` plus `env`.

```json
{
  "mcpServers": {
    "virtuous": {
      "command": "npx",
      "args": ["-y", "virtuous-ts-mcp"],
      "env": {
        "VIRTUOUS_API_KEY": "your-read-only-key",
        "VIRTUOUS_RATE_RESERVE": "50"
      }
    }
  }
}
```

From a checkout, point `command` at `node` and `args` at the absolute path of `dist/index.js` after `npm run build`.

## Tool reference

All twelve tools are read-only (`readOnlyHint`, `openWorldHint`).

| Tool | Input | virtuous-ts call |
|---|---|---|
| `find_contact` | `{ email?, referenceSource?, referenceId? }` (email, or both reference fields) | `contact.findContactByEmailOrReference` |
| `search_contacts` | `{ text: min 2, take <= 50 = 10 }` | `contact.searchContacts` |
| `get_contact` | `{ contactId }` | `contact.getContactById` |
| `get_contact_tags` | `{ contactId }` | `contactTag.getTagsForContact`, paged with `listAll` |
| `query_contacts` | `{ query, maxRecords <= cap = 1000, full = false }` | `validateQuery` then `contact.queryAllContacts` (or `queryAll` over `queryContactsWithFullDetails` when `full`) |
| `get_gifts_by_contact` | `{ contactId, take <= 100 = 25, sortBy?, descending = true }` | `gift.getGiftsByContact` |
| `query_gifts` | `{ query, maxRecords <= cap = 1000, full = false }` | `validateQuery` then `gift.queryAllGifts` (or `queryAll` over `queryGiftsWithFullDetails` when `full`) |
| `list_campaigns` | `{ nameContains?, take <= 100 = 50 }` | `campaign.queryCampaigns` |
| `get_campaign_steps` | `{ campaignId }` | `campaign.getCampaignSteps` |
| `get_query_options` | `{ resource: Contact \| Gift \| Campaign \| Project \| RecurringGift \| ContactNote }` | the matching `get*QueryOptions` / `queryContactOptions`, via the client cache |
| `get_reference_data` | `{ kind: tags \| contactTypes \| contactCustomFields \| giftCustomFields \| prefixes \| nonCashGiftTypes }` | `listAllTagsFully`, `listAll`, or the plain catalog method |
| `get_rate_limit_status` | `{}` | `virtuous.getRateLimitStatus()` (no HTTP call) |

Call `get_query_options` before `query_gifts` or `query_contacts`. Parameter names are case-sensitive display names (`Gift Date`, not `giftDate`). A bad query returns `isError` with `issues` and `suggestion`, and the query is not sent.

List responses look like `{ total, returned, truncated, records }`. Records are trimmed (nulls dropped, nested arrays capped). Above 200 rows, the response is a summary (count, sum of amount, date range) plus the first 50 records.

## Rate limits and caps

Virtuous allows 5,000 requests per hour for the whole organization, shared by every integration. This server:

- Tracks `X-RateLimit-*` and refuses a call when remaining is at or below `VIRTUOUS_RATE_RESERVE` (default 50), so other apps keep headroom.
- Enables virtuous-ts retries (`retry: {}`: 3 tries, 429/502/503/504 only).
- Caps `queryAll` at `VIRTUOUS_MAX_RECORDS` (default 10,000). A hit is `truncated: true`, not an error.
- Summarizes lists above 200 rows so a host context window is not filled with gifts.

`get_rate_limit_status` reads the local snapshot. It does not spend a request. Null fields mean this process has not seen a response yet.

## Writes (v0.2)

Not built. The design, so a later version can follow it:

- Register write tools only when `VIRTUOUS_ALLOW_WRITES=true`, and create the client without `readOnly`.
- Every write takes `confirm: false` by default. `false` returns a preview (method, path, body, and a before/after diff) and does nothing. `true` executes. An optional `confirmToken` (a hash of the preview) must be echoed so the confirmed call matches the preview.
- Candidates: `add_contact_tag`, `create_contact_note`, `create_task`, `update_contact_safely`.
- `create_task` must set `ownerEmail` to a real Virtuous user. Validate it against `/User` first, or the task is created with no owner.

In v0.1, setting the flag only logs a warning to stderr.

## Security

- Create a Virtuous user that can read and cannot edit. Issue the API key for that user.
- Keep the key in the host `env`, not in chat, not in the repo, not in logs. Errors are scrubbed of bearer tokens and header-shaped secrets.
- stdout is the protocol. This server never writes logs there.

## Development

```bash
npm test          # vitest, mocked client only
npm run typecheck
npm run build
npm start
npm run inspector # MCP Inspector against dist/index.js
```

`npm run test:live` points at a skipped test. It does not call Virtuous. Do not add a live runner to the default test script.

## Dependency

This package depends on [virtuous-ts](https://www.npmjs.com/package/virtuous-ts) `^1.1.2` from npm. The public API used here (`VirtuousClient`, `queryAll`, `listAll`, `validateQuery`, `queryAllGifts`, `queryAllContacts`) is stable in 1.1.

## Deviations from spec

The spec names a few methods that virtuous-ts 1.1 does not export. The closest real call is used.

| Spec | Real call | Why |
|---|---|---|
| `contact.queryContacts*` / `queryAll(contact.queryContacts*)` | `contact.queryAllContacts` for the default path. `queryAll(contact.queryContactsWithFullDetails)` when `full` is true. | There is no `queryContacts`. Abbreviated paging already exists as `queryAllContacts`. |
| `gift.queryGifts*` / `queryAll(gift.queryGifts*)` | `gift.queryAllGifts` by default. `queryAll(gift.queryGiftsWithFullDetails)` when `full` is true. | There is no `queryGifts`. `queryAllGifts` pages abbreviated gifts. |
| `contact.queryContactOptions` (spec said `getContactQueryOptions`) | `contact.queryContactOptions` | That is the real name. Gift, campaign, project, recurring gift, and contact note use `get*QueryOptions`. |
| `listAll(...)` for every reference kind | `contactTag.listAllTagsFully` for tags. `listAll` over `gift.getNonCashGiftTypes` for non-cash types. Plain GETs for contact types, custom fields, and prefixes. | Those catalog endpoints return a plain array and ignore `skip`/`take`. Virtuous may return only the first 10. The tool says so in `note`. |
| `list_campaigns` via `campaign.queryCampaigns` | `buildCampaignQuery({ nameContains })`, or `{ groups: [] }` when no filter is given. | `queryCampaigns` requires a query body. An empty `groups` array is the unfiltered query Virtuous accepts. |

Contact query options are cached under the key `Contact` (and gifts under `Gift`), using `virtuous.queryOptionsCache` when the client has one.

## Credits

Design ideas from [colecantu904/virtuous-mcp](https://github.com/colecantu904/virtuous-mcp) (Python, FastMCP). That server discovers endpoints and can call any of them. This one ships a short, described tool list instead, and refuses writes by default.

Copyright 2026 Spencer Hardy and Animal Aid Unlimited. MIT.

## Learning notes: MCP in 2 minutes

- **Roles:** the *host* (Claude Desktop, Grok Bot) runs an MCP *client* that connects to your *server*. The model never talks to Virtuous: it asks the host to call a tool, the host asks your server, and your server calls the API with its own key.
- **Primitives:** *tools* (functions the model can call, which is all we use), *resources* (readable data such as docs) and *prompts* (reusable templates). Start with tools.
- **Handshake:** the client sends `initialize`, then `tools/list` (names, descriptions and JSON Schema from your zod), then `tools/call` with arguments. It's all JSON-RPC 2.0.
- **Transports:** *stdio*, where the host launches your process and talks over stdin/stdout (local and simple; hence logs only on stderr). *Streamable HTTP* is a URL endpoint for remote or shared servers (Cloud Run); it needs auth in front.
- **Results:** `content: [{ type: 'text', text }]`, plus `isError: true` for errors the model should read and correct. Throwing is for real bugs.
- **Design lessons:** few clear tools beat 291 raw endpoints; descriptions are your prompt engineering; return small, structured output; make dangerous things impossible by default (read-only client, flag, confirm).
- **Compared with Cole's Python version:** FastMCP decorators correspond to `server.registerTool(name, { description, inputSchema }, handler)`, and Pydantic corresponds to zod. His discovery tools (`list_endpoints`/`call_endpoint`) trade safety for coverage; we choose curated tools first.

Minimal tool, for reference:

```ts
server.registerTool('get_contact',
  { description: 'Get one contact by Virtuous contact ID.', inputSchema: { contactId: z.number().int() },
    annotations: { readOnlyHint: true } },
  async ({ contactId }) => ok(trim(await virtuous.contact.getContactById(contactId))));
```
