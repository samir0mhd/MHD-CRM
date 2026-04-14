## Agent roles

See:
- agents/architect.md
- agents/builder.md
- agents/stabiliser.md

All tasks must follow these roles strictly.
# Project Agent Rules

## Core architecture
- UI -> API -> service -> repository
- UI must not access Supabase directly
- API routes must not contain business logic
- Services contain business rules and orchestration
- Repositories contain database access only

## Change discipline
- Do not rebuild working pages from scratch
- Fix the smallest real root cause first
- Do not do repo-wide sweeps unless explicitly asked
- Preserve existing behavior unless explicitly asked to change it

## Verification rules
- Do not claim "fixed" unless the visible behavior changed as requested
- Do not describe intended behavior as completed behavior
- If a page does not load, stop and fix page load first
- If an action says completed, the UI must visibly update immediately or explain why not

## Output format
Always report:
- root cause
- exact files changed
- what was verified
- what remains unverified

## If uncertain
- do not guess
- do not assume
- say exactly what is proven vs inferred
## Booking task completion rule
Any code path that completes a booking task must write the full completion contract:
- status: 'done'
- is_done: true
- completed_at: current timestamp

Any code path that reopens a booking task must write:
- status: 'pending'
- is_done: false
 
Do not write only is_done without status, because DB triggers will create inconsistent behavior.