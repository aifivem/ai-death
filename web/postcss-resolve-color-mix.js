/**
 * PostCSS plugin: old CEF (FiveM) compatibility
 *
 * Fixes for features not supported by FiveM's embedded Chromium:
 *
 * 1. Resolves every color-mix(in oklab, ...) declaration into a literal
 *    rgba(): Tailwind 4 emits these for opacity modifiers (bg-foo/50),
 *    either wrapped in @supports (color: color-mix(...)) or as a bare
 *    second same-selector declaration meant to override a plain-color
 *    fallback in browsers that understand color-mix(). Old CEF doesn't
 *    understand color-mix() OR the @supports feature query that guards
 *    it, so both patterns must be baked down to a real rgba() up front
 *    rather than relying on graceful degradation.
 *
 * 2. Unwraps @media (hover: hover):
 *    Tailwind 4 wraps hover: utilities in this media query.
 *    Old CEF doesn't support it, so hover effects don't work.
 *
 * Must run AFTER @csstools/postcss-oklab-function and postcss-color-functional-notation
 * so that :root values are in legacy rgb(r, g, b) format.
 *
 * @type {import('postcss').PluginCreator}
 */
const plugin = () => {
  return {
    postcssPlugin: "postcss-resolve-color-mix",
    Once(root) {
      // Step 1: Collect all custom property values from :root and :host
      // (including those inside @layer theme, @layer base, etc.)
      const vars = {}
      root.walkRules((rule) => {
        if (!/(^|,)\s*:(?:root|host)\s*(,|$)/.test(rule.selector)) return
        rule.walkDecls(/^--/, (decl) => {
          vars[decl.prop] = decl.value
        })
      })

      const unwrapAtRule = (atRule) => {
        const parent = atRule.parent
        const nodes = []
        atRule.each((node) => nodes.push(node.clone()))
        for (const node of nodes) {
          parent.insertBefore(atRule, node)
        }
        atRule.remove()
      }

      // Step 2: Unwrap @media (hover: hover) blocks for old CEF compatibility
      // Tailwind 4 wraps all hover: utilities in @media (hover: hover) which
      // old CEF doesn't support, making hover effects non-functional.
      root.walkAtRules("media", (atRule) => {
        if (/^\(\s*hover\s*:\s*hover\s*\)$/.test(atRule.params)) {
          unwrapAtRule(atRule)
        }
      })

      // Step 3: Resolve every color-mix(in oklab, ...) declaration anywhere
      // in the stylesheet — regardless of whether Tailwind emitted it bare,
      // as a fallback-override pair, or wrapped in @supports.
      root.walkDecls((decl) => {
        if (!decl.value.includes("color-mix(")) return
        decl.value = resolveColorMixValue(decl.value, vars)
      })

      // Step 4: Drop the now-redundant @supports wrapper itself — old CEF
      // doesn't evaluate this feature query reliably either, so keeping the
      // (already-resolved) declarations wrapped in it risks losing them.
      root.walkAtRules("supports", (atRule) => {
        if (atRule.params.includes("color-mix")) unwrapAtRule(atRule)
      })
    },
  }
}

/** Resolve a `--custom-property` name to its final literal value, following var() chains. */
function resolveVar(name, vars, depth = 0) {
  if (depth > 5) return null
  const value = vars[name]
  if (value === undefined) return null
  const m = value.trim().match(/^var\(\s*(--[a-zA-Z0-9_-]+)\s*\)$/)
  return m ? resolveVar(m[1], vars, depth + 1) : value.trim()
}

/**
 * Split a color-mix() first argument ("<color><N>%") into its color and
 * percentage parts. Tailwind's minifier sometimes drops the space between
 * them (e.g. "#fff10%", "var(--green)60%"), which is ambiguous for a plain
 * hex tail — so hex lengths are tried shortest-first (3/4/6/8 are the only
 * valid lengths, and this codebase's literals are all 3-digit) while a
 * var(...) reference is unambiguous thanks to its own closing paren.
 */
function extractColorAndPercent(chunk) {
  let m = chunk.match(/^(var\([^)]*\))\s*(\d+(?:\.\d+)?)%$/i)
  if (m) return { colorExpr: m[1], pct: parseFloat(m[2]) }

  for (const len of [3, 4, 6, 8]) {
    const re = new RegExp(`^(#[0-9a-f]{${len}})\\s*(\\d+(?:\\.\\d+)?)%$`, "i")
    m = chunk.match(re)
    if (m) return { colorExpr: m[1], pct: parseFloat(m[2]) }
  }

  m = chunk.match(/^([a-z]+)\s*(\d+(?:\.\d+)?)%$/i)
  if (m) return { colorExpr: m[1], pct: parseFloat(m[2]) }

  return null
}

function resolveColorMixValue(value, vars) {
  return value.replace(
    /color-mix\(\s*in\s+oklab\s*,\s*([^,]+?)\s*,\s*transparent\s*\)/gi,
    (whole, inner) => {
      const parsed = extractColorAndPercent(inner.trim())
      if (!parsed) return whole

      let colorStr = parsed.colorExpr
      const varMatch = colorStr.match(/^var\(\s*(--[a-zA-Z0-9_-]+)\s*\)$/)
      if (varMatch) {
        const resolved = resolveVar(varMatch[1], vars)
        if (!resolved) return whole
        colorStr = resolved
      }

      const rgb = parseColor(colorStr)
      if (!rgb) return whole

      const alpha = Math.round(rgb.a * (parsed.pct / 100) * 10000) / 10000
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
    }
  )
}

/**
 * Parse a CSS color string into { r, g, b, a } components.
 * Handles: rgb(), rgba(), #hex, #hexa, and modern rgb(r g b / a) notation.
 */
function parseColor(str) {
  // #rgb / #rrggbb or #rgba / #rrggbbaa
  let m = str.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    const hex = m[1]
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0] + hex[0]
      const g = hex[1] + hex[1]
      const b = hex[2] + hex[2]
      const a = hex.length === 4 ? hex[3] + hex[3] : "ff"
      return {
        r: parseInt(r, 16),
        g: parseInt(g, 16),
        b: parseInt(b, 16),
        a: parseInt(a, 16) / 255,
      }
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }

  // rgba(r, g, b, a) or rgb(r, g, b)
  m = str.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+%?))?\s*\)/
  )
  if (m) {
    return {
      r: Math.round(parseFloat(m[1])),
      g: Math.round(parseFloat(m[2])),
      b: Math.round(parseFloat(m[3])),
      a: m[4]
        ? m[4].endsWith("%")
          ? parseFloat(m[4]) / 100
          : parseFloat(m[4])
        : 1,
    }
  }

  // Modern notation: rgb(r g b) or rgb(r g b / a)
  m = str.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/
  )
  if (m) {
    return {
      r: Math.round(parseFloat(m[1])),
      g: Math.round(parseFloat(m[2])),
      b: Math.round(parseFloat(m[3])),
      a: m[4]
        ? m[4].endsWith("%")
          ? parseFloat(m[4]) / 100
          : parseFloat(m[4])
        : 1,
    }
  }

  return null
}

plugin.postcss = true
export default plugin
