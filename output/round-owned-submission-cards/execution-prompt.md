# Full cards for My submissions — execution prompt

Work in C:\Users\Deej\Documents\GitHub\yellowcollective. Follow the supplied AGENTS instructions and app-builder workflow. Preserve unrelated untracked artwork and prior output.

Problem: /rounds/[slug]/edit loads the connected owner's submissions as text-only title/status buttons. The user wants full cards that look like those on the round detail page.

Inspect RoundSubmissionEditor, the round page's SubmissionCard/media/description helpers, the signed my-submissions endpoint, and listOwnedRoundSubmissionSummaries. Reuse the round card presentation through shared components where practical so image/trait preview, title, description, wallet, card styling and raised Edit action stay consistent. Show a responsive grid on the owner editor page, with existing status/edit-used information retained. Choosing a card must still select/load the correct submission for editing.

Return only the presentation data needed by the owner cards through the existing signed owner endpoint. Preserve wallet ownership, approved/pending and non-deleted filters, no-store response policy, and signature verification. Do not expand public access, change authentication, auto-prompt signatures, or expose unrelated private/database fields. Preserve one-time edits, voting deadlines, upload state and protection against stale requests or wallet changes. Preserve trait previews and image/video/multiple-image behavior from the round cards.

Run meaningful focused tests covering full-card data and selection plus owner isolation/visibility, existing submission/media/editor regressions, TypeScript and lint. Build and inspect desktop/mobile rendered cards with isolated synthetic data; distinguish fixture evidence from actual wallet/production behavior.

Deliver a scoped implementation, verification evidence, then commit and push upstream main as explicitly requested. This authorizes the existing Git production release workflow; verify the matching Vercel deployment status. Do not change environments, production records, credentials, wallets, signatures, transactions or unrelated assets.

Additional user requirement: before committing, move the existing blue raised Load my submissions button to the top-right corner of the edit page, beside the back-navigation row. Preserve responsive wrapping and all loading/signature/disabled behavior. Finish both full-card rendering and this placement, then commit and push upstream main.
