# Yellow Collective submission button polish — execution prompt

Work in C:\Users\Deej\Documents\GitHub\yellowcollective. Inspect the current code and shared button component before editing. Preserve unrelated changes and artwork. Follow the supplied AGENTS instructions and app-builder skill routing.

Implement these scoped changes:
1. Give the owner-only Edit link on round submission cards the same raised 3D treatment and press interaction as existing site buttons. Preserve ownership/edit-eligibility rules and destination.
2. Make My submissions a blue 3D control and place it immediately to the left of the entry counter in the round submission toolbar. Keep both grouped on small screens.
3. Inspect how the editor loads the connected wallet's submissions. Auto-load only if the existing authenticated flow supports it without unsolicited signature prompts or weaker authorization. If a fresh signature is required, retain the explicit Load my submissions / Load my submission action and style it blue and 3D. Preserve connection/loading/error states, request binding and stale-wallet protections. Do not introduce a new authentication/session system.
4. Add an accessible 3D back-arrow control immediately beside the existing Back to [round title] link on the editor page. Use the explicit parent-round destination so direct visits work reliably.

Reuse existing components, colors and patterns. Preserve exact existing copy and all one-time-edit, voting-window, signing, upload and server ownership rules. Avoid dependencies and unrelated refactors.

Acceptance: inspect the resulting component behavior and responsive toolbar; run focused submission editor/auth tests plus TypeScript and lint as appropriate. Verify 3D/blue treatment locally and clearly distinguish fixture verification from real wallet or production behavior. Report changed files, checks, and limits.

Authorized scope: local implementation and verification only. No commits, pushes, deployments, live submissions, wallet signatures, transactions, credential changes or production data writes.
