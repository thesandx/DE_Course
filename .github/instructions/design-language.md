# Design language: Loop Ready

The visual and verbal rules for every screen in Loop Ready. Read this **before you write or change any UI**. The tokens live in `styles/globals.css`. The primitives live in `components/ui/`. The app shell lives in `components/layout/AppShell.tsx`. The living reference renders at `/design`.

This language replaces the template's Mochi language. [ADR-0007](../../docs/adr/0007-adopt-the-loop-ready-visual-language.md) records why.

If a rule here conflicts with your training defaults, this file wins. If it blocks a task, say so and propose a change to this file. Do not work around it silently.

---

## The idea in one paragraph

Loop Ready is a calm study desk with a bright signal on it. The **desk** is a warm paper page, white cards with a 1px hairline and a soft shadow, and clear type. The **signal** is a dark navy band with a pink glow: the hero of each page, the streak and the senior signals. Pink means "do this next". Each track has its own colour, and that colour marks the track everywhere.

Three words to test every decision against: **focused, honest, motivating.**

- Focused: one dark band and one primary action per screen. Everything else is quiet.
- Honest: every number comes from the learner's record or the catalogue. No fake stats.
- Motivating: progress is visible. Rings, bars, streaks and XP answer "how far am I?".

---

## The twelve rules

