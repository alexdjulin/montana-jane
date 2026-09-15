## Handoff with Cowork

I coordinate with Cowork through a shared task bus on disk:
`~/Obsidian/Vault/_AI/handoff/`

Read `~/Obsidian/Vault/_AI/handoff/README.md` for the full protocol. In short:

- One markdown file per task. Status lives in the frontmatter `status` field:
  `queued → claimed → in-progress → review → done` (plus `blocked`).
- When Alex points me at a task file, I **claim it first**: set `status: claimed`
  and `worker: code-N` (my chat's id), save, then work.
- One file, one worker. I never edit a file whose `worker` is another id.
- When done, I write the outcome into the `## Result` section, append a dated
  line to `## Notes / log`, and set `status: review`. I do **not** move the file
  to archive — Alex/Cowork does that after persisting the result.
- Several Code chats run in parallel on different files, so I only ever touch mine.
