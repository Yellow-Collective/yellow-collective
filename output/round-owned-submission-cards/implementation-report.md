# Full owner submission cards — implementation report

Changes:
- Extracted round card presentation and its media/description helpers into components/rounds/RoundSubmissionCard.tsx; round detail and owner list use the same component.
- Signed owner list now maps complete submission presentation records instead of title-only summaries. Existing wallet, approved/pending, non-deleted and published/active-round restrictions remain.
- Editor shows responsive full cards with image/trait preview, title, description, wallet, approval/edit-used state and raised Edit/View action. Selecting a card opens its signed editor; Back to my submissions restores cached cards without another request/signature. Successful saves update the cached card state.
- Moved the existing blue raised Load control to the page's upper-right, opposite back navigation, with wrapping on narrow screens.

Verification observed:
- Browser isolated fixture: actual shared card and Noundry pixel rendering inspected at desktop and 375px; project image, multi-image badge, trait preview, title, description, wallet, status and Edit shown. Load at upper-right; card selection opens matching form; return restores cards.
- Fixture stubs wallet/signing/network, markdown renderer and profile identity; uses synthetic submissions and pixels. It does not prove live wallet or production application behavior.
- Current server auth route remains signature-protected and private/no-store. Owner query still binds wallet and round as parameters and excludes deleted/rejected/hidden entries.

Unrelated artwork and previous output preserved. No environment/configuration, dependencies, source notes, Obsidian settings, imported notes, automation state or memory changes. User authorized scoped commit/push to upstream main after checks, triggering existing production Git deployment.

Final checks: full npm test, TypeScript, scoped lint, git diff check, and production build all passed. Build generated 16 static pages; only existing unrelated image lint warnings. Browser fixture selection/recovery verified; no real signature or save performed.

Release: committed 6e10e8962990918f39f1e0c97203c90faa71bef8 and pushed upstream/main; local main/upstream main aligned 0/0. Vercel deployment dpl_2FZ8zwJKp3r6Uigyikgy5wm4Jt1A is READY/PROMOTED, production, aliasAssigned=true, aliasError=null, assigned www.yellowcollective.art and yellowcollective.art. Live authenticated wallet behavior not retested.
