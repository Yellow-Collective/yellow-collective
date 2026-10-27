# Prompt validation

Intention: make comments attached to proposal votes render as safe Markdown,
especially paragraphs and bullet lists, while retaining Yellow Collective's UI.

Template adapted: `C:/Users/Deej/Documents/GitHub/obsidian/10_Library/Prompts/01_Codex Engineering/bugfix-and-test-loop.md`.
Only the inspection, root-cause, minimal-patch and verification loop was reused;
the vault and prompt library were not edited.

1. Direct draft: replace plain vote reason text with Markdown so the screenshot's paragraphs and five bullet points render correctly.
2. Repository-grounded draft: target the shared `ProposalVoteList` used by both Builder and Nouns pages, reuse installed packages and theme tokens, preserve metadata and vote behavior.
3. Hardened draft: require an actual-render regression, sanitize untrusted content, disallow raw HTML and automatic image fetches, keep links safe and cover long text/empty states.
4. Adversarial pass: preserve source newlines rather than inventing list boundaries; don't redesign cards, normalize stored text, add packages, connect wallets, reuse live data, or infer deployment authority from the earlier commit request.

Final execution scope: component rendering, focused regression and test-script
integration, local fixture evidence, and these output documents. No data/API or
contract changes are needed. Root cause is the plain paragraph around `vote.reason`.
