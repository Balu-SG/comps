# Comps: Devpost submission text

Paste each section into the matching Devpost field.

---

## Project name
Comps

## Tagline (Devpost limit: 200 characters)
An AI agent that reads Qloo's taste graph to find the readers who will actually buy your book: real comp titles, Amazon Ads targets, and the podcasts, shows and places those readers love.

## Links
- Try it: https://comps-eight-henna.vercel.app
- Code (MIT): https://github.com/Balu-SG/comps

---

## Inspiration

Every creator launching something new faces the same question: **who is my audience, and where do I find them?**

For self-published authors it's a money question. Over a million books are self-published every year, and most authors sell them through Amazon Ads. To run those ads you have to choose which books and authors to target. Most authors guess, or copy the bestseller list. Then they bid against thousands of other authors on the same famous names, pay for expensive clicks, and quit.

We asked a general-purpose LLM for help and saw the problem straight away. It suggests the same famous books to everyone, and it can't tell you whether those readers would ever pick up *your* book. That's a taste question, and taste is what Qloo's data measures.

## What it does

You enter your book's title, a short description and a few books you think are similar. A minute later, Comps gives you a **reader intelligence report**:

- **A pitch line**, "For fans of X meets Y", built from real reader overlap, ready for your book description and ads.
- **Comp titles**, each showing Qloo's *affinity* (how strongly your readers like it) and *popularity* (how crowded it is for ads).
- **Amazon Ads targets**: titles, authors and keywords, ranked by priority, with the reason for each. Export them as CSV and paste them into Amazon Ads.
- **Readers outside Amazon**: the podcasts, TV shows, films and brands your readers over-index on, for sponsorships, guest spots and social ad targeting.
- **Where your readers cluster**: places for location targeting, bookstore events and local press.
- **What to skip**: famous names that look like obvious comps but would burn a new author's budget.

Three features make the reasoning visible:

1. **A live agent timeline.** You watch every Qloo call as it happens: what the agent asked, and what came back.
2. **The Taste Map.** Every book and author Qloo returned is plotted by affinity against popularity. A shaded sweet spot shows the strong-fit, less-crowded picks a new author should go after.
3. **LLM alone vs. Comps with Qloo.** On every run, a plain LLM answers the same question in parallel, and the report puts the two side by side, with the LLM's guesses scored against Qloo.

No book handy? The homepage replays three real recorded runs (cozy mystery, space survival, folk horror) in a few seconds.

## What makes it Qloo-powered

Without Qloo, Comps would be just another chatbot list. **Every comp, ad target, channel and region in the report must come from a Qloo result in that run**, and the agent cites Qloo's numbers as evidence.

In each run the agent makes about a dozen Qloo calls across **seven entity types**: books, authors, podcasts, TV shows, films, brands and destinations. It works in three rounds:

1. **Resolve.** `/search` finds the author's book, their comps, and those comps' authors as Qloo entities.
2. **Read the taste graph.** `/v2/insights` with those entities as signals asks what the same readers also love, in books and authors (comp titles) and in podcasts, TV, films and brands (channels).
3. **Locate.** `/v2/insights` for destinations shows where these readers cluster.

Then it weighs **affinity against popularity**. Strong fit with moderate popularity is a good target. Very high popularity means a crowded, expensive target, so it goes on the skip list. An LLM can't make that trade-off, because it has neither number.

**The difference, measured.** We ran Comps on five test books in five genres and scored the plain LLM's suggestions with Qloo too:

- **1 of the LLM's 30 suggestions** appeared among the books and authors Qloo matched to those readers. The LLM picks from fame. It often just repeated the author's own guesses back to them: for our folk horror book it suggested *The Loney* and *Harvest Home*, the two comps the author had typed in.
- In **three of five genres** (cozy mystery, space survival, folk horror), Comps' picks were **31%, 16% and 13% less mainstream** than the LLM's, with reader fit measured. Less mainstream means fewer authors bidding, so ads cost less.
- In the two most mainstream genres we tried (family drama, romance), Qloo rates nearly every match at the top of its popularity scale, so there was no crowding difference to find. We report that rather than hide it. The reader-overlap evidence still holds there.

