# Calcium — Scientific Calculator

A professional-grade scientific calculator that runs entirely in the browser:
plain HTML, CSS, and vanilla JavaScript, no build step, no frameworks, no
`eval()`. It covers everyday arithmetic, trigonometry, logarithms, matrices,
vectors, statistics, equation solving, unit conversion, and function
graphing, with expression editing, calculation history, variables, and
memory that all persist across page reloads.


## Implemented features

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
## Notes on scope

`matrix.js`'s determinant/inverse routines use cofactor expansion, which is
correct and simple for the 2×2/3×3 sizes exposed in the UI (and works for
any square size in principle, just not the most efficient approach for
large matrices — which is fine here since the UI caps out at 3×3).
