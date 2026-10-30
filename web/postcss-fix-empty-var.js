/** @type {import('postcss').PluginCreator} */
const plugin = () => {
  return {
    postcssPlugin: "postcss-fix-empty-var",
    Rule(rule) {
      const props = new Map()
      const declByProp = new Map()

      // Rule içinde tanımlı custom property'leri topla
      rule.walkDecls(/^--tw-/, (decl) => {
        props.set(decl.prop, decl.value)
        declByProp.set(decl.prop, decl)
      })

      if (props.size === 0) return

      // Sadece filter/backdrop-filter içine gerçekten inline edilen
      // (kullanılan) custom property'leri işaretle — --tw-translate-x gibi
      // filter'la hiç ilgisi olmayan başka --tw-* değişkenlerini silme
      // (bu utility'leri (translate/scale/rotate gibi) tamamen kırıyordu).
      const consumed = new Set()

      rule.walkDecls(/^(filter|backdrop-filter)$/, (decl) => {
        if (!decl.value.includes("var(")) return

        // Tanımlı olan var'ları değeriyle değiştir, tanımsız olanları sil
        let value = decl.value.replace(/var\(([^,)]+),?\s*\)/g, (_, name) => {
          if (!props.has(name)) return ""
          consumed.add(name)
          return props.get(name)
        })

        value = value.replace(/\s+/g, " ").trim()

        if (value) {
          decl.value = value
        } else {
          decl.remove()
        }
      })

      // Sadece yukarıda gerçekten inline edilenleri kaldır
      for (const name of consumed) {
        declByProp.get(name)?.remove()
      }
    },
  }
}

plugin.postcss = true
export default plugin
