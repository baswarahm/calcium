# Calcium — Scientific Calculator

A professional-grade scientific calculator that runs entirely in the browser:
plain HTML, CSS, and vanilla JavaScript, no build step, no frameworks, no
`eval()`. It covers everyday arithmetic, trigonometry, logarithms, matrices,
vectors, statistics, equation solving, unit conversion, and function
graphing, with expression editing, calculation history, variables, and
memory that all persist across page reloads.

---

## 1. Running it

**Quickest way:** open `calcium-standalone.html` directly in any browser
(double-click it, or drag it into a browser window). Every CSS and JS file
is bundled inline into that one file, so it needs no local server and no
internet connection (beyond the two optional Google Fonts, which fail
silently and fall back to system fonts if you're offline).

**If you're working from the modular source** (the `css/` and `js/` folders
next to `index.html` — better for reading/editing the code), you do need a
local server, because browsers block relative `fetch`-style script loading
under some `file://` security policies and partition `localStorage`
differently per origin. Serving it as `http://localhost` avoids both:

```bash
# Python 3 (built into most systems)
cd scientific-calculator
python3 -m http.server 8000
# then open http://localhost:8000

# Node.js
npx serve scientific-calculator

# VS Code
# Right-click index.html → "Open with Live Server"
```

No `npm install`, no bundler, no dependencies beyond two Google Fonts
loaded from a CDN (the UI still works fine offline — it just falls back to
the browser's default sans-serif/monospace fonts).

---

## 2. Architecture

```
/scientific-calculator
│
├── index.html            Page structure: display, keypad, side panels, modals
├── README.md
│
├── css/
│   ├── main.css           Design tokens, resets, layout grid, modals, toasts
│   ├── calculator.css     Expression display + keypad + history/variable rows
│   ├── themes.css         Dark (default) and light theme variable sets
│   └── responsive.css     Tablet / mobile / small-phone breakpoints
│
└── js/
    ├── storage.js         Thin localStorage wrapper (namespacing + JSON + errors)
    ├── functions.js       Pure math helpers: constants, angle conversion,
    │                      combinatorics, gcd/lcm, CalcError type
    ├── parser.js           Tokenizer + recursive-descent parser + evaluator
    │                      (the "safe expression engine" — no eval())
    ├── calculator.js      Expression buffer, cursor, evaluate(), formatting
    ├── memory.js          MC / MR / M+ / M− plus named memory slots
    ├── variables.js       User variables (x = 10) with validation
    ├── history.js         Calculation history store (capped, persisted)
    ├── solver.js           Linear & quadratic equation solving
    ├── matrix.js           Matrix add/sub/mul/transpose/det/inverse/trace
    ├── vector.js           Vector add/sub/dot/cross/magnitude/unit/angle
    ├── statistics.js       Descriptive statistics (population & sample)
    ├── converter.js        Unit conversion across 10 categories
    ├── graph.js            Canvas function plotter: pan, zoom, grid, axes
    ├── ui.js               All DOM wiring: rendering, event delegation,
    │                      keyboard shortcuts, panels, modals, toasts
    └── app.js               Boots UI.init() once the DOM is ready
```

**Why this split:** every calculation module (`parser`, `matrix`, `vector`,
`statistics`, `solver`, `converter`, `functions`) is pure logic with zero DOM
access, so it can be reasoned about (and unit-tested) independently of the
UI. `ui.js` is the only file that touches `document`; it reads state from
the logic modules and renders it, and translates clicks/keystrokes back into
calls on those modules. `storage.js` is the single choke point for
persistence, so every module that needs to persist something (history,
variables, memory, settings) goes through the same abstraction instead of
scattering raw `localStorage` calls around the codebase.

### The expression engine (no `eval()`)

`parser.js` implements a small grammar by hand:

```
expression := term (('+' | '-') term)*
term       := unary (('*' | '/' | 'mod' | implicit-multiply) unary)*
unary      := ('-' | '+') unary | power
power      := postfix ('^' unary)?          // right-associative
postfix    := primary ('!' '!'? | '%')*     // factorial / double-factorial / percent
primary    := NUMBER | IDENT '(' args ')' | IDENT | '(' expression ')'
```

User input is tokenized, parsed into an AST, and walked by a small evaluator
that calls into `MathFn` for the actual math. At no point is user text
handed to `eval()`, `new Function()`, or any other dynamic-code path — it is
only ever interpreted as data by this grammar. Every runtime failure (divide
by zero, domain errors, invalid factorials, unknown variables, malformed
syntax) is caught and turned into a `CalcError` with a human-readable
message, which the UI shows in the display instead of crashing or printing
`NaN`.

### Angle modes

Trigonometric functions in the main expression engine (and the Vector
angle-between calculation) respect whichever angle mode is currently active
in the top bar (DEG / RAD / GRAD). The **Graph** tab always plots in
radians regardless of that setting — that's the standard convention for
`y = f(x)` plots and keeps curves like `sin(x)` recognizable over a default
`[-10, 10]` window.

---

## 3. Implemented features

- **Core calculator** — all four operations, modulo (`mod`), percentage,
  sign toggle, parentheses, decimals, scientific notation, correct operator
  precedence, nested expressions.
- **Scientific functions** — sin/cos/tan and their inverses and hyperbolic
  variants, all angle-mode aware.
- **Logs & exponentials** — ln, log₁₀, log₂, arbitrary-base log, eˣ, 10ˣ.
- **Powers & roots** — x², x³, xʸ, √x, ∛x, arbitrary nth root, 1/x, n!,
  double factorial.
- **Constants** — π, e, φ, √2, √3, ln2, ln10, plus six physical constants
  (c, h, G, elementary charge, Boltzmann, Avogadro), each showing symbol,
  name, and value.
- **Memory** — MC / MR / M+ / M− with a live indicator light, plus a named
  memory-slots API in `memory.js`.
- **Expression editor** — a real text cursor you can move with the arrow
  keys, Home/End, and backspace/delete, not a single-number display.
- **History** — every calculation is stored with its expression and
  result, clickable to reuse, individually deletable, clearable, capped at
  100 entries, persisted in localStorage.
- **Variables** — `x = 10` syntax, a dedicated panel to add/edit/delete
  them, persisted in localStorage.
- **Equation solver** — linear (`ax + b = c`) and quadratic
  (`ax² + bx + c = 0`) with discriminant and real/repeated/complex-root
  handling.
- **Matrix mode** — 2×2 and 3×3: add, subtract, multiply, scalar multiply,
  transpose, determinant, inverse, trace, identity.
- **Vector mode** — 2D and 3D: add, subtract, dot product, cross product,
  magnitude, unit vector, angle between.
- **Statistics** — count, sum, mean, median, mode, min, max, range,
  population/sample variance & standard deviation, quartiles, IQR, and a
  small histogram.
- **Unit converter** — length, mass, temperature, area, volume, speed,
  time, energy, pressure, data.
- **Graphing** — multiple `y = f(x)` functions on one canvas, pan (drag),
  zoom (buttons or scroll wheel), grid with axis labels, reset view.
- **Precision control** — automatic (clean float formatting, no
  `0.30000000000000004`), fixed 2–10 decimals, or scientific notation.
- **Error handling** — every failure mode produces a specific, friendly
  message instead of `NaN` or a crash.
- **Keyboard support** — full numeric/operator entry, Enter to calculate,
  Escape to clear, arrow-key cursor movement, Home/End, with a reference
  table in the Help modal.
- **Themes** — dark (default) and light, persisted, toggle in the top bar.
- **Accessibility** — semantic landmarks, ARIA labels on icon buttons,
  visible focus rings everywhere, `aria-live` regions for results/errors,
  `prefers-reduced-motion` respected.
- **Responsive design** — desktop two-column layout collapses to a single
  stacked column on tablets/phones; the keypad splits into Basic /
  Scientific / Functions / Constants tabs so it never feels overcrowded on
  a small screen.
- **Settings panel** — theme, angle mode, precision, sound feedback,
  clear history, and a full app-data reset, each destructive action gated
  behind a confirmation dialog.
- **Help modal** — reference sections for every mode, with worked examples.

---

## 4. Testing checklist

This project was verified with an automated Chromium (Playwright) pass
exercising the actual UI, plus a standalone unit pass on the expression
parser. Re-run manually with the checklist below after any change:

### Mathematical correctness
- [ ] `2 + 3 × 4` → `14` (precedence, not left-to-right)
- [ ] `(2 + 3) × 4` → `20`
- [ ] `sin(30)` in DEG → `0.5`
- [ ] `sin(π/2)` in RAD → `1`
- [ ] `log(100)` → `2`
- [ ] `2^10` → `1024`
- [ ] `√144` → `12`
- [ ] `5!` → `120`
- [ ] `10 mod 3` → `1`
- [ ] `10C3` (`ncr(10,3)`) → `120`, `10P3` (`npr(10,3)`) → `720`
- [ ] `1 / 0` → friendly "Cannot divide by zero", not `Infinity`/`NaN`
- [ ] `((5 + 3) × 2)²` → `256` (nested expressions)
- [ ] `-5 + 3` → `-2`, `(-3)^2` → `9` (negative numbers)
- [ ] `3.5 × 2` → `7` (decimals, clean formatting)
- [ ] `x = 10` then `x² + 5` → `105` (variables)
- [ ] `det([[4,7],[2,6]])` → `10`, `[[2,0],[0,2]]⁻¹` → `[[0.5,0],[0,0.5]]`

### UI
- [ ] Desktop two-column layout renders correctly
- [ ] Tablet and mobile (375px) layouts stack and stay usable
- [ ] Dark and light themes both readable with correct contrast
- [ ] Keyboard-only navigation (Tab, arrow keys, Enter, Escape) works
      throughout, with a visible focus ring at every stop
- [ ] Every button on every keypad tab does something (no dead buttons)

### Persistence
- [ ] Refresh the page: history remains
- [ ] Refresh the page: variables remain
- [ ] Refresh the page: theme remains
- [ ] Refresh the page: precision/angle-mode settings remain

---

## 5. Notes on scope

`matrix.js`'s determinant/inverse routines use cofactor expansion, which is
correct and simple for the 2×2/3×3 sizes exposed in the UI (and works for
any square size in principle, just not the most efficient approach for
large matrices — which is fine here since the UI caps out at 3×3).