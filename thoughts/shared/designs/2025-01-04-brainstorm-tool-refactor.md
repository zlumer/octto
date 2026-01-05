# Brainstorm Tool Refactor Design

## Problem Statement

The current brainstormer plugin uses a multi-agent orchestration pattern:
1. **Orchestrator agent** (brainstormer) - coordinates the flow
2. **Bootstrapper subagent** - generates initial 2-3 questions
3. **Probe subagent** - generates follow-up questions based on answers

This architecture has issues:
- Orchestration is unreliable (agent doesn't always follow the workflow correctly)
- Complex coordination between multiple agents via `task` tool spawning
- Hard to debug and maintain

## Proposed Solution

Collapse the entire brainstorming flow into a **single blocking tool** called `brainstorm`. The calling agent provides context and initial questions, and the tool handles everything internally.

## Interface

### Input

```typescript
interface BrainstormInput {
  context: string;        // Background info the calling agent gathered
  request: string;        // User's original request
  initial_questions: Array<{
    type: QuestionType;   // "pick_one" | "ask_text" | "confirm" | etc.
    config: QuestionConfig;
  }>;
}
```

### Output

```typescript
interface BrainstormOutput {
  answers: Array<{
    question: string;     // The question text
    type: QuestionType;
    answer: unknown;      // User's response (varies by type)
  }>;
  summary: string;        // LLM-synthesized design doc/requirements
}
```

## Internal Behavior

1. **Start Session**: Open browser with initial questions (non-blocking display)

2. **Answer Loop** (until probe returns `done: true`):
   - Wait for ONE answer via `getNextAnswer(block=true)`
   - Call LLM with probe prompt to decide:
     - `done: true` - we have enough information
     - `done: false` + next question - push question to session
   - The probe LLM can optionally request tool calls to gather more context

3. **End Session**: Close browser

4. **Generate Summary**: Call LLM to synthesize all Q&A into a design document

5. **Return**: Both raw answers and synthesized summary

## LLM Integration

The tool needs to make LLM calls internally. Using the OpenCode SDK client:

```typescript
// Create a temporary session for the probe
const probeSession = await client.session.create({ 
  parentID: ctx.sessionID,
  title: "Brainstorm Probe" 
});

// Send probe prompt and get response
const response = await client.session.prompt({
  sessionID: probeSession.id,
  parts: [{ type: "text", text: probePrompt }],
  agent: "probe-internal",  // A minimal agent config
});

// Parse response as JSON
const probeResult = JSON.parse(response.text);
```

### Probe Prompt

The probe prompt will be similar to the current probe agent's system prompt:
- Analyze conversation so far
- Decide if design is complete (done: true)
- If not, generate ONE follow-up question
- Return JSON: `{ done: boolean, reason: string, question?: {...} }`

### Summary Prompt

After the loop ends, call LLM to synthesize:
- All Q&A pairs
- Original request and context
- Generate a structured design document

## Architecture Changes

### Files to Create
- `src/tools/brainstorm.ts` - The main brainstorm tool
- `src/llm/probe.ts` - LLM helper for probe logic
- `src/llm/summarize.ts` - LLM helper for summary generation

### Files to Modify
- `src/tools/index.ts` - Export the new brainstorm tool
- `src/index.ts` - Remove agent registrations (or keep for backward compat)

### Files to Remove (or deprecate)
- `src/agents/brainstormer.ts` - No longer needed
- `src/agents/bootstrapper.ts` - Logic moves to calling agent
- `src/agents/probe.ts` - Logic moves into tool's LLM helper

## Key Design Decisions

### 1. Blocking vs Non-blocking

The tool blocks until the brainstorming session is complete. This is intentional:
- Calling agent doesn't need to manage state
- Simpler interface
- The tool handles all the async complexity internally

### 2. Who generates initial questions?

The **calling agent** generates initial questions, not the tool. Rationale:
- Calling agent has already gathered context
- Calling agent knows what it needs to learn
- Keeps the tool focused on orchestration, not question generation

### 3. Probe as internal LLM call

The probe logic runs as internal LLM calls within the tool, not as a subagent. Benefits:
- No coordination overhead
- Faster (no task spawning)
- More reliable (no agent instruction following issues)

### 4. Tool access for probe

The probe can optionally spawn tools to gather more context (e.g., read files, search code). This is done via the SDK client's session.prompt with tools enabled.

## Open Questions

1. **Model selection**: Which model should the internal LLM calls use?
   - Option A: Same model as the calling agent
   - Option B: A configured default (e.g., claude-sonnet)
   - Option C: Configurable via tool input

2. **Error handling**: What happens if:
   - User closes browser mid-session?
   - LLM returns invalid JSON?
   - Session times out?

3. **Maximum questions**: Should we cap the number of questions?
   - Current probe says 8-12 typical, max 15
   - Tool should enforce this limit

## Success Criteria

- Single tool call replaces entire multi-agent orchestration
- More reliable than current agent-based approach
- Same or better user experience (browser UI unchanged)
- Cleaner, more maintainable code
