// 手环计算器 · 纯逻辑层（表达式求值 / 分数 / 方程 / 换算 / 进制）
// 与界面无关，可在 Node 里单独测试。

// ---------- 表达式求值 ----------
// 显示字形：× ÷ − ；内部统一映射为 * / -
// 支持：函数 sin cos tan log ln sqrt(√) cbrt(³√) abs、幂 ^、后缀 ² ! °
// % 语义：单值后缀 = /100（如 50% → 0.5）；
//         在 a + b% / a − b% 中按计算器惯例 = a ± a×b%（如 100+10% → 110）
// 三角函数默认角度制（贴合中小学生），opts.deg=false 时为弧度制

const FUNC_NAMES = ['sin', 'cos', 'tan', 'log', 'ln', 'abs']

function tokenize(src) {
  const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  const toks = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ' || ch === ',') { i++; continue }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i
      let dot = false
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) {
        if (s[j] === '.') { if (dot) break; dot = true }
        j++
      }
      if (s[j] === 'e' && j + 1 < s.length && /[0-9+\-]/.test(s[j + 1])) {
        let k = j + 1
        if (s[k] === '+' || s[k] === '-') k++
        if (k < s.length && s[k] >= '0' && s[k] <= '9') {
          while (k < s.length && s[k] >= '0' && s[k] <= '9') k++
          j = k
        }
      }
      const v = parseFloat(s.slice(i, j))
      if (isNaN(v)) throw new Error('bad number')
      toks.push({ t: 'num', v: v })
      i = j
      continue
    }
    if (ch === 'π') { toks.push({ t: 'num', v: Math.PI }); i++; continue }
    if (ch === '√') { toks.push({ t: 'fn', v: 'sqrt' }); i++; continue }
    if (ch === '³') { // ³√ 连写
      if (s[i + 1] === '√') { toks.push({ t: 'fn', v: 'cbrt' }); i += 2; continue }
      throw new Error('bad char ³')
    }
    if (ch >= 'a' && ch <= 'z') {
      let j = i
      while (j < s.length && s[j] >= 'a' && s[j] <= 'z') j++
      const w = s.slice(i, j)
      if (w === 'e') { toks.push({ t: 'num', v: Math.E }); i = j; continue }
      if (FUNC_NAMES.indexOf(w) >= 0) { toks.push({ t: 'fn', v: w }); i = j; continue }
      throw new Error('bad word ' + w)
    }
    if ('+-*/%()^!°'.indexOf(ch) >= 0) { toks.push({ t: ch }); i++; continue }
    if (ch === '²') { toks.push({ t: '²' }); i++; continue }
    throw new Error('bad char ' + ch)
  }
  return toks
}

function fact(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error('fact domain')
  if (n > 170) throw new Error('overflow')
  let r = 1
  for (let k = 2; k <= n; k++) r *= k
  return r
}

function applyFn(name, x, deg, isRad) {
  const useDeg = deg && !isRad
  if (name === 'sin') return Math.sin(useDeg ? x * Math.PI / 180 : x)
  if (name === 'cos') return Math.cos(useDeg ? x * Math.PI / 180 : x)
  if (name === 'tan') {
    if (useDeg && ((x % 180) + 180) % 180 === 90) throw new Error('undefined')
    return Math.tan(useDeg ? x * Math.PI / 180 : x)
  }
  if (name === 'log') { if (x <= 0) throw new Error('domain'); return Math.log10(x) }
  if (name === 'ln') { if (x <= 0) throw new Error('domain'); return Math.log(x) }
  if (name === 'sqrt') { if (x < 0) throw new Error('domain'); return Math.sqrt(x) }
  if (name === 'cbrt') return Math.cbrt ? Math.cbrt(x) : Math.sign(x) * Math.pow(Math.abs(x), 1 / 3)
  if (name === 'abs') return Math.abs(x)
  throw new Error('fn ' + name)
}

