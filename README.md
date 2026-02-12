# RCFA V1

AI-guided Root Cause Failure Analysis tool that standardizes investigations and serves as a searchable system of record.

## Quick Start

**Prerequisites:** Node.js 18+, PostgreSQL, OpenAI API key

```bash
git clone <repo-url> && cd rcfa-v1
npm install
cp .env.example .env.local   # then fill in your values
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Documentation

- [Product Brief](./docs/01-product-brief/V1%20One%20Page%20Product%20Brief.md) -- Problem, V1 goal, scope
- [Intake Form](./docs/02-intake/V1%20Intake%20Form.md) -- Field definitions for the RCFA intake form
- [AI Prompt](./docs/03-ai/RCFA%20V1%20ChatGPT%20Prompt.md) -- AI analysis prompt / route source
- [Data Model](./docs/04-data-model/RCFA%20V1%20Data%20Model.md) -- Entity definitions and relationships
- [Master Spec](./docs/v1_master_spec.md) -- Full V1 specification

<details>
<summary>Environment Variables</summary>

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | Yes | Direct DB connection for migrations (bypasses connection pooler) |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | Model name (defaults to `gpt-5.2`) |
| `AUTH_TOKEN_SECRET` | Yes | Secret for signing auth tokens |

</details>
