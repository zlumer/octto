# opencode-brainstormer

Interactive UI tools for OpenCode agents. Enables structured user input through a browser-based interface - decisions, ratings, text input, file uploads, and more.

## Why

Terminal-based agent interactions are limiting for complex input gathering. This plugin opens a browser window where users can answer questions through rich UI components while the agent continues working asynchronously.

## Install

```bash
bun add opencode-brainstormer
```

Add to your OpenCode config:

```json
{
  "plugins": ["opencode-brainstormer"]
}
```

## Quick Start

```typescript
// 1. Start a session (opens browser)
const session = await start_session({ title: "Feature Design" });
// Returns: { session_id: "ses_abc123", url: "http://localhost:54321" }

// 2. Push questions (returns immediately)
const q1 = await pick_one({
  session_id: session.session_id,
  question: "Which approach should we use?",
  options: [
    { id: "a", label: "Option A", description: "Fast but limited" },
    { id: "b", label: "Option B", description: "Slower but flexible" },
  ],
  recommended: "b",
});
// Returns: { question_id: "q_xyz789" }

// 3. Get the answer (blocks until user responds)
const answer = await get_answer({
  question_id: q1.question_id,
  block: true,
  timeout: 300000, // 5 minutes
});
// Returns: { completed: true, status: "answered", response: { selected: "b" } }

// 4. End session when done
await end_session({ session_id: session.session_id });
```

## Tools

### Session Management

| Tool | Description |
|------|-------------|
| `start_session` | Opens browser window, returns session_id and URL |
| `end_session` | Closes session and cleans up resources |

### Question Tools

All question tools return immediately with a `question_id`. Use `get_answer` to retrieve responses.

**Decision/Choice:**

| Tool | Description |
|------|-------------|
| `pick_one` | Single selection from options (radio buttons) |
| `pick_many` | Multiple selection with optional min/max constraints |
| `confirm` | Yes/No/Cancel confirmation |
| `rank` | Drag-to-reorder items |
| `rate` | Rate items on a numeric scale |

**Input:**

| Tool | Description |
|------|-------------|
| `ask_text` | Single or multi-line text input |
| `ask_image` | Image upload via drag/drop, paste, or file picker |
| `ask_file` | Generic file upload with type/size constraints |
| `ask_code` | Code input with syntax highlighting |

**Presentation/Feedback:**

| Tool | Description |
|------|-------------|
| `show_diff` | Display before/after diff, get approve/reject/edit |
| `show_plan` | Show markdown sections for review with annotations |
| `show_options` | Display options with pros/cons for selection |
| `review_section` | Content review with inline feedback |

**Quick:**

| Tool | Description |
|------|-------------|
| `thumbs` | Thumbs up/down |
| `emoji_react` | Emoji reaction |
| `slider` | Numeric range slider |

### Response Tools

| Tool | Description |
|------|-------------|
| `get_answer` | Get answer (blocking or non-blocking) |
| `list_questions` | List all questions and their status |
| `cancel_question` | Cancel a pending question |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenCode Plugin                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │    Tools    │───▶│   Session   │───▶│   HTTP +    │     │
│  │  (21 tools) │    │   Manager   │    │  WebSocket  │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
└──────────────────────────────────────────────│─────────────┘
                                               │ WebSocket
                                               ▼
                                    ┌─────────────────────┐
                                    │    Browser UI       │
                                    │  (Inline HTML/JS)   │
                                    └─────────────────────┘
```

1. **Agent calls `start_session`** - Creates HTTP server on random port, opens browser
2. **Agent pushes questions** - Questions queue in SessionManager, push to browser via WebSocket
3. **User answers in browser** - Response sent back via WebSocket, stored until retrieved
4. **Agent calls `get_answer`** - Returns response (or waits if `block: true`)
5. **Agent calls `end_session`** - Server shuts down, browser shows "Session ended"

### Resilience

- **Browser closed?** Questions queue until browser reopens. Next question push re-opens browser automatically.
- **Agent crashes?** Plugin hooks into OpenCode's `session.deleted` event to clean up.
- **User too slow?** Optional timeout per `get_answer` call returns `{ completed: false, status: "timeout" }`.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Format & lint
bun run check
```

### Project Structure

```
src/
├── index.ts              # Plugin entry point
├── types.ts              # Question config and response types
├── session/
│   ├── manager.ts        # Session lifecycle, question queue
│   ├── server.ts         # Bun HTTP/WebSocket server
│   ├── browser.ts        # Cross-platform browser opener
│   └── types.ts          # Internal session types
├── tools/
│   ├── index.ts          # Tool aggregator
│   ├── session.ts        # start_session, end_session
│   ├── questions.ts      # 16 question type tools
│   └── responses.ts      # get_answer, list_questions, cancel_question
└── ui/
    └── bundle.ts         # Inline HTML/JS UI bundle
```

## License

MIT