function evaluate(src, opts) {
  const deg = !opts || opts.deg !== false
  const toks = tokenize(src)
  if (!toks.length) throw new Error('empty')
  let pos = 0
  function peek() { return pos < toks.length ? toks[pos] : null }
  function next() { return toks[pos++] }

  // atom：数字/常数/括号/函数调用，返回 {v, rad}（rad = 子表达式里出现过 °，值已是弧度）
  function parseAtom() {
    const tk = next()
    if (!tk) throw new Error('unexpected end')
    if (tk.t === 'num') return { v: tk.v, rad: false }
    if (tk.t === '(') {
      const r = parseExprW()
      const close = next()
      if (!close || close.t !== ')') throw new Error('missing )')
      return r
    }
    if (tk.t === 'fn') {
      const open = next()
      if (!open || open.t !== '(') throw new Error('fn needs (')
      const arg = parseExprW()
      const close = next()
      if (!close || close.t !== ')') throw new Error('missing )')
      return { v: applyFn(tk.v, arg.v, deg, arg.rad), rad: false }
    }
    throw new Error('unexpected ' + tk.t)
  }
  // postfix：% ² ! ° 可连用；° 的弧度标记随括号与四则运算向外传播，不会丢
  // 仅当整体只有一个 % 时带 pctRaw（供加减惯例）；% 后再跟别的后缀则作废惯例
  function parsePostfix() {
    const base = parseAtom()
    let v = base.v
    let rad = base.rad
    let pctRaw = null
    let nPost = 0
    while (peek() && (peek().t === '%' || peek().t === '²' || peek().t === '!' || peek().t === '°')) {
      const op = next().t
      nPost++
      if (op === '%') { if (pctRaw === null && nPost === 1) pctRaw = v; else pctRaw = null; v = v / 100 }
      else if (op === '²') { pctRaw = null; v = v * v }
      else if (op === '!') { pctRaw = null; v = fact(v) }
      else if (op === '°') { pctRaw = null; v = v * Math.PI / 180; rad = true }
    }
    return { v: v, pctRaw: pctRaw, rad: rad }
  }
  // power：一元符号 + ^ （右结合，符号结合力低于 ^：−2^2 = −4）
  function parsePower() {
    const tk = peek()
    if (tk && (tk.t === '-' || tk.t === '+')) {
      next()
      const f = parsePower()
      return { v: tk.t === '-' ? -f.v : f.v, pctRaw: null, rad: f.rad }
    }
    const base = parsePostfix()
    if (peek() && peek().t === '^') {
      next()
      const exp = parsePower()
      const v = Math.pow(base.v, exp.v)
      if (isNaN(v)) throw new Error('domain')
      return { v: v, pctRaw: null, rad: base.rad || exp.rad }
    }
    return base
  }
  function parseTerm() {
    let left = parsePower()
    let single = true
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = next().t
      const right = parsePower()
      single = false
      if (op === '*') left = { v: left.v * right.v, pctRaw: null, rad: left.rad || right.rad }
      else {
        if (right.v === 0) throw new Error('div0')
        left = { v: left.v / right.v, pctRaw: null, rad: left.rad || right.rad }
      }
    }
    return { v: left.v, pctRaw: single ? left.pctRaw : null, rad: left.rad }
  }
  function parseExprW() {
    let left = parseTerm()
    let lv = left.v
    let lrad = left.rad
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = next().t
      const right = parseTerm()
      let rv = right.v
      if (right.pctRaw !== null) rv = lv * right.pctRaw / 100
      lv = op === '+' ? lv + rv : lv - rv
      lrad = lrad || right.rad
    }
    return { v: lv, rad: lrad }
  }
  const out = parseExprW().v
  if (pos !== toks.length) throw new Error('trailing')
  if (typeof out !== 'number' || isNaN(out)) throw new Error('nan')
  return out
}

// ---------- 数字格式化 ----------

function cleanNum(v) {
  if (typeof v !== 'number' || isNaN(v)) return NaN
  if (!isFinite(v)) return v
  if (v === 0) return 0
  // 整数原样保留：18!、15 位整数等不能被 12 位有效数字截断
  if (Number.isInteger(v)) return v
  const r12 = parseFloat(v.toPrecision(12))
  // 极小值分两种：能用 12 位有效数字精确表示的（如 1e-16、5e-16）是真值，
  // 走科学计数法显示，不能吞成 0（1.5.6 实证：1÷10^16、x²+1e16x+1 的小根 −1e-16
  // 都曾被吞成 0）；表示不干净的（如 sin(180°) = 1.2246…e-16、0.1+0.2−0.3
  // = 5.55…e-17）是浮点消去尾巴，归零
  if (Math.abs(v) < 1e-15) return r12 === v ? r12 : 0
  return r12
}

// 纯文本（可再次参与运算）：无千分位
function formatPlain(v) {
  const c = cleanNum(v)
  if (isNaN(c)) return '错误'
  if (!isFinite(c)) return '溢出'
  return String(c)
}

