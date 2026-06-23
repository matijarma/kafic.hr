// Pure scheduled-pricing engine. No DOM / db / i18n -> unit-testable in Node.
//
// Rule shape:
//   { id, label, scope: { type:'item'|'cat', id }, mode:'abs'|'pct'|'delta',
//     value, days:[0..6], from:"HH:MM", to:"HH:MM", active }
//   - days: weekday numbers (0=Sun .. 6=Sat); empty/absent = every day.
//   - from/to: local time window; from===to or missing = all day; from>to wraps midnight.
//   - mode: 'abs' = fixed price, 'pct' = percent OFF the base, 'delta' = add value (negative = discount).

const round2 = (n) => Math.round((n || 0) * 100) / 100;

const toMin = (hhmm) => {
    if (!hhmm || typeof hhmm !== 'string') return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

export const isRuleActive = (rule, now = new Date()) => {
    if (!rule || rule.active === false) return false;
    const day = now.getDay();
    if (Array.isArray(rule.days) && rule.days.length && !rule.days.includes(day)) return false;
    const from = toMin(rule.from), to = toMin(rule.to);
    if (from == null || to == null || from === to) return true; // no window = all day
    const cur = now.getHours() * 60 + now.getMinutes();
    return from < to ? (cur >= from && cur < to) : (cur >= from || cur < to); // wrap past midnight
};

const applyMode = (base, rule) => {
    const v = Number(rule.value) || 0;
    let p = base;
    if (rule.mode === 'abs') p = v;
    else if (rule.mode === 'pct') p = base * (1 - v / 100);
    else if (rule.mode === 'delta') p = base + v;
    return Math.max(0, round2(p));
};

// Resolve the effective price for a leaf node given its ancestor category ids.
// Item-scoped rules win over category-scoped; among same scope, first active match wins.
export const effectivePrice = (node, ancestorCatIds, rules, now = new Date()) => {
    const base = parseFloat(node && node.price) || 0;
    if (!Array.isArray(rules) || !rules.length) return { price: base, ruleId: null, base };
    const active = rules.filter(r => isRuleActive(r, now));
    let match = active.find(r => r.scope && r.scope.type === 'item' && r.scope.id === node.id);
    if (!match) match = active.find(r => r.scope && r.scope.type === 'cat' && (ancestorCatIds || []).includes(r.scope.id));
    if (!match) return { price: base, ruleId: null, base };
    return { price: applyMode(base, match), ruleId: match.id, base };
};

// Build an id -> effective price map by walking the menu while tracking ancestor category ids.
export const buildEffectivePriceMap = (menu, rules, now = new Date()) => {
    const map = {};
    const walk = (nodes, ancestors) => {
        (nodes || []).forEach(n => {
            if (n.children) walk(n.children, ancestors.concat(n.id));
            else if (n.id != null) map[n.id] = effectivePrice(n, ancestors, rules, now).price;
        });
    };
    walk(menu, []);
    return map;
};
