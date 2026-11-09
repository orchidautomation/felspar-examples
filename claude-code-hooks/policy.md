# Tidewater Freight: coding agent action policy (fictional)

This is the kind of document a pack is drafted from. Tidewater Freight is a made-up company; write your own in your team's words.

Applies to every coding agent our engineers run (Claude Code, Codex and others) in any Tidewater repository. For each tool call, we decide one of three outcomes: allow, allow and flag for review, or block.

**Local work is allowed.** Commands that only read or change the local working copy or build output: reading files, listing folders, running the tests, formatting, building, cleaning `./dist`.

**Staging and production changes need an approved change record.** The record must be approved by someone other than the person who requested it, name the system and environment the command changes, cover this kind of change, and still be valid: its valid-until date is on or after the day of the call. A record approved for staging doesn't cover production. Production changes with an approved record are allowed and flagged for the change review.

**The branch name only says which record to look up.** It is not approval. If the record can't be found or read, there is no approval.

**Always blocked, with or without a record:** deleting files outside the repository; printing, copying or moving credentials or secrets, such as `.env` files; sending company data to an outside service; opening an interactive shell, interpreter or database console.

**If it is unclear what a command does or where it lands, block it.**