// 显示文本：整数部分加千分位
// 显示串与真实值是否严格相等：相等用 =，只是四舍五入的近似值用 ≈
function dispExact(v, s) {
  if (typeof v !== 'number' || !isFinite(v)) return false
  const p = parseFloat(String(s).replace(/,/g, ''))
  if (p === v) return true
  // 0.1+0.2 这类：二进制浮点噪声不是数学近似——先把 v 按 15 位有效数字
  // 抹平噪声，再和显示串比；抹平后还对不上（如 1/3、√2）才是真近似
  return p === parseFloat(v.toPrecision(15))
}
function eqSign(v, s) { return dispExact(v, s === undefined ? formatDisplay(v) : s) ? '=' : '≈' }
function formatDisplay(v) {
  const s = formatPlain(v)
  if (s === '错误' || s === '溢出') return s
  if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) return s
  const neg = s[0] === '-'
  const body = neg ? s.slice(1) : s
  const parts = body.split('.')
  let intPart = parts[0]
  let grouped = ''
  while (intPart.length > 3) {
    grouped = ',' + intPart.slice(-3) + grouped
    intPart = intPart.slice(0, -3)
  }
  grouped = intPart + grouped
  return (neg ? '-' : '') + grouped + (parts[1] ? '.' + parts[1] : '')
}

// ---------- 小数转分数（连分数，最大分母 10000） ----------

function toFraction(v) {
  const c = cleanNum(v)
  if (isNaN(c) || !isFinite(c)) return null
  if (Number.isInteger(c) && Math.abs(c) < 1e15) return { n: c, d: 1 }
  const sign = c < 0 ? -1 : 1
  const x = Math.abs(c)
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1
  let b = x
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b)
    const h = a * h1 + h2, k = a * k1 + k2
    if (k > 10000) break
    h2 = h1; h1 = h; k2 = k1; k1 = k
    if (Math.abs(x - h1 / k1) < 1e-10) return { n: sign * h1, d: k1 }
    const frac = b - a
    if (frac < 1e-12) break
    b = 1 / frac
  }
  // 兜底也必须是真分数（误差 <1e-10）；π≈355/113 这类近似不许冒充精确分数
  if (k1 >= 1 && Math.abs(x - h1 / k1) < 1e-10) return { n: sign * h1, d: k1 }
  return null
}

// ---------- 分数四则（整数分子分母） ----------

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b)
  while (b) { const t = a % b; a = b; b = t }
  return a
}

function reduceFrac(n, d) {
  if (d === 0) return null
  if (d < 0) { n = -n; d = -d }
  if (n === 0) return { n: 0, d: 1 }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

// 返回 {n, d（已约分）, dec, mixed:{w,n,d}|null} 或 {error}
function fracCalc(n1, d1, op, n2, d2) {
  if (![n1, d1, n2, d2].every(Number.isInteger)) return { error: '请输入整数' }
  if (d1 === 0 || d2 === 0) return { error: '分母不能为 0' }
  let n, d
  if (op === '+') { n = n1 * d2 + n2 * d1; d = d1 * d2 }
  else if (op === '-') { n = n1 * d2 - n2 * d1; d = d1 * d2 }
  else if (op === '*') { n = n1 * n2; d = d1 * d2 }
  else if (op === '/') {
    if (n2 === 0) return { error: '不能除以 0 分数' }
    n = n1 * d2; d = d1 * n2
  } else return { error: '未知运算' }
  // 分子分母的中间乘积超出 JS 安全整数后，约分出的「精确分数」会是错的：明确报错
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) return { error: '数字太大，超出精确计算范围' }
  const r = reduceFrac(n, d)
  const dec = r.n / r.d
  let mixed = null
  if (Math.abs(r.n) > r.d && r.d !== 1) {
    const w = Math.trunc(r.n / r.d)
    mixed = { w: w, n: Math.abs(r.n - w * r.d), d: r.d }
  }
  return { n: r.n, d: r.d, dec: dec, mixed: mixed }
}

// ---------- 最大公约数 / 最小公倍数 ----------

function gcdLcm(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return { error: '请输入整数' }
  if (a === 0 && b === 0) return { error: '不能两个都是 0' }
  const g = gcd(a, b)
  if (g === 0) return { gcd: 0, lcm: 0 }
  // 最小公倍数 = |a/g × b|：乘积超出安全整数范围后结果必然失真，明确报错，不给错数
  const prod = (a / g) * b
  if (!Number.isSafeInteger(prod)) return { error: '数字太大，超出精确计算范围' }
  return { gcd: g, lcm: Math.abs(prod) }
}

// ---------- 根号化简 √n = coef·√rad ----------

