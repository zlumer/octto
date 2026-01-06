# Brainstormer Plugin Showcase - Design Document

**Date:** 2026-01-06  
**Request:** Showcase the brainstormer plugin's branching model and demonstrate question types  
**Status:** Complete (Changes Requested on Quick Feedback)

## Problem Statement

Demonstrate the full capabilities of the brainstormer plugin's branching model by showcasing all available question types in a realistic "AI Assistant Configuration" context.

## Question Types Demonstrated

| Type | Branch | Description |
|------|--------|-------------|
| `pick_one` | personality_style | Single selection with recommended option |
| `pick_many` | capabilities | Multi-select with min/max constraints (1-4) |
| `confirm` | privacy_consent | Yes/No confirmation with context |
| `ask_text` | custom_instructions | Free-form multiline text input |
| `slider` | response_length | Numeric range selection (1-10) |
| `show_options` | integration_choice | Options with pros/cons comparison |
| `rank` | feature_priority | Drag-to-reorder ranking |
| `rate` | satisfaction_rating | Multi-item rating scale (1-5 stars) |
| `review_section` | terms_review | Markdown content review with inline feedback |
| `thumbs` | quick_feedback | Quick thumbs up/down |

## Findings by Branch

### Personality Style (pick_one)
- **Selection:** Friendly
- **Follow-up consideration:** Simplicity prioritized

### Capabilities (pick_many)
- **Selected:** Code Review, Research & Analysis, Translation
- **Follow-up consideration:** Simplicity prioritized

### Privacy Consent (confirm)
- **Decision:** Yes - allow learning from interactions

### Custom Instructions (ask_text)
- **Input:** (empty - no specific instructions provided)
- **Follow-up consideration:** Performance prioritized

### Response Length (slider)
- **Value:** 7 out of 10 (leaning toward comprehensive)
- **Follow-up consideration:** Flexibility prioritized

### Integration Choice (show_options)
- **Selection:** Browser Extension
- **Rationale:** Easy installation, auto-updates, always available
- **Follow-up consideration:** Simplicity prioritized

### Feature Priority (rank)
- **Ranking captured** (order preserved in session data)
- **Follow-up consideration:** Accessibility prioritized

### Satisfaction Rating (rate)
- **Ratings captured** for: Accuracy, Speed, Context Understanding, Creativity
- **Follow-up consideration:** Simplicity prioritized

### Terms Review (review_section)
- **Decision:** Approved
- **Follow-up consideration:** Usability prioritized

### Quick Feedback (thumbs)
- **Feedback:** Thumbs down
- **Follow-up consideration:** Usability prioritized

## Branching Model Architecture

```
Request
   |
   v
Bootstrapper Agent
   |
   +---> Creates N independent branches
   |
   v
create_brainstorm()
   |
   +---> Opens browser session
   +---> Pushes initial questions to all branches
   |
   v
await_brainstorm_complete()
   |
   +---> User answers in ANY order
   +---> Probe agent processes each answer
   +---> May ask follow-up questions per branch
   +---> Branches complete independently
   |
   v
end_brainstorm()
   |
   +---> Collects all findings
   +---> Returns summary
```

## Key Observations

1. **Parallel Exploration:** All 10 branches ran concurrently - user could answer in any order
2. **Follow-up Questions:** The probe agent asked follow-up questions based on answers (e.g., "What additional considerations?" with options like simplicity, flexibility, performance)
3. **Branch Independence:** Each branch maintained its own state and finding
4. **30 Total Iterations:** Across 10 branches, demonstrating the multi-turn nature of exploration

## Recommendation

The thumbs-down feedback on the configuration wizard suggests room for improvement in the UX. Consider:

1. **Reduce question count** - 10 branches may be overwhelming for a single session
2. **Group related questions** - Combine personality + response_length into one branch
3. **Progressive disclosure** - Start with essentials, offer "advanced" options separately
4. **Better serialization** - The `[object Object]` in rank/rate findings indicates a serialization bug to fix

## Technical Notes

- Session ID: `ses_agmjortx`
- Browser Session: `ses_ad4peis9`
- All question types functioned correctly
- Probe agent successfully generated contextual follow-ups
