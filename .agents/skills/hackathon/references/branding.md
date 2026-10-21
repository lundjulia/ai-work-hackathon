# Branding

Explore distinct directions, show actual artwork, and refine the selected one. A request to explore authorizes drafts; ask for a choice once alternatives can be reviewed. Scale to the project: a small app may need only a wordmark, a few visual choices, and one screen.

## Start

Read the PRD, design notes, references, selected assets, and feedback. Identify the audience, target screens, fixed choices, and open questions. Visual references are inspiration, not requirements or permission to copy an identity.

Pick suitable tools: image generation, vector tools, or the browser. Do not hand-write SVG for every logo; raster exploration can come before a vector master. Logo-only work needs no app scaffold.

For web UI, use real shadcn/ui components on the project's React, Tailwind, and theme setup, not HTML lookalikes. Vary typography, palette, spacing, and styling through semantic theme variables and component variants, and scope alternative themes to their previews. Keep UI copy minimal: drop headings, helper text, and status copy the layout already conveys. Keep necessary labels, error guidance, and accessible names; placeholders do not replace labels.

## Explore

- When identity is open, produce about three directions that differ in concept, silhouette, lettering, or composition. Recolors of one mark are variations, not directions.
- For parallel designers, give the same requirements and review criteria with different hypotheses, and keep their files separate. One design owner assembles the comparison and continues the selected direction.
- Make candidates comparable: stable labels, the same content and UI state, and similar polish. Each candidate shows real artwork in context, its idea, and a trade-off.
- Inspect logos large, at their actual placements, and at 24px and 48px, in monochrome and on light and dark backgrounds. Fix defects and unintended readings before review.

## Review

Show a side-by-side sheet or switchable preview, concise trade-offs, and a recommendation. A recommendation is not a selection. Allow combinations and rejection. Workers may route the review through the main thread.

For refinements, show the previous viable version next to the revision and name what changed. Change only the requested detail and reuse the selected source rather than redrawing it. For an ambiguous fill, outline, or alignment request, inspect the asset, then ask a focused question or show quick interpretations. If a direction is rejected, explore a different concept.

Track each element separately; selecting a logo does not select its palette, motion, or layout:

```markdown
| Element | State (selected/preferred/open/rejected) | Choice / source | Feedback or next change |
| ------- | ---------------------------------------- | --------------- | ----------------------- |
```

Record who selected each element, in one domain design doc linked from status.

## Board and handoff

- Board: the selected mark at real size on relevant backgrounds, palette roles, type hierarchy, spacing, and representative screens. Label illustrative content. If motion matters, make a short separate study with a reduced-motion alternative.
- Assets: editable masters plus the export formats the target needs. Check dimensions, masking, padding, and transparency for app icons.
- UI code: the selected components, theme source, and assets, with notes on reused components, custom variants, dependencies, and remaining wiring. Match the target's aliases and config, and apply the code together with the implementation owner.
- Open the actual review URL and exported image, and check fonts, assets, and relative paths. Viewers can change the base path. After integration, check the running screen.