1. **Use the primitives.** `components/ui/` holds them. See [The primitives](#the-primitives). Do not re-create them inline. If one is missing a variant, add the variant to the primitive and show it on `/design`.
2. **Use tokens only.** No raw hex, no arbitrary `shadow-[...]`, no arbitrary radius, no default Tailwind colour. If you need a value that does not exist, add a token and say why. `pnpm lint` fails on each of these. See [Enforcement](#enforcement).
3. **Ink is not black.** Text uses `ink`, `ink-soft` and `ink-faint`. Never `black`, `#000` or `neutral-900`.
4. **Outlines are 1px hairlines.** `border border-line` on cards, `border-line-strong` on inputs and secondary buttons. A coloured rail is `border-l-4`; a coloured tile edge is `border-t-4`. No other widths.
5. **Shadows are soft and token-only.** `shadow-card` on cards, `shadow-raised` on a lifted element, `shadow-float` on a sheet, `shadow-glow` on the primary button and the logo only.
6. **Radius follows hierarchy.** `rounded-dot` on calendar cells and checkboxes, `rounded-box` on badges, `rounded-input` on inputs, `rounded-card` on cards, `rounded-sheet` on hero bands, `rounded-pill` on buttons and chips.
7. **One primary action per screen.** Exactly one `Button variant="primary"` (pink) is visible in any viewport. The rest are `secondary`, `dark`, `night` or `quiet`.
8. **Three typefaces, fixed roles.** `font-display` (Space Grotesk, 500 to 700) for headings and big numbers. `font-sans` (Inter, 400 to 600) for text. `font-mono` (JetBrains Mono, 400 and 500) for code, counts and short metadata. No fourth face.
9. **Colour has a job.** `brand` means "do this". `night` means "this matters most on the page". `track-1` to `track-16` mean "this track". `easy`, `medium` and `hard` mean difficulty, and also right (`easy`) and wrong (`hard`) answers. `gold` means XP and milestones. Never pick a colour because it looks nice.
10. **One dark band per section.** A page has one `bg-night-glow` hero. A second dark element, such as the loop readiness band or a senior signal, uses `bg-night-soft` or sits inside a white card.
11. **Motion answers the user.** Press, navigate, open, select, finish, error. No scroll-triggered fade-ins, no looping decoration. See [Motion](#motion).
12. **Mobile first, 320px up, then a real desktop.** A phone gets an app. From `md` (768px) up, the same screen is a website with a sidebar. Tap targets are 44px or more on a phone. No horizontal scroll. See [Responsive](#responsive-an-app-on-a-phone-a-website-on-a-desktop).

A site built from this template also passes [the site checklist](#the-site-checklist): working links, a mobile menu, a favicon, titles and descriptions, a 404 page, clear feedback, and contact details you can tap.

---

## Tokens

All tokens are in `styles/globals.css`. Tailwind v4 generates the utilities.

### Colour

| Token                                     | Utility examples                 | Use it for                                          |
| ----------------------------------------- | -------------------------------- | --------------------------------------------------- |
| `paper`                                   | `bg-paper`                       | The page. Nothing else.                             |
| `surface`                                 | `bg-surface`                     | Cards, inputs, sheets                               |
| `sunken`                                  | `bg-sunken`                      | Wells, table heads, empty slots, disabled fills     |
| `ink` `ink-soft` `ink-faint`              | `text-ink`, `text-ink-soft`      | Headings and labels, body text, metadata            |
| `line` `line-strong`                      | `border-line`                    | Card hairlines; input and secondary button outlines |
| `brand` `brand-deep` `brand-soft`         | `bg-brand`, `text-brand-deep`    | The primary action, links, the current item         |
| `iris`                                    | `text-iris`                      | XP, and the second stop of the brand gradient       |
| `night` `night-deep` `night-raised`       | `bg-night`, `bg-night-raised`    | Hero bands, dark cards, code blocks                 |
| `night-line` `on-night` `on-night-soft`   | `border-night-line`              | Outlines and text on a night surface                |
| `gold` `gold-deep` `gold-ink`             | `bg-gold`, `text-gold-ink`       | XP rings, milestones, the warm call to action       |
| `easy` `medium` `hard` (+ `-bar` `-soft`) | `bg-easy-soft text-easy`         | Difficulty tags and bars; right and wrong answers   |
| `track-1` … `track-16`                    | `bg-track-2`, `border-l-track-2` | One colour per track. Use `lib/course/track-style`. |
| `heat-0` … `heat-4`                       | `bg-heat-3`                      | The study calendar only                             |

White text (`text-on-night`) goes on `night`, `ink` and `brand`. Text on `gold` is `text-gold-ink`. Text on a `-soft` fill uses the matching dark tone.

### Type

| Utility        | Face    | Use it for                                          |
| -------------- | ------- | --------------------------------------------------- |
| `text-hero`    | display | The landing headline only                           |
| `text-display` | display | A page title and section titles on the landing page |
| `text-title`   | display | Card and section headings                           |
| `text-heading` | display | Small card titles, list item titles                 |
| `text-lead`    | sans    | The line under a page title                         |
| `text-body`    | sans    | Everything you read                                 |
| `text-small`   | sans    | Hints, captions, metadata                           |
| `text-micro`   | sans    | Chips, table heads, eyebrows                        |
| `text-key`     | display | Big glanceable numbers: streak, XP, counts          |
| `eyebrow`      | sans    | The small uppercase label above a section title     |

- Sentence case for every heading, button and label. The only uppercase text is an `eyebrow` and a table head.
- Body line length stays under about 70 characters (`max-w-prose` or `max-w-2xl`).
- One word in the landing headline can carry `text-gradient-brand`. Nothing else uses a gradient on text.

### Radius, shadow, motion

| Token              | Value                   | Use                                  |
| ------------------ | ----------------------- | ------------------------------------ |
| `rounded-dot`      | 3px                     | Calendar cells, checkboxes           |
| `rounded-box`      | 6px                     | Number badges, keyboard hints        |
| `rounded-input`    | 12px                    | Inputs, options, small wells         |
| `rounded-card`     | 18px                    | Cards                                |
| `rounded-sheet`    | 26px                    | Hero bands, sheets, call to action   |
| `rounded-pill`     | 999px                   | Buttons, chips, pills                |
| `shadow-card`      | soft, 1 to 3px          | Cards                                |
| `shadow-raised`    | soft, larger            | A lifted card, the sample question   |
| `shadow-float`     | soft, largest           | Sheets and dialogs                   |
| `shadow-glow`      | pink glow               | The primary button and the logo only |
| `squish` (utility) | hover lifts, press dips | Anything pressable. Buttons have it. |
| `ease-settle`      | no overshoot            | Things that move from A to B         |
| `ease-spring`      | soft overshoot          | A selection that slides into place   |
| `animate-pop`      | 420ms scale-in          | A finish, the XP win                 |
| `animate-wobble`   | 520ms                   | A wrong answer, an invalid field     |
| `animate-check`    | 320ms                   | A tick or a cross that appears       |

Background utilities: `bg-night-glow` (the hero), `bg-night-soft` (a second dark band), `bg-night-violet` (the Uber card), `bg-sun` (the warm call to action and the next milestone), `bg-milestone` (a pink-to-orange bar), `bg-brand-gradient` (the learner's initial), `bg-wash` (the landing corner glow).

The full motion set is in [Motion](#motion).

---

## The app shell

A signed-in page renders `AppShell`. It replaces the public `SiteHeader` and `Footer` with CSS (`body:has([data-app-shell])` in `globals.css`), so the server sends one HTML and nothing flashes.

- `variant="sidebar"` for the dashboard and list pages. From `md` up: a fixed 224px sidebar with the destinations, the streak card and the learner card, and a top bar with search, the streak and the XP. On a phone: a slim top bar with the logo, a streak pill and an XP pill. The `TabBar` stays at the bottom.
- `variant="focus"` for a lesson or a problem. No sidebar; a breadcrumb, the streak, the XP and the learner's initial. On a phone, a back arrow replaces the logo.
- A list page starts with `PageHeading` (eyebrow, title, lead). A detail page starts with a `bg-night-glow` hero.

---

## The primitives

Each primitive lives in `components/ui/`, has a colocated test, and renders on `/design`. Pick the primitive by its job.

| Primitive     | Use it for                                                          |
| ------------- | ------------------------------------------------------------------- |
| `Button`      | An action. `buttonStyles()` styles a `Link` the same way.           |
| `Card`        | One object the user can act on. `peek` puts a face over the edge.   |
| `Input`       | One line of text, with a label, a hint and an error.                |
| `Textarea`    | Several lines of text. Same label, hint and error as `Input`.       |
| `Select`      | One choice from a long list. It is a native select.                 |
| `RadioGroup`  | One choice from five options or fewer.                              |
| `Checkbox`    | A yes/no value that a form submits later.                           |
| `Switch`      | A setting that applies at once.                                     |
| `Field`       | The label, hint and error. Use it to wrap a new form control.       |
| `Badge`       | A short state in words: "Host", "Ready". Not pressable.             |
| `Chip`        | A pill that names one thing, often with an `Avatar`. Not pressable. |
| `ContactLink` | A phone number (`tel:`) or an email address (`mailto:`) to tap.     |
| `Alert`       | A message in the interface voice: a result, a problem, a status.    |
| `Progress`    | How far through something the user is. It shows the value in words. |
| `Spinner`     | Work that the user asked for and that is not complete yet.          |
| `EmptyState`  | A space with no content yet. A sleepy face, one line, one action.   |
| `Skeleton`    | The shape of content that is loading. Use it as a loading fallback. |
| `Tabs`        | Two to five views of the same thing. A client component.            |
| `Dialog`      | A decision that must interrupt. A bottom sheet on a phone.          |
| `Avatar`      | A player. The name sets the colour and the mood.                    |
| `Face`        | The mascot face. See [Signature patterns](#signature-patterns).     |
| `Speech`      | The mascot speaks. Moments only.                                    |
| `Sticker`     | Decoration. Two per viewport at most.                               |

`components/layout/` holds the page chrome:

| Component    | Use it for                                                                           |
| ------------ | ------------------------------------------------------------------------------------ |
| `PageShell`  | The page's `<main>`: the frame (`max-w-5xl`), the gutter and the rhythm.             |
| `AppBar`     | Back arrow, title (`h1`), one action. Sticky on a phone. The page heading from `md`. |
| `BackButton` | The back arrow alone. It returns inside the app, or goes to a fallback page.         |
| `TabBar`     | The floating bottom bar with the top-level destinations. Phone only. In the layout.  |
| `SiteHeader` | The same destinations in a sticky website header. `md` and up. In the layout.        |
| `Header`     | A website header. The logo links home. The links fold into `MobileMenu` below `md`.  |
| `MobileMenu` | The header's "Menu" button and panel below `md`, for a website with no `TabBar`.     |
| `Footer`     | The site footer: one line, the copyright from the clock, contact links, links.       |

**On a phone, behave like an app.** A user must never need the browser's back button. A screen below a tab has an `AppBar` with a back arrow. A focused task, such as sign-in, hides the `TabBar` (see `TABLESS_PATHS` in `lib/navigation.ts`). A step inside one screen, such as the OTP step, uses the back arrow to return to the step before it.

**On a desktop, behave like a website.** See [Responsive](#responsive-an-app-on-a-phone-a-website-on-a-desktop).

Status is never colour alone. `Alert` draws a glyph, `Checkbox` draws a tick, `RadioGroup` draws a dot, `Switch` moves its knob, and `Tabs` lifts the selected tab onto a base.

---

## Motion

Motion makes the app feel physical: a screen settles into place, a selection slides to where you tapped, a sheet rises from the bottom. Each movement answers something the user did. None of it costs load time.

### The rules

1. **CSS only.** No animation library, and no JavaScript that runs per frame. Motion adds no script to a page.
2. **Animate `transform` and `opacity` only.** The browser moves them on the GPU, without layout or paint. To animate a size, use `scaleX` or `scaleY`, as `Progress` does. Never animate `width`, `height`, `top` or `margin`.
3. **Never hide the first paint.** An animation that plays on page load starts from a visible state (`opacity` above 0). An element at `opacity: 0` does not count for Largest Contentful Paint, so it delays the metric until it appears.
4. **Use `backwards` fill on anything that wraps content.** A `transform` that stays after the animation turns the element into a containing block, and every `position: fixed` child inside it breaks.
5. **Short.** 200ms to 320ms for most motion. Up to 520ms for a win or an error.
6. **Reduced motion stops everything.** The base layer in `styles/globals.css` cuts every animation and transition to near zero. Do not override it.
7. **Answer at the press, not at the response.** A control moves when the user taps it, even when the result needs the network. `TabBar` slides its pill on the tap, before the next page arrives.
8. **Keep motion free, and keep the page light.** Motion adds no JavaScript. A large library still costs load time, so load it with `import()` when an action needs it. See `coding-standards.md` > React for the rules and the examples.

### The motion set

| Utility                                           | Where it plays                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `animate-page-enter`                              | Every navigation. `app/template.tsx` wraps each page in it.           |
| `animate-slide-in-next` / `animate-slide-in-back` | A step change inside one screen, such as the sign-in steps.           |
| `animate-rise-in`                                 | Something that appears because of an action: `Alert`, a field error.  |
| `animate-fade-in`                                 | A panel that replaces another: the `Tabs` panel.                      |
| `animate-check`                                   | A tick, a radio dot or a tab icon that turns on.                      |
| `animate-wobble`                                  | A field that has an error. It plays once, when the error appears.     |
| `animate-pop`                                     | A win, a new player joining.                                          |
| `animate-breathe`                                 | A `Skeleton` while content loads.                                     |
| `sheet-motion`                                    | `Dialog`: rises in, sinks out, and the backdrop fades.                |
| `press`                                           | A pressable thing with no base: a tab. Never together with `squish`.  |
| A sliding pill                                    | The selection in `Tabs` and `TabBar`. `transform` with `ease-spring`. |

### Loading

A dynamic page that reads data shows a loading state at once on navigation, so a tap never waits on the server with no answer. Use `Skeleton` in the shape of the page. `coding-standards.md` says when to use `loading.tsx` and when to use an inner `<Suspense>`. The fallback in `app/profile/page.tsx` is the example.

---

## Themes and the cute budget

A product sets its theme once, with `THEME` in `app/layout.tsx`. The theme re-assigns tokens; components do not change.

| Theme      | For                                            | Cute budget                                                                    |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `playroom` | Party games, social, anything fun              | **High** — faces on every player, mascot on every key moment, stickers allowed |
| `calm`     | Wellness, habits, focus, utilities             | **Medium** — mascot on empty states and completions only, no stickers          |
| `night`    | Dark products: map trackers, gaming companions | **Low** — mascot on loading, empty and error states only; faces on avatars     |

Products with a formal or ceremonial tone (a wedding site, a legal page, a portfolio for employers) do **not** use this language. They use the same structure tokens (spacing, radius, type scale discipline) with their own palette and type. Say so in that project's `CLAUDE.md`.

Budget limits per viewport, all themes:

- One `peek` card.
- One `Speech` bubble.
- Two `Sticker`s (zero in `calm` and `night`).
- One `bg-night-glow` hero.

---

## Signature patterns

These make Loop Ready recognisable. Use them; do not invent new decorative devices.

**The hero band.** A `bg-night-glow` band at the top of a page with an eyebrow chip, the title, one line of context, one primary action and a row of stats. The dashboard, the track, the lesson, the problem and the loop guide each have one.

**The track colour.** Each track has a hue from `trackStyle(slug)` in `lib/course/track-style.ts`: a `border-l-4` rail on a list row, a `border-t-4` edge on a tile, a dot in a chip. Never assemble the class name at runtime.

**The ring.** `ProgressRing` shows a ratio: gold for XP on night, brand for problems solved, a wedge for loop readiness. The number in the middle always says the same value in words for a screen reader.

**Numbered sections.** A lesson body is a stack of white cards, one per `##` heading, each with a number badge and a rail in a repeating hue (`Prose sectioned`). A senior signal is a dark card inside the stack.

**The moment.** When the learner finishes something, the screen reacts once: `animate-pop` on the XP, the mascot changes mood, one `Speech` line. Then it is quiet again.

**The learner's initial.** The sidebar and the focus top bar show the learner's initial on `bg-brand-gradient`. Elsewhere, `<Avatar name={uid} />` derives a stable face from the uid.

---

## Responsive: an app on a phone, a website on a desktop

Every screen has two postures. On a phone it is an app: it feels installed, and the thumb does the work. On a tablet or a desktop it is a website: a header at the top, the width in use, a footer at the end. One codebase serves both. The layout changes. The routes, the data and the components stay the same.

A desktop page that is one narrow column in the centre of the screen is a defect. It is the phone layout on a big screen, not a desktop layout.

### The switch is `md`

One breakpoint changes the posture: `md`, 768px.

| Width        | Posture | Prefixes to use                                         |
| ------------ | ------- | ------------------------------------------------------- |
| Below 768px  | App     | No prefix. `sm:` adjusts the layout for a large phone.  |
| 768px and up | Website | `md:` changes the posture. `lg:` and `xl:` add columns. |

- Use `md:` to change the posture. Use `sm:`, `lg:` and `xl:` only to adjust a layout inside one posture.
- Do not add a second posture switch at a different breakpoint.
- Choose the posture in CSS only. Never read `window.innerWidth`, `matchMedia` or the user agent to choose a layout. The server sends one HTML for every screen. A JavaScript switch shows the wrong layout first, then jumps.

### The two postures side by side

|                          | Phone: an app                                         | Desktop: a website                                                    |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Navigation               | `TabBar`, at the bottom, in thumb reach               | `SiteHeader`, sticky at the top, with the logo and the same links     |
| A screen below a tab     | `AppBar`: sticky, with a back arrow and the title     | The same `AppBar` scrolls with the page as its heading                |
| Page width               | The full screen, with a `px-5` gutter                 | The frame, `max-w-5xl`. The header, the page and the footer share it. |
| Composition              | One column, top to bottom                             | Columns from `lg`: the words beside the product                       |
| The primary action       | At the end of the form, full width (`block`)          | Natural width, next to the thing it acts on                           |
| A focused task (sign-in) | The full screen. The `TabBar` hides.                  | One narrow column (`max-w-md`) on the frame. The header stays.        |
| A decision (`Dialog`)    | A bottom sheet                                        | A centred modal                                                       |
| Hover                    | None. Touch has no hover.                             | An extra cue only. Never the only way to see or do a thing.           |
| Footer                   | The end of the scroll, above the `TabBar`             | The end of the page. On a short page, the bottom of the screen.       |
| Install                  | "Add to Home Screen" opens it full screen, no browser | A normal browser tab                                                  |

`APP_TABS` in `lib/navigation.ts` feeds both `TabBar` and `SiteHeader`. Add a destination there, never in only one of them.

### Build every screen in this order

1. **Draw the phone first, at 390px.** One column. The one primary action is in thumb reach. The `TabBar` or an `AppBar` gives the way around.
2. **Then draw 1440px.** Ask what goes beside what. The 1024px frame holds two or three columns.
3. **Recompose with a grid at `lg`.** Keep the markup and its order. Change only the grid.
4. **Keep the reading width.** Text stays `max-w-prose`. A form stays `max-w-md` to `max-w-xl`, also in a wide column. A 1000px-wide text field does not "use the width".
5. **Check five widths:** 320, 390, 768, 1024 and 1440. No horizontal scroll at any of them.

```tsx
// Phone: the heading, then the card. From lg: the heading beside the card.
<section className="grid gap-5 lg:grid-cols-5 lg:gap-12">
  <div className="flex flex-col gap-5 lg:col-span-2">{/* heading and words */}</div>
  <Card className="lg:col-span-3">{/* the product */}</Card>
</section>
```

The source order is the phone order. Screen readers and the keyboard follow it at every width. Do not use `order-*` to make the desktop look right.

### Desktop patterns

- **A two-column hero.** The words go on the left, the live product on the right. See `app/page.tsx`.
- **A heading beside its content.** The heading and a short intro take two of five columns. The content takes three.
- **A form beside what it makes.** The form stays in view (`lg:sticky lg:top-24`) while the list grows. See `app/example/page.tsx`.
- **An identity beside the details.** The profile card stays in view while the details scroll. See `app/profile/page.tsx`.
- **A section list on a long page.** A sticky list of section links goes on the left. See `app/design/page.tsx`.
- **A grid of distinct objects.** `sm:grid-cols-2 lg:grid-cols-3`, only when each card is an object the user acts on.

`lg:top-24` keeps a sticky column below the sticky `SiteHeader`. `scroll-padding-top` in `styles/globals.css` does the same for an anchor link.

### Phone patterns: an installable app

- **Never depend on the browser.** An installed app has no back button and no address bar. Every screen below a tab has an `AppBar` with a back arrow.
- **Thumb reach.** Navigation is at the bottom. The primary action is at the end of the form, at full width.
- **Safe areas.** The page draws under the notch (`viewportFit: 'cover'`). Fixed chrome pads itself with `env(safe-area-inset-*)`, as `TabBar` does.
- **Press feedback, not a tap flash.** The base styles remove the grey tap highlight. `squish` and `press` answer the tap.
- **Installable.** `app/manifest.ts` sets `display: 'standalone'`. The icons are in `public/icons/` (192px, 512px and a maskable 512px) and `app/apple-icon.png`. `THEME_COLOR` in `lib/pwa.ts` matches `--color-paper`. When you change the mark, export `app/icon.svg` again at each size.
- **No service worker.** The template has none, on purpose. A browser cache keeps the old build after a deploy: the same failure as trap 26 in a CDN. Add one only with a versioned cache and an update prompt. Record that decision in an ADR.

### Never

- Show the `TabBar` on a desktop.
- Show a "Menu" button on a desktop.
- Frame a page with a phone-width `<main>`. The frame is `max-w-5xl`. Make the content narrow inside it.
- Put a thing only behind hover.
- Choose a layout in JavaScript.
- Reorder content with CSS, so that the two postures read in a different order.

---

## Layout

- **Left-aligned** text and forms. Centre only a single score, or a lone empty-state message.
- **Show the product first.** The hero shows the real thing working — a board, a map, the key entry — not a description of it. On a party game, the first viewport contains the key input.
- **Vertical rhythm.** Sections are separated by `gap-16` (mobile) to `gap-24` (desktop). Inside a card, `gap-4`.
- **No card grids for the sake of it.** Three identical cards in a row is not a layout. Use cards only when each one is a distinct object the user can act on (a game, a player, a room).
- **The frame.** Every page, the header and the footer line up on `max-w-5xl`, the `PageShell` default. Use `PageShell width="reading"` (`max-w-3xl`) only for one long text, such as a policy page. The gutter is `px-5` on a phone and `sm:px-8` above it.

---

## Words

The interface speaks plainly. The mascot speaks warmly. Keep the two voices separate.

**Interface voice** (headings, buttons, labels, hints, errors):

- Say what the thing is or does, in the user's words. "Join with a key", not "Enter lobby credentials".
- Buttons are verb phrases that name the result: "Create room", "Start round", "Save nickname". The same action keeps the same name everywhere — the button "Create room" produces the toast "Room created".
- Errors say what happened and how to fix it: "Keys are 6 letters or numbers." No apologies, no "Oops".
- Sentence case. An arrow may follow a link or button that goes somewhere ("Read the loop guide →"), never one that saves or deletes. No emoji in interface text.

**Mascot voice** (only inside `Speech`):

- One line, under ~12 words, present tense, reacting to what just happened. "momo joined. That makes five of you."
- It never gives instructions that the interface needs. If the user must read it to proceed, it belongs in the interface voice.

**Banned** — these read as generated copy. Rewrite any sentence that uses them:

- Rule-of-three slogans: "No login. No download. Just a key." / "Big group, one key, zero setup."
- Words: seamless, effortless, unleash, elevate, supercharge, magic, vibe, delightful, curated, next-level, game-changer, "in seconds".
- Meta strings joined with middle dots: "2–20 players · 10 min". Write "For 2 to 20 players, about 10 minutes" or show the numbers as separate labelled facts.
- Fake content: invented testimonials, invented user counts, "Trusted by …", a diverse-sounding set of made-up full names. Example players use nicknames people actually type (`momo`, `captain_k`, `rajma chawal`).

---

## The anti-slop list

If your output contains any of these, remove it before you report the task as done. Each one is a default that generated UIs produce whatever the subject.

- An uppercase label that is not an `eyebrow`, or an eyebrow that repeats the heading under it.
- Numbered `01 / 02 / 03` markers on content that is not a real sequence.
- A "How it works" section of three equal cards as the default second section.
- Cream background with a terracotta or clay accent. Near-black with an acid-green accent.
- Soft grey blurred shadows, glassmorphism, gradient blobs, gradient text, noise textures.
- Identical border radius and shadow on every element.
- Icons from a generic set placed in coloured circles above feature text.
- A monospace face for small labels.
- Section entrances that fade and slide up on scroll.
- Repeating the primary CTA in every section. Once in the hero, once at the end, at most.
- A static "example" of the product where a live, interactive one is possible.
- Placeholder text used as a label.

---

## Accessibility floor

This is the minimum, not a goal.

- Text contrast ≥ 4.5:1. All documented pairs pass; `text-ink-soft` is for secondary text on `paper` or `surface` only.
- Visible focus on everything interactive (the base styles give a 3px `brand` ring — do not remove it).
- Colour never carries meaning alone. Errors have words. Selected states have an outline change or a check, not only a fill.
- `prefers-reduced-motion` is respected globally. Do not override it.
- Faces are decorative (`aria-hidden`) unless they are the only content; then pass `label`.
- Every input has a visible `label`.

---

## Recipes

**Signed-in dashboard, phone (390px wide):**

```
┌──────────────────────────────┐
│ ◉ Loop Ready     🔥 7  300 XP │  AppShell top bar, phone
│ ┌──────────────────────────┐ │
│ │ Level 2 · Data analyst   │ │  bg-night-glow hero
│ │ Hi, Sandeep              │ │
│ │ (60%) 300 of 400 XP      │ │  gold ring
│ │ Streak  Best  Solved     │ │
│ │ [ Continue: next lesson ]│ │  the one primary, full width
│ └──────────────────────────┘ │
│ Problems solved · calendar   │  white cards
│ ( Home )  Tracks  Problems   │  TabBar
└──────────────────────────────┘
```

**The same page, desktop (1440px wide):**

```
┌────────┬─────────────────────────────────────────────────────┐
│ ◉ Loop │ [ Search problems, tracks, concepts ⌘K ]  🔥 7  ☆ 300 │
│ Home   ├─────────────────────────────────────────────────────┤
│ Tracks │ ┌ night hero: greeting, Continue, ring, 4 stats ──┐ │
│ Probs  │ └─────────────────────────────────────────────────┘ │
│        │ [ Problems solved ]  [ Study calendar ]             │
│ 🔥 7d  │ [ Loop readiness: Uber · Google, dark band ]        │
│ Sandeep│ [ Your tracks ]          [ Problems to try next ]   │
└────────┴─────────────────────────────────────────────────────┘
```

**Lesson page:** the focus shell with a breadcrumb. A night hero with the lesson chip, the title and four stats. Then one white card per `##` section. Then "Check yourself" and the finish card. From `lg`, an aside with the lessons in the track, previous and next, the next milestone and "How to use this lesson".

**Empty state:** a `Face mood="sleepy"` at 72px, one line saying what goes here, one button that fills it.

**Error state:** an `Alert tone="danger"` with the cause and the fix, plus the action as a `Button`. `animate-wobble` on the field that caused it.

**Finish state:** the XP in `text-key` with `animate-pop`, the mascot's `wow` face, one `Speech` line, a success `Alert`.

---

## The site checklist

Every site built from this template passes this list before it goes live. The template already passes it. Keep it that way when you add a page.

The **Check** column says what stops a regression. "Test" is `tests/site-checklist.test.ts`, which runs in `pnpm validate`. "Look" is a human check: do it at 320px, 768px and 1440px.

### Layout and mobile

| Item                           | The rule                                                                                                                           | Check      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| No horizontal scroll           | Nothing is wider than the screen at 320px. Use `w-full`, `max-w-*`, `min-w-0` and `break-words`. Never a fixed `w-[…]`.            | Look, lint |
| No mobile overflow             | Long words, URLs and ids wrap (`break-all`, `truncate`). Tables and code blocks scroll inside their own box.                       | Look       |
| Every page is mobile optimized | Unprefixed classes are the phone layout. `sm:`/`md:`/`lg:` only add to it. Tap targets are 44px or more.                           | Look       |
| A mobile menu                  | On a phone, the `TabBar` is the menu. A website with no tab bar uses `Header`, which folds its links into `MobileMenu` below `md`. | Test       |
| A desktop that is a website    | From `md` up, `SiteHeader` replaces `TabBar`. Every `<main>` uses the `max-w-5xl` frame, and content goes into columns at `lg`.    | Test, look |
| Installable on a phone         | `app/manifest.ts` is `standalone`, with 192px, 512px and maskable icons, and `app/apple-icon.png`.                                 | Test       |

`body` has `overflow-x: clip` in `styles/globals.css`. That is a safety net, not the fix. It hides the scroll bar, but the clipped content is still lost. Find the element that overflows and fix it.

### Links and navigation

| Item                   | The rule                                                                                                           | Check      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| No broken links        | Every internal `href` points to a page or route handler that exists.                                               | Test       |
| Footer links work      | A footer link goes to a real page. When you remove a page, remove its links in the same PR.                        | Test       |
| No unused navigation   | A header link, tab or footer link exists only for a page that exists and that users need. Three to five at most.   | Test, look |
| The logo is clickable  | The logo in `Header` always links to `/`. Do not replace it with a plain image.                                    | Test       |
| The phone is clickable | Show a phone number with `ContactLink kind="phone"` or `Footer contact`. A tap dials it.                           | Test       |
| The email is clickable | Show an email address with `ContactLink kind="email"` or `Footer contact`. A tap opens the mail app.               | Test       |
| A custom 404 page      | `app/not-found.tsx` follows the empty-state recipe: a face, one line, one link home. Keep it. Restyle, never drop. | Test       |

Write an external link as a full URL. `Footer` renders it as a plain `<a>`, and an in-app path as `next/link`.

### Page metadata

| Item               | The rule                                                                                                                    | Check |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| Page titles        | Every `page.tsx` exports `metadata` with a `title`. The layout adds `\| <app name>`. The home page may use the default.     | Test  |
| Meta descriptions  | Every `page.tsx` exports a `description` of one sentence, under 160 characters, that says what the page is for.             | Test  |
| A favicon          | `app/icon.svg` is the mascot face. Next.js serves it and links it on every page. Replace it with the product's own mark.    | Test  |
| The copyright year | Never type a year. `Footer owner="…"` builds `© <year> <owner>` from the clock. A static page fixes the year at build time. | Test  |

A statically rendered page keeps the year of its build. Every deploy rebuilds it. Deploy at least once a year, or make the page dynamic.

### Content and feedback

| Item                | The rule                                                                                                                                           | Check      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| No placeholder text | No "lorem ipsum", "TODO", "coming soon", `example.com` or template copy on a live page. Write the real words.                                      | Test       |
| Compressed images   | Use `next/image`: it resizes and serves WebP. A file in `public/` stays under 200 KB. Prefer SVG for marks.                                        | Test       |
| No broken buttons   | A `Button` submits a form (`type="submit"`) or has an `onClick`. A button that goes somewhere is a `Link` with `buttonStyles()`. Never `href="#"`. | Test, look |
| A success message   | An action that saves or sends something shows `Alert tone="success"` that names the result: "Profile saved."                                       | Look       |
| An error message    | A failed action shows `Alert tone="danger"`: what happened and how to fix it. Never fail silently.                                                 | Look       |

`ProfileForm` and `ExampleForm` show both messages. Copy them. A signed URL image is the one case for a plain `<img>`, because `next/image` cannot optimise a URL that expires. Size the upload on the server instead.

---

## Enforcement

Rules 2 to 6 are lint checks, not reminders. The `template/design-language` block in `eslint.config.mjs` reads every `className` — the string form, the strings passed to `cn()`, and template literals — and fails the build on:

| Refused in a `className`                                                 | Rule |
| ------------------------------------------------------------------------ | ---- |
| A raw hex value, or an arbitrary `bg-[…]` / `shadow-[…]` / `rounded-[…]` | 2    |
| A default Tailwind colour: `text-gray-500`, `bg-white`, `border-black`   | 3, 9 |
| A `border-2`, `border-4` or `border-8` width (rails use `border-l-4`)    | 4    |
| A blurred shadow: bare `shadow`, `shadow-sm`, `shadow-lg`                | 5    |
| A default radius: `rounded-md`, `rounded-xl`                             | 6    |
| A size outside the scale: `text-sm`, `text-2xl`                          | Type |

Each message names the rule it enforces. To step outside one, say why on the line: `// eslint-disable-next-line no-restricted-syntax -- reason`. A bare disable is a defect.

Two limits to know:

- The checks read literal strings. A class name built at runtime from a variable escapes them.
- They read `className` only. An SVG `fill` attribute is not a class name, which is why the white specular dot in `Face.tsx` is a literal `#fff`. It is a highlight on an ink pupil, not a theme colour, and it stays white in every theme.
- Hex values inside `styles/globals.css` are the tokens themselves, so the check does not read that file.

Everything else on this page is a human judgement: one primary action, one dark band, the words and the anti-slop list. No check replaces looking at the screen.

---

## Before you report UI work as done

Check each item. Do not skip the last one.

1. It works at 320px, 768px and 1440px: an app on the phone, a website on the desktop. No horizontal scroll.
2. [The site checklist](#the-site-checklist) passes.
3. One primary button per viewport.
4. `pnpm validate` is green. It fails on the token rules above, so a clean run means the diff carries no raw hex, arbitrary value, or default Tailwind colour, size, radius or shadow.
5. Nothing from the anti-slop list or the banned words.
6. Budgets respected: peek, speech, stickers, large shadow.
7. Every new or changed primitive appears on `/design` and has a colocated `<Name>.test.tsx`.
8. **Remove one thing.** Look at the screen and take away the least necessary decoration. Then check again.