function simplifySqrt(n) {
  if (!Number.isInteger(n)) return { error: '请输入整数' }
  if (n < 0) return { error: '被开方数不能为负' }
  if (n === 0) return { coef: 0, rad: 1, dec: 0 }
  let coef = 1, rad = n
  for (let k = 2; k * k <= rad; k++) {
    while (rad % (k * k) === 0) { rad /= (k * k); coef *= k }
  }
  return { coef: coef, rad: rad, dec: Math.sqrt(n) }
}

// ---------- 一元一次方程 ax+b = cx+d ----------

function solveLinear(a, b, c, d) {
  const A = a - c, B = d - b
  if (A === 0) return B === 0 ? { type: 'infinite' } : { type: 'none' }
  const x = B / A
  return { type: 'one', x: x, frac: toFraction(x) }
}

// ---------- 一元二次方程 ax²+bx+c=0 ----------

function solveQuad(a, b, c) {
  if (a === 0) {
    if (b === 0) return c === 0 ? { type: 'infinite' } : { type: 'none' }
    const lx = -c / b
    if (!isFinite(lx)) return { error: '数字太大，超出精确计算范围' }
    return { type: 'linear', x: lx }
  }
  const disc = b * b - 4 * a * c
  // 判别式溢出（±Infinity）或 Inf−Inf 成 NaN 时根已不可信：走既有报错口径，
  // 绝不编造根（旧版 eps 同步溢出会误入重根分支，给出 −5e+307 这类假根；1.5.6 实证）
  if (!isFinite(disc)) return { error: '数字太大，超出精确计算范围' }
  // 浮点容差：小数系数时 disc 可能是 ±1e-17 级的假信号，按相对量级判零
  const eps = 1e-12 * Math.max(1, Math.abs(b * b), Math.abs(4 * a * c))
  if (disc > eps) {
    const sq = Math.sqrt(disc)
    if (!isFinite(sq)) return { type: 'two', disc: disc, x1: (-b + sq) / (2 * a), x2: (-b - sq) / (2 * a) }
    // 稳定求根：先算「-b 与 √Δ 同向相加」的那根（不发生灾难性消去），
    // 另一根用韦达定理 x1·x2 = c/a 推出；x1/x2 顺序与旧公式保持一致
    const rA = (-b - (b >= 0 ? sq : -sq)) / (2 * a)
    const rB = c / (a * rA)
    // a 极小时稳定求根也会溢出成 ±Infinity：同样报错，不许把无穷大当根返回
    if (!isFinite(rA) || !isFinite(rB)) return { error: '数字太大，超出精确计算范围' }
    return b >= 0
      ? { type: 'two', disc: disc, x1: rB, x2: rA }
      : { type: 'two', disc: disc, x1: rA, x2: rB }
  }
  if (disc >= -eps) {
    const x = -b / (2 * a)
    if (!isFinite(x)) return { error: '数字太大，超出精确计算范围' }
    return { type: 'one', disc: 0, x: x }
  }
  const re = -b / (2 * a)
  const im = Math.sqrt(-disc) / Math.abs(2 * a)
  if (!isFinite(re) || !isFinite(im)) return { error: '数字太大，超出精确计算范围' }
  return { type: 'complex', disc: disc, re: re, im: im }
}

// ---------- 二元一次方程组 {a1·x+b1·y=c1, a2·x+b2·y=c2} ----------

function solveSystem(a1, b1, c1, a2, b2, c2) {
  const D = a1 * b2 - a2 * b1
  const Dx = c1 * b2 - c2 * b1
  const Dy = a1 * c2 - a2 * c1
  // 浮点容差（同 solveQuad 套路）：小数系数时 D 可能是 1e-17 级的假信号
  //（如 0.1x+0.7y=1 与它的 3 倍式），严格判零会误报唯一解，必须按相对量级判。
  // 阈值必须是纯相对尺度、不能给下限：若按 max(1, …) 兜底，系数整体在 1e-7 级时
  // 真行列式只有 1e-14 级，会被 1e-12 的绝对阈值误判为零，把唯一解误报成
  // 无穷多解（1.5.6 实证修复：{0.0000001x=0.0000001; 0.0000001y=0.0000001}）
  const eD = 1e-12 * Math.max(Math.abs(a1 * b2), Math.abs(a2 * b1))
  const eX = 1e-12 * Math.max(Math.abs(c1 * b2), Math.abs(c2 * b1))
  const eY = 1e-12 * Math.max(Math.abs(a1 * c2), Math.abs(a2 * c1))
  if (Math.abs(D) > eD) {
    const x = Dx / D, y = Dy / D
    return { type: 'one', x: x, y: y, xFrac: toFraction(x), yFrac: toFraction(y) }
  }
  if (Math.abs(Dx) <= eX && Math.abs(Dy) <= eY) {
    // 还要排除「一行全 0 但 c≠0」这类实际无解
    if ((a1 === 0 && b1 === 0 && c1 !== 0) || (a2 === 0 && b2 === 0 && c2 !== 0)) return { type: 'none' }
    return { type: 'infinite' }
  }
  return { type: 'none' }
}