## How we built it

- **Agent:** a tool-use loop on the Claude API (Claude Opus 5.5). Claude decides which Qloo calls to make, runs independent calls in parallel, and submits the plan through a strict, schema-validated `submit_plan` tool, so the output is always structured data.
- **Qloo tools:** `qloo_search` (`GET /search`) and `qloo_insights` (`GET /v2/insights` with `signal.interests.entities`, `filter.type` and explainability). The Qloo client caches results, caps concurrent requests and retries politely on rate limits.
- **Self-check:** before the plan reaches you, code checks it against Qloo's popularity data and sends it back to the agent once if it leans on crowded names.
- **Control group:** a separate LLM-only call, run in parallel. Its suggestions are looked up in Qloo afterwards so they can be scored on the same scale.
- **Streaming:** the API route streams newline-delimited JSON events, so the page shows each Qloo call live. Recorded runs replay the same event stream for instant demos.
- **Front end:** Next.js 15, TypeScript and Tailwind, with a hand-built SVG Taste Map that has hover tooltips, keyboard focus and a table view. Light and dark mode, mobile friendly.
- **Hosting:** Vercel. API keys are stored as encrypted environment variables and never reach the browser.

## Challenges we ran into

- **Choosing the right signals.** Qloo returns nothing for destinations when the signals are book IDs. The agent now uses author and TV-show entities as signals for places, and the tool description tells it so.
- **Rate limits.** Parallel calls from several users quickly hit the hackathon key's limit. We added a small request queue and backoff, so a busy demo slows down slightly but doesn't fail.
- **Waiting is boring.** The first version showed a spinner for about 90 seconds. We cut run time to about 55 seconds by having the agent work in three parallel rounds at lower reasoning effort, then streamed every step to the screen, so you see results from the first few seconds.
- **The agent didn't always follow its own advice.** Even when told to prefer less-crowded comps, it sometimes picked bestsellers. So we added a **self-check in code**: when the agent submits its plan, Comps measures how many comps are on the less-crowded side of the books Qloo returned. If fewer than half are, the plan goes back to the agent with a list of less-crowded alternatives from Qloo. You can see this step in the live timeline.
- **Honest comparison.** Comparing against an LLM is only fair if both answers are scored the same way, so the LLM's guesses go through Qloo too, and we report the numbers even where the gap is small.

## Accomplishments that we're proud of

- Every recommendation is traceable: you can open the full list of Qloo calls behind any report.
- The Taste Map makes taste data understandable at a glance, even if you've never heard of "affinity".
- The LLM-vs-Qloo comparison runs on every request, so judges can test our claim on their own book, not just ours.
- It's useful today: the ad targets export straight into an Amazon Ads campaign.

## What we learned

- Taste data and language models do different jobs. Qloo knows *who likes what*. The LLM is good at planning the queries and explaining the results in plain language. Neither alone produces a plan an author can trust.
- The most useful number for a new author isn't fit alone, it's **fit relative to crowding**. That turned popularity from a vanity metric into a cost signal.
- Showing the agent's work matters. A list of comps is easy to dismiss, but a list where you watched each Qloo call happen, and can hover any number to see what it means, is something you can act on.

## What's next for Comps

- **Shareable report links**, so an author can send a plan to an editor, agent or cover designer.
- **Campaign feedback:** import Amazon Ads results and let the agent re-plan around what actually converted.
- **Beyond books:** the same agent works for any creator's "who is my audience?" problem. Similar artists for an independent musician's playlist pitching, cross-promotion partners for a podcaster, positioning for an indie game. The Qloo entity types are already there.
- **An MCP server**, so authors can use Comps from inside the AI assistants they already use.

## Built with
qloo · claude · anthropic · typescript · next.js · react · tailwindcss · vercel · zod · svg

---

## Checklist before submitting
- [ ] Demo link works in a private browser window
- [ ] Repo is public and the About box shows the MIT license
- [ ] 3–5 screenshots uploaded (hero, live timeline, Taste Map, LLM vs Qloo, ad targets)
- [ ] Submit before Oct 30, 11:45 PM EDT
