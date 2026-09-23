# The Agentic Engineering School

A complete, self-paced course on building software by directing AI coding agents — from "what is an agent, actually?" to running several products at once with gates you trust.

It is one HTML file. No build step, no dependencies, no sign-up. Open it and start.

```bash
open index.html          # macOS
```

---

## Why this exists

Most AI coding advice works beautifully for thirty minutes. Then new features break old ones, the agent contradicts a decision it made an hour earlier, and you keep prompting and hoping. That is not a model problem; it is a workflow problem.

Two practitioners have published how they really work, and they solve different halves of it:

- **The inner loop** — how a single change ships well: scope, architect, build a slice, prove it runs, have a *different* model review it, test, document, update the project's memory. Adapted from [Adrian Hajdin's open-source workflow](https://jsmastery.com/course/agentic-engineering-course).
- **The outer loop** — how many changes ship at once: one agent per independent surface, isolated checkouts, a quality gate before anything reaches you, and eventually several products alive at the same time. Adapted from [Kun Chen's field notes and tools](https://github.com/kunchenguid).

This course teaches both, in the order that makes each one land, with exercises and failure stories of its own. The outer loop multiplies whatever the inner loop produces — run it with a sloppy inner loop and you get five times the mess, five times faster.

---

## What's inside

| | |
|---|---|
| 47 lessons | one per sitting, roughly an hour each |
| 47 exercises | hands on the keyboard, with a predicted outcome first |
| 45 failure stories | how each technique breaks in practice, and the fix |
| 6 projects | end-to-end products, deployed and used |
| 2 drills | inherit a real codebase; rescue a broken build |

**The seven parts**

0. **Orientation** — how to study this, your workbench, the two flows, the route, and bringing your own repo.
1. **One agent** — the loop, context, instruction files, tools and MCP, the four primitives, writing a skill, evidence-based "done", permissions, and what may go into a model.
2. **The feature loop** — scope, architect, develop a slice, verify, review, test/document/sync, choosing an entry point, and the two numbers to track from week one. *Project: Pocket Ledger.*
3. **Inherited and broken code** — audit a codebase, make a safe first change, the three kinds of broken, rescuing a session that went in circles. *Two drills.*
4. **A crew** — delegation, coordination patterns, captain and crew, roles, handoffs, security, automated review, testing, UI work, and working with a team. *Projects: Vault, Book-a-Slot.*
5. **A fleet** — isolation, running a second project, monitoring, unattended overnight runs, incidents, and fleet tooling. *Projects: Live Tracker, Support Copilot.*
6. **Mastery** — earning complexity, sizing a crew, building gates in, measuring whether it works, and designing your own workflow. *Capstone.*

Plus a cheat sheet, a toolbelt index, a glossary and sources.

---

## How to use it

**Start with the core path.** Parts 0–3 plus the first project and both drills — about six weeks at five hours a week. That is where nearly all the transferable skill lives. Everything after is depth you take when a specific problem shows up.

**Run the exercises against your real work.** Twelve lessons carry an *At work* variant aimed at the repository you are actually paid to work in. Lesson 0.5 sets that up safely.

**If you only change five things this week:**

1. A short `AGENTS.md`, with nothing in it the agent could work out from the code.
2. Done means evidence — test output or a screenshot, never "should work now".
3. Review every change in a fresh session that did not write it.
4. One worktree per parallel task, so two agents can never edit the same file.
5. No fix before a one-sentence root cause.

Your progress ticks are saved in the browser, so they survive a reload.

---

## Sharing it with someone

`share.sh` serves the course locally and creates a temporary public link through a Cloudflare quick tunnel:

```bash
./share.sh
# Local:   http://localhost:8787
# Public:  https://something-random.trycloudflare.com
```

Send the public link to whoever you like; it works while the script is running and stops when you press Ctrl+C. The URL is different every run. Requires `cloudflared` (`brew install cloudflared`).

To pick a different port: `PORT=9000 ./share.sh`

> The tunnel has no password. Anyone with the link can read the course while it is running, so treat the link as public.

---

## Tests

The site is a single file with a small router, so it is tested like a site rather than reviewed like a document.

```bash
cd tests
npm install
npm test        # 31 browser tests: routing, progress, filter, mobile drawer, layout
npm run analyze # every page: size, structure, links, and a WCAG 2.1 AA audit via axe-core
```

`npm test` drives real Chrome through Playwright and checks that all 64 pages open from the sidebar, deep links work, previous/next behave at both ends, progress saves and survives a reload, the filter narrows and restores, the phone drawer navigates and closes, nothing scrolls sideways at 390px, and no page throws a JavaScript error.

`npm run analyze` reports word counts and the balance of exercises per part, flags thin or structurally odd pages, and runs axe-core over all 64 pages. Current state: zero accessibility violations.

---

## Credits

The workflow ideas come from work published by others, and each lesson says which:

- [Adrian Hajdin / JS Mastery](https://jsmastery.com/course/agentic-engineering-course) — the nine-stage feature loop and the entry-point selector.
- [Kun Chen](https://blog.kunchenguid.com/) — the crew and fleet model, the review gate, and the tooling around it.
- [Jason Ku](https://github.com/jasonku09/agents-md-snippets) — what belongs in an `AGENTS.md`, and the Altitude teaching method.
- [Anthropic engineering](https://www.anthropic.com/engineering/multi-agent-research-system) — multi-agent findings and the guidance on keeping agent systems simple.
- OWASP, Simon Willison, METR and others, cited on the course's sources page.

Where a number comes from one person's experience rather than a study, the lesson says so.

---

## License

The exercises, prose and structure are my own writing; the ideas are credited above. The code here (the page, the share script, the tests) is free to reuse. If you want to build on the course material itself, open an issue and ask — the answer is almost certainly yes.
