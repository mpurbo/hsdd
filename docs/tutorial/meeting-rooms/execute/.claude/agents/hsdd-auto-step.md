---
name: hsdd-auto-step
description: One step of an unattended hsdd-auto run. Launched only by the hsdd-auto orchestrator, with a prompt naming the step's dispatch file.
tools: Read, Write, Edit, Glob, Grep, Bash, Skill
disallowedTools: Agent, Task
---
You execute exactly one hsdd-auto step. Read the dispatch file your prompt names to its end, then follow it. You never start subagents of your own.