// ---------- 单位换算 ----------
// f = 换算到基准单位的倍率；温度单独处理

const UNIT_CATS = [
  { name: '长度', units: [
    { id: 'mm', name: '毫米', f: 0.001 }, { id: 'cm', name: '厘米', f: 0.01 },
    { id: 'm', name: '米', f: 1 }, { id: 'km', name: '千米', f: 1000 },
    { id: 'in', name: '英寸', f: 0.0254 }, { id: 'ft', name: '英尺', f: 0.3048 }
  ] },
  { name: '重量', units: [
    { id: 'g', name: '克', f: 0.001 }, { id: 'kg', name: '千克', f: 1 },
    { id: 'jin', name: '斤', f: 0.5 }, { id: 't', name: '吨', f: 1000 },
    { id: 'lb', name: '磅', f: 0.45359237 }
  ] },
  { name: '面积', units: [
    { id: 'm2', name: '平方米', f: 1 }, { id: 'ha', name: '公顷', f: 10000 },
    { id: 'mu', name: '亩', f: 10000 / 15 }, { id: 'km2', name: '平方千米', f: 1000000 },
    { id: 'ft2', name: '平方英尺', f: 0.09290304 }
  ] },
  { name: '温度', units: [
    { id: 'c', name: '摄氏度 °C' }, { id: 'f', name: '华氏度 °F' }, { id: 'k', name: '开尔文 K' }
  ] },
  { name: '时间', units: [
    { id: 's', name: '秒', f: 1 }, { id: 'min', name: '分钟', f: 60 },
    { id: 'h', name: '小时', f: 3600 }, { id: 'day', name: '天', f: 86400 },
    { id: 'wk', name: '周', f: 604800 }
  ] },
  { name: '数据', units: [
    { id: 'b', name: '字节 B', f: 1 }, { id: 'kb', name: 'KB', f: 1024 },
    { id: 'mb', name: 'MB', f: 1048576 }, { id: 'gb', name: 'GB', f: 1073741824 },
    { id: 'tb', name: 'TB', f: 1099511627776 }
  ] }
]

function convertUnit(catIdx, fromId, toId, val) {
  const cat = UNIT_CATS[catIdx]
  if (!cat) return NaN
  if (cat.name === '温度') {
    let c
    if (fromId === 'c') c = val
    else if (fromId === 'f') c = (val - 32) * 5 / 9
    else c = val - 273.15
    if (toId === 'c') return c
    if (toId === 'f') return c * 9 / 5 + 32
    return c + 273.15
  }
  let from = null, to = null
  for (const u of cat.units) {
    if (u.id === fromId) from = u
    if (u.id === toId) to = u
  }
  if (!from || !to) return NaN
  return val * from.f / to.f
}

// ---------- 进制转换（整数，上限 2^53-1，JS 整数精确范围） ----------

function baseConvert(str, fromBase) {
  const s = String(str).trim().toUpperCase()
  if (!s) return null
  const digits = '0123456789ABCDEF'
  for (const ch of s) {
    const d = digits.indexOf(ch)
    if (d < 0 || d >= fromBase) return { error: '含超出进制的数字' }
  }
  const v = parseInt(s, fromBase)
  if (isNaN(v)) return { error: '无法解析' }
  if (v > 9007199254740991) return { error: '数值太大（上限 2⁵³−1）' }
  return {
    bin: v.toString(2), oct: v.toString(8),
    dec: v.toString(10), hex: v.toString(16).toUpperCase()
  }
}

export default {
  eqSign: eqSign,
  evaluate: evaluate,
  cleanNum: cleanNum,
  formatPlain: formatPlain,
  formatDisplay: formatDisplay,
  toFraction: toFraction,
  fracCalc: fracCalc,
  gcdLcm: gcdLcm,
  simplifySqrt: simplifySqrt,
  solveLinear: solveLinear,
  solveQuad: solveQuad,
  solveSystem: solveSystem,
  UNIT_CATS: UNIT_CATS,
  convertUnit: convertUnit,
  baseConvert: baseConvert
}
