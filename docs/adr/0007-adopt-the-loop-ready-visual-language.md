# ADR-0007: Adopt the Loop Ready visual language

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Sandeep (product owner), with Claude Code

## Context

The template ships the Mochi design language. Mochi is playful: ink outlines of 2px, hard shadows straight down, rounded Japanese display type and candy colours.

The product owner supplied six mockups for Loop Ready, a course for senior data engineer interviews. The owner asked for the screens to match them exactly. The mockups use a different language:

- a warm paper page with white cards, 1px hairline borders and soft shadows;
- dark navy hero bands with a pink glow;
- a pink brand colour with white text, and a pink-to-violet gradient on one headline word;
- Space Grotesk for headings, Inter for text and JetBrains Mono for code and numbers;
- small uppercase labels above sections;
- a colour per track, on a left rail or a top edge.

Mochi forbids most of these: 1px borders, glows, white text on brand, uppercase labels and a third typeface. The lint enforces several of them. So the mockups cannot be built inside Mochi.

## Decision

We will replace Mochi with the Loop Ready visual language in this repository. The structure of the design system stays: tokens in `styles/globals.css`, primitives in `components/ui/`, lint checks and the `/design` page. Only the values and some rules change.

- The tokens change to the Loop Ready palette, type, radius and shadow scales.
- The lint allows a 1px `border`, and refuses the 2px, 4px and 8px widths instead.
- Three self-hosted typefaces replace the two Mochi faces. All three are under the SIL Open Font License.
- Signed-in pages render an app shell (`components/layout/AppShell.tsx`): a sidebar from `md` up, and a top bar with the streak and XP.

`.github/instructions/design-language.md` records the new rules.

## Alternatives considered

### Option A: replace Mochi with the mockup language (chosen)

It is the only option that gives the owner the screens they asked for. The design system keeps its enforcement, so the new language stays consistent.

### Option B: keep Mochi and approximate the mockups

The result would not match the mockups. The owner asked for an exact match, so this option fails the request.

### Option C: add the mockup language as a third theme beside Mochi

Themes in this template change colour tokens only. The mockups also change type, borders, shadows and layout. A theme cannot express that. Two parallel rule sets would also make every UI review ask "which rules apply here?".

## Consequences

**Good**

- The product matches the owner's mockups.
- The lint, the tokens and the primitives still enforce one consistent language.

**Bad**

- White text on the brand pink is below WCAG AA contrast for small text (about 3.4:1). The owner accepted this to match the mockups. Brand buttons use semibold text at 15px or larger to reduce the effect.
- A future merge from the upstream template conflicts in `styles/globals.css`, the primitives and `design-language.md`.
- The mascot face from Mochi stays only in the logo and in empty states.

**Neutral**

- The night and calm themes still exist, but nothing uses them.
