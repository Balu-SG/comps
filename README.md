# Comps

**Find the readers who will actually buy your book.**

Self-published authors live and die by Amazon Ads, and the hardest part is choosing *who to target*: which authors, which titles, which "comp titles" to name. Most authors guess, or copy the bestseller list, and pay for crowded, expensive clicks that don't convert.

Comps is an agent that answers that question from real taste data. You give it your book's title, a short description and a few books you think are similar. It uses [Qloo's](https://qloo.com) taste graph to work out who your readers really are, and gives you:

- **Comp titles** with real reader overlap, each with the Qloo affinity and popularity behind it
- **Amazon Ads targets** (authors, titles, keywords), ranked, with a CSV download
- **Readers outside Amazon**: the podcasts, TV shows, films and brands your readers also like
- **Where your readers are**: places where this taste over-indexes
- **What to skip**: famous names that look like comps but are crowded, expensive targets for a new author
- A **"for fans of X meets Y" pitch line** built from real overlap, not a guess

Every pick shows its evidence, and the full list of Qloo calls the agent made is on the page.

## Why it needs Qloo

An LLM on its own names the same famous books for everyone. It can't tell you how much two readerships overlap, or which podcast those readers listen to. Qloo's cross-domain taste graph can, and every recommendation in Comps comes from a Qloo result.

## How it works

`src/lib/agent.ts` runs a tool-use loop on the Claude API (`claude-opus-5-5`). Claude decides which Qloo calls to make:

| Tool | Qloo endpoint | Used for |
|---|---|---|
| `qloo_search` | `GET /search` | Resolving the book, comps and authors to Qloo IDs |
| `qloo_insights` | `GET /v2/insights` | Books and authors with shared readers; podcasts, TV, films and brands those readers like; destinations where they over-index |
| `submit_plan` | — | Returns the finished plan as validated, structured data |

Qloo results are cached for six hours, and the API route has a per-IP hourly limit so the public demo stays affordable.

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) |
| `QLOO_API_KEY` | Qloo hackathon key (works only against `https://hackathon.api.qloo.com`) |

Without `QLOO_API_KEY` the app runs in **sample mode** on made-up placeholder data, clearly labelled on the page.

## Deploy

Deploy to Vercel, and set the two environment variables in the project settings.

## License

MIT, see [LICENSE](LICENSE).
