

// 计算引擎：求值/分数/根式/科学计数（课本式 ×10 上标，全应用禁 e 记法）。
// 体积红线见 index.ux 顶部注（与页面脚本合计 ≤190KB）；长篇说明见 BUGLOG.md。
const FUNC_NAMES = ['sin', 'cos', 'tan', 'log', 'ln', 'abs', 'sqrt']

const SUP_DIGITS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const SUP_TO_DIGIT = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
const SUP_SET = '⁰¹²³⁴⁵⁶⁷⁸⁹'

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
      let ePart = false
      if (s[j] === 'e' && j + 1 < s.length && /[0-9+\-]/.test(s[j + 1])) {
        let k = j + 1
        if (s[k] === '+' || s[k] === '-') k++
        if (k < s.length && s[k] >= '0' && s[k] <= '9') {
          while (k < s.length && s[k] >= '0' && s[k] <= '9') k++
          j = k
          ePart = true
        }
      }
      let foldExp = null
      let foldEnd = j
      if (!ePart && s[j] === '*' && s[j + 1] === '1' && s[j + 2] === '0') {
        let k = j + 3
        let neg = false
        if (s[k] === '⁻') { neg = true; k++ }
        const d0 = k
        while (k < s.length && SUP_SET.indexOf(s[k]) >= 0) k++
        if (k > d0) {
          const run = s.slice(d0, k)
          let machine = neg
          for (const c of run) if (c !== '²') machine = true
          const singleSq = run === '²' && !(k < s.length && '!%°^²'.indexOf(s[k]) >= 0)
          if (machine || singleSq) {
            foldExp = (neg ? '-' : '') + run.split('').map((c) => SUP_TO_DIGIT[c]).join('')
            foldEnd = k
          }
        }
      }
      const lit = foldExp !== null ? s.slice(i, j) + 'e' + foldExp : s.slice(i, j)
      if (foldExp !== null) j = foldEnd
      const v = parseFloat(lit)
      if (isNaN(v)) throw new Error('bad number')
      const digs = intDigitsOf(lit)
      if (digs !== null) {
        if (digs.length >= 16) {
          if (!isFinite(v)) throw new Error('overflow')
          let inexact
          if (typeof BigInt === 'function') inexact = BigInt(digs) !== BigInt(v)
          else inexact = digs.length <= 21 ? v.toFixed(0) !== digs : true
          if (inexact) throw new Error('precision')
        }
      }
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

function intDigitsOf(lit) {
  const m = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(lit)
  if (!m) return null
  if (!m[1] && !m[2]) return null
  const exp = m[3] ? parseInt(m[3], 10) : 0
  if (exp > 400 || exp < -400) return null
  const raw = m[1] + (m[2] || '')
  if (/^0+$/.test(raw)) return '0'
  const pointPos = m[1].length + exp
  if (pointPos <= 0) return null // 0.00…x 纯小数
  let digs
  if (pointPos >= raw.length) digs = raw + '0'.repeat(pointPos - raw.length)
  else {
    if (!/^0*$/.test(raw.slice(pointPos))) return null // 移位后仍带小数
    digs = raw.slice(0, pointPos)
  }
  digs = digs.replace(/^0+/, '')
  if (m[3] !== undefined && digs.length > 21) return null
  return digs || '0'
}

function twoSumErr(a, b) {
  const s = a + b
  const bb = s - a
  return (a - (s - bb)) + (b - bb)
}
function twoProdErr(a, b) {
  const p = a * b
  const SP = 134217729
  const ca = SP * a, ah = ca - (ca - a), al = a - ah
  const cb = SP * b, bh = cb - (cb - b), bl = b - bh
  return ((ah * bh - p) + ah * bl + al * bh) + al * bl
}

function fact(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error('fact domain')
  if (n > 170) throw new Error('overflow')
  let r = 1
  for (let k = 2; k <= n; k++) {
    const p = r * k
    if (!isFinite(p)) throw new Error('overflow')
    // 23! 起中间乘积不再精确表示：与 ^、× 路径一致，≥1e21 的结果给约数（显示
    // 层按 ≈ 标出），不再抛 precision；<1e21 仍严守精确（该段实际全精确）。
    if (twoProdErr(r, k) !== 0 && Math.abs(p) < 1e21) throw new Error('precision')
    r = p
  }
  return r
}

function applyFn(name, x, deg, isRad) {
  const useDeg = deg && !isRad
  if (name === 'sin') return Math.sin(useDeg ? (x % 360) * Math.PI / 180 : x)
  if (name === 'cos') return Math.cos(useDeg ? (x % 360) * Math.PI / 180 : x)
  if (name === 'tan') {
    if (useDeg && ((x % 180) + 180) % 180 === 90) throw new Error('undefined')
    const rad = useDeg ? (x % 360) * Math.PI / 180 : x
    const q = rad / (Math.PI / 2)
    const k = Math.round(q)
    if (Math.abs(q - k) < 1e-13 && Math.abs(k % 2) === 1) throw new Error('undefined')
    return Math.tan(rad)
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
  let intTaint = 0
  function peek() { return pos < toks.length ? toks[pos] : null }
  function next() { return toks[pos++] }

  function parseAtom() {
    const tk = next()
    if (!tk) throw new Error('unexpected end')
    if (tk.t === 'num') return { v: tk.v, rad: false, dirty: false }
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
      return { v: applyFn(tk.v, arg.v, deg, arg.rad), rad: false, dirty: tk.v === 'abs' ? arg.dirty : false }
    }
    throw new Error('unexpected ' + tk.t)
  }
  function parsePostfix(allowPct) {
    const base = parseAtom()
    let v = base.v
    let rad = base.rad
    let pctRaw = null
    let nPost = 0
    while (peek() && ((allowPct !== false && peek().t === '%') || peek().t === '²' || peek().t === '!' || peek().t === '°')) {
      const op = next().t
      nPost++
      if (op === '%') { if (pctRaw === null && nPost === 1) pctRaw = v; else pctRaw = null; v = v / 100 }
      else if (op === '²') {
        pctRaw = null
        if (Number.isInteger(v) && Math.abs(v) <= 1e150 && isFinite(v * v) && twoProdErr(v, v) !== 0) {
          if (Math.abs(v * v) < 1e21) throw new Error('precision')
          intTaint++
        }
        v = v * v
      }
      else if (op === '!') { pctRaw = null; v = fact(v) }
      else if (op === '°') { pctRaw = null; v = (v % 360) * Math.PI / 180; rad = true }
    }
    return { v: v, pctRaw: pctRaw, rad: rad, dirty: base.dirty, nPost: nPost }
  }
  function parsePower(allowPct) {
    const tk = peek()
    if (tk && (tk.t === '-' || tk.t === '+')) {
      next()
      const f = parsePower(allowPct)
      return { v: tk.t === '-' ? -f.v : f.v, pctRaw: null, rad: f.rad, dirty: f.dirty }
    }
    const tB = intTaint
    const base = parsePostfix(allowPct)
    const baseClean = intTaint === tB
    if (peek() && peek().t === '^') {
      next()
      const tE = intTaint
      const exp = parsePower(false)
      const expClean = intTaint === tE
      let v = Math.pow(base.v, exp.v)
      if (isNaN(v)) {
        // 负底分数指数：奇次分母有实数根（(-8)^(1/3) = −2，初中教材口径）；
        // 指数先由 toFraction 还原为最简分数（1/3 存为 0.333…也能还原）。
        if (base.v < 0) {
          const fr = toFraction(exp.v)
          if (fr && fr.d % 2 === 1) {
            const cand = (fr.n % 2 !== 0 ? -1 : 1) * Math.pow(Math.abs(base.v), fr.n / fr.d)
            if (isFinite(cand)) v = cand
          }
        }
        if (isNaN(v)) throw new Error('domain')
      }
      // 溢出不抛错：引擎对溢出返回 Infinity、页面显示「溢出」为既定口径
      // （L1：1e999999999 → Infinity；1.5.18 7d/7e 钉死）。只有 0 的负次幂
      // 是除零（1/0 的另一种写法），须抛 div0 而非当作溢出。
      if (!isFinite(v) && base.v === 0 && exp.v < 0) throw new Error('div0')
      if (Number.isInteger(base.v) && Number.isInteger(exp.v) && exp.v >= 0 && Number.isInteger(v) && Math.abs(v) > 9007199254740991) {
        let bad = true
        if (typeof BigInt === 'function') { try { bad = BigInt(base.v) ** BigInt(exp.v) !== BigInt(v) } catch (e) { bad = false } }
        if (bad) {
          if (Math.abs(v) < 1e21) throw new Error('precision')
          intTaint++
        }
      }
      if (v === 1 && ((exp.v === 0 && expClean) || (base.v === 1 && baseClean))) intTaint = tB
      else if (v === 0 && base.v === 0 && baseClean) intTaint = tB
      // % 绑在幂之后、不是指数上：10^2% = (10^2)% = 1（卡西欧口径）。
      // 指数位置不吃 %（parsePower(false)），% 漏到这里由幂结果承接。
      let pctRaw = null
      if (allowPct !== false && peek() && peek().t === '%') {
        next()
        const pctVal = v
        v = v / 100
        if (base.nPost === 0) pctRaw = pctVal
      }
      return { v: v, pctRaw: pctRaw, rad: base.rad || exp.rad, dirty: base.dirty || exp.dirty }
    }
    return base
  }
  function parseTerm() {
    const t0 = intTaint
    let left = parsePower()
    let ldirty = left.dirty
    let single = true
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = next().t
      const leftClean = intTaint === t0 // 累积值在本项内没沾新污染（0 才可信）
      const tR = intTaint
      const right = parsePower()
      const rightClean = intTaint === tR
      single = false
      if (op === '*') {
        if (Number.isInteger(left.v) && Number.isInteger(right.v)) {
          const p = left.v * right.v
          if (isFinite(p) && Math.abs(left.v) <= 1e150 && Math.abs(right.v) <= 1e150 && twoProdErr(left.v, right.v) !== 0) {
            if (Math.abs(p) < 1e21) throw new Error('precision')
            intTaint++
          }
          left = { v: p, pctRaw: null, rad: left.rad || right.rad }
        } else {
          const p = left.v * right.v
          const bigI = Math.max(Number.isInteger(left.v) ? Math.abs(left.v) : 0, Number.isInteger(right.v) ? Math.abs(right.v) : 0)
          if (isFinite(p) && p !== 0 && Math.abs(left.v) <= 1e150 && Math.abs(right.v) <= 1e150 &&
            bigI > 9007199254740991 && Math.abs(p) >= bigI * 1e-6 &&
            twoProdErr(left.v, right.v) !== 0) intTaint++
          left = { v: p, pctRaw: null, rad: left.rad || right.rad }
        }
        if (left.v === 0 && ((right.v === 0 && rightClean) || leftClean)) intTaint = t0
      }
      else {
        if (right.v === 0) throw new Error('div0')
        let qv = left.v / right.v
        if (Number.isInteger(left.v) && Number.isInteger(right.v) && Number.isInteger(qv) && Math.abs(qv) <= 1e150 && Math.abs(right.v) <= 1e150 && (twoProdErr(qv, right.v) !== 0 || qv * right.v !== left.v)) {
          if (Math.abs(qv) < 1e21) throw new Error('precision')
          intTaint++
        }
        const bigD = Math.max(Number.isInteger(left.v) ? Math.abs(left.v) : 0, Number.isInteger(right.v) ? Math.abs(right.v) : 0)
        if (!(Number.isInteger(left.v) && Number.isInteger(right.v) && Number.isInteger(qv)) &&
          isFinite(qv) && qv !== 0 && Math.abs(qv) <= 1e150 && Math.abs(right.v) <= 1e150 &&
          bigD > 9007199254740991 && Math.abs(qv) >= bigD * 1e-6 &&
          (twoProdErr(qv, right.v) !== 0 || qv * right.v !== left.v)) intTaint++
        if (qv === 0 && leftClean) intTaint = t0 // 被除数确为 0 时商恒 0，同理清本项污染
        left = { v: qv, pctRaw: null, rad: left.rad || right.rad }
      }
      ldirty = ldirty || right.dirty
      left.dirty = ldirty
    }
    return { v: left.v, pctRaw: single ? left.pctRaw : null, rad: left.rad, dirty: ldirty }
  }
  function parseExprW() {
    let left = parseTerm()
    let lv = left.v
    let lrad = left.rad
    let ldirty = left.dirty
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = next().t
      const right = parseTerm()
      let rv = right.v
      const rdirty = right.dirty
      if (right.pctRaw !== null) rv = lv * right.pctRaw / 100
      if (Number.isInteger(lv) && Number.isInteger(rv)) {
        const s = op === '+' ? lv + rv : lv - rv
        const errI = twoSumErr(lv, op === '+' ? rv : -rv)
        if (isFinite(s) && errI !== 0) {
          if (Math.abs(s) < 1e21) throw new Error('precision')
          intTaint++
        }
        ldirty = ldirty || rdirty || errI !== 0
        lv = s
      } else {
        const s = op === '+' ? lv + rv : lv - rv
        const errS = twoSumErr(lv, op === '+' ? rv : -rv)
        const bigI = Math.max(Number.isInteger(lv) ? Math.abs(lv) : 0, Number.isInteger(rv) ? Math.abs(rv) : 0)
        if (isFinite(s) && bigI > 9007199254740991 && Math.abs(s) >= bigI * 1e-6 &&
          errS !== 0) intTaint++
        const stepDirty = errS !== 0 || ldirty || rdirty
        lv = (stepDirty && s !== 0 && Math.abs(s) <= Math.max(Math.abs(lv), Math.abs(rv)) * Math.pow(2, -50)) ? 0 : s
        ldirty = stepDirty
      }
      lrad = lrad || right.rad
    }
    return { v: lv, rad: lrad, dirty: ldirty }
  }
  const out = parseExprW().v
  if (pos !== toks.length) throw new Error('trailing')
  if (typeof out !== 'number' || isNaN(out)) throw new Error('nan')
  if (intTaint > 0 && Math.abs(out) < 1e21 && dispExact(out, formatDisplay(out))) throw new Error('precision')
  return out
}

function cleanNum(v) {
  if (typeof v !== 'number' || isNaN(v)) return NaN
  if (!isFinite(v)) return v
  if (v === 0) return 0
  if (Number.isInteger(v)) return v
  // 精确短小数不动：最短十进制写法 ≤15 位有效数字的值就是 double 本身的
  // 精确值（如 1234567890123.5），不应被 12 位截断改写；只有 16 位以上
  // （二进制尘或 1/3 这类循环小数）才走 12 位归整。整数分支在上，已先行。
  const sv = String(v)
  const digs = sv.replace(/^[+-]/, '').replace(/e[+-]?\d+$/i, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
  if (digs.length <= 15) return v
  const r12 = parseFloat(v.toPrecision(12))
  if (Math.abs(v) < 1e-15) return (r12 === v || Math.abs(r12 - v) <= 1e-13 * Math.abs(v)) ? r12 : 0
  return r12
}

function formatPlain(v) {
  const c = cleanNum(v)
  if (isNaN(c)) return '错误'
  if (!isFinite(c)) return '溢出'
  return String(c)
}

function sciStr(s) {
  const m = /^([\-−]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(String(s))
  if (!m) return String(s)
  const frac = (m[3] || '').replace(/0+$/, '')
  const exp = parseInt(m[4], 10)
  const sup = (exp < 0 ? '⁻' : '') + String(Math.abs(exp)).split('').map((c) => SUP_DIGITS[c]).join('')
  return m[1] + m[2] + (frac ? '.' + frac : '') + '×10' + sup
}

function sciToPlain(s) {
  return String(s).replace(/×10(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function (w, neg, run) {
    return 'e' + (neg ? '-' : '') + run.split('').map((c) => SUP_TO_DIGIT[c]).join('')
  })
}

function dispExact(v, s) {
  if (typeof v !== 'number' || !isFinite(v)) return false
  const p = parseFloat(sciToPlain(String(s)).replace(/,/g, '').replace(/−/g, '-'))
  if (p === v) return true
  return p === parseFloat(v.toPrecision(15))
}
function eqSign(v, s) { return dispExact(v, s === undefined ? formatDisplay(v) : s) ? '=' : '≈' }
function dispMinus(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '-' && !(i > 0 && (s[i - 1] === 'e' || s[i - 1] === 'E'))) out += '−'
    else out += ch
  }
  return out
}

function isTinyQuotient(v) {
  for (let k = 2; k <= 99; k++) {
    const w = v * k
    if (w === 0 || !isFinite(w)) continue
    const w12 = parseFloat(w.toPrecision(12))
    // 2026-11-15 自查 F7：真商 1e-15÷8.1 的 v×81 与 1e-14 只差约 1 ulp，
    // 旧的精确相等判别（w12 === w）被双精度乘法噪声顶掉。改放宽到 4 ulp：
    // sin/cos 尾巴与 √2×10⁻¹⁷ 这类随机尾数离干净值差 1e-12 量级（约百万 ulp），
    // 仍进不来；随机扫掠 20000 个 [1e-17,1e-15) 双精度值零误放（见 BUGLOG）。
    // 注意 1e-16×1.2345678901234567 这类真积不在此列：它与 1e-14/81 在第 9 位
    // 就不同（相对差 9e-9），与尾巴无法区分，按 1.4.17 定版仍归零，不救。
    if (Math.abs(w12 - w) > 4 * Number.EPSILON * Math.abs(w)) continue
    if (Math.abs(w12 / k - v) > 4 * Number.EPSILON * Math.abs(v)) continue
    const digs = Math.abs(w12).toPrecision(12).replace(/e.*$/, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
    if (digs.length <= 3) return true
  }
  return false
}

function isShortMantissa(v) {
  let x = Math.abs(v)
  if (x === 0 || !isFinite(x)) return false
  while (x >= 2) x /= 2
  while (x < 1) x *= 2
  let m = Math.round(x * Math.pow(2, 52))
  while (m % 2 === 0) m /= 2
  return m < 256
}

function formatDisplay(v) {
  const s = formatPlain(v)
  if (s === '错误' || s === '溢出') return s
  if (s === '0' && v !== 0 && isFinite(v) && isTinyQuotient(v)) return dispMinus(sciStr(String(parseFloat(v.toPrecision(12)))))
  if (s === '0' && v !== 0 && isFinite(v) && isShortMantissa(v)) return dispMinus(sciStr(String(parseFloat(v.toPrecision(12)))))
  if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) return dispMinus(sciStr(s))
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
  return dispMinus((neg ? '-' : '') + grouped + (parts[1] ? '.' + parts[1] : ''))
}

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
  if (k1 >= 1 && Math.abs(x - h1 / k1) < 1e-10) return { n: sign * h1, d: k1 }
  return null
}

function fracIsExact(v, fr) {
  if (!fr) return false
  if (fr.d === 1) return fr.n === v
  // 2026-11-15 自查 F3：先做精确双精度比较——2469135780247/2 在 double 下
  // 恰等于 1234567890123.5，旧的 12 位判定把它误标 ≈。旧判定保留作或支，
  // 兜底 0.1+0.2→3/10 这类“显示值即分数”的既定口径（1.5.12 钉死）。
  if (fr.n / fr.d === v) return true
  return parseFloat((fr.n / fr.d).toPrecision(12)) === cleanNum(v)
}

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

function fracCalc(n1, d1, op, n2, d2) {
  if (![n1, d1, n2, d2].every(Number.isInteger)) return { error: '请输入整数' }
  if (![n1, d1, n2, d2].every(Number.isSafeInteger)) return { error: '数字太大，超出精确计算范围' }
  if (d1 === 0 || d2 === 0) return { error: '分母不能为 0' }
  const q1 = reduceFrac(n1, d1), q2 = reduceFrac(n2, d2)
  n1 = q1.n; d1 = q1.d; n2 = q2.n; d2 = q2.d
  let n, d
  if (op === '+' || op === '-') {
    const g = gcd(d1, d2) || 1
    const l1 = d1 / g, l2 = d2 / g
    n = op === '+' ? n1 * l2 + n2 * l1 : n1 * l2 - n2 * l1
    d = l1 * d2
  } else if (op === '*') {
    const g1 = gcd(n1, d2) || 1
    const g2 = gcd(n2, d1) || 1
    n = (n1 / g1) * (n2 / g2); d = (d1 / g2) * (d2 / g1)
  } else if (op === '/') {
    if (n2 === 0) return { error: '不能除以 0 分数' }
    const g1 = gcd(n1, n2) || 1
    const g2 = gcd(d2, d1) || 1
    n = (n1 / g1) * (d2 / g2); d = (d1 / g2) * (n2 / g1)
  } else return { error: '未知运算' }
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

function gcdLcm(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return { error: '请输入整数' }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return { error: '数字太大，超出精确计算范围' }
  if (a === 0 && b === 0) return { error: '不能两个都是 0' }
  const g = gcd(a, b)
  if (g === 0) return { gcd: 0, lcm: 0 }
  const prod = (a / g) * b
  if (!Number.isSafeInteger(prod)) return { error: '数字太大，超出精确计算范围' }
  return { gcd: g, lcm: Math.abs(prod) }
}

function simplifySqrt(n) {
  if (!Number.isInteger(n)) return { error: '请输入整数' }
  if (!Number.isSafeInteger(n)) return { error: '数字太大，超出精确计算范围' }
  if (n < 0) return { error: '被开方数不能为负' }
  if (n === 0) return { coef: 0, rad: 1, dec: 0 }
  if (n > 1e12) return { error: '数字太大，超出精确计算范围' }
  let coef = 1, rad = n
  for (let k = 2; k * k <= rad; k++) {
    while (rad % (k * k) === 0) { rad /= (k * k); coef *= k }
  }
  return { coef: coef, rad: rad, dec: Math.sqrt(n) }
}

const DD_SPLITTER = 134217729 // 2^27 + 1，Dekker 分裂常数
function ddProd(a, b) { // [hi, lo]：hi = fl(a·b)，hi + lo = a·b（精确）
  const p = a * b
  const ta = DD_SPLITTER * a, ah = ta - (ta - a), al = a - ah
  const tb = DD_SPLITTER * b, bh = tb - (tb - b), bl = b - bh
  const e = ((ah * bh - p) + ah * bl + al * bh) + al * bl
  return [p, e]
}
function ddSum(a, b) { // [s, e]：s = fl(a+b)，s + e = a + b（精确，Knuth TwoSum）
  const s = a + b
  const bb = s - a
  const e = (a - (s - bb)) + (b - bb)
  return [s, e]
}
function det2ddPair(p, q, r, s, k2) {
  const pr1 = ddProd(p, q), pr2 = ddProd(r, s)
  const d = ddSum(pr1[0], -k2 * pr2[0])
  const lo = (pr1[1] - k2 * pr2[1]) + d[1]
  return ddSum(d[0], lo)
}
function det2dd(p, q, r, s, k2) { return det2ddPair(p, q, r, s, k2)[0] }
function ddPairSign(pair) {
  if (pair[0] !== 0) return pair[0] > 0 ? 1 : -1
  if (pair[1] !== 0) return pair[1] > 0 ? 1 : -1
  return 0
}
function bigDisc(a, b, c) {
  if (typeof BigInt !== 'function') return null
  try {
    const A = BigInt(a), B = BigInt(b), C = BigInt(c)
    return B * B - BigInt(4) * A * C
  } catch (e) { return null }
}
function bigDets(a1, b1, c1, a2, b2, c2) {
  if (typeof BigInt !== 'function') return null
  try {
    const A1 = BigInt(a1), B1 = BigInt(b1), C1 = BigInt(c1)
    const A2 = BigInt(a2), B2 = BigInt(b2), C2 = BigInt(c2)
    return [A1 * B2 - A2 * B1, C1 * B2 - C2 * B1, A1 * C2 - A2 * C1]
  } catch (e) { return null }
}
function isIntVal(v) { return Number.isInteger(v) }

function decScaleOf(v) { // 双精度 → { s: 整数（≤15 位）, k: 小数位 } 或 null
  const mm = /^-?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(v))
  if (!mm) return null
  let digits = (mm[1] + (mm[2] || '')).replace(/^0+/, '')
  if (digits === '') return { s: 0, k: 0 }
  let k = (mm[2] || '').length - (mm[3] ? parseInt(mm[3], 10) : 0)
  if (k < 0) {
    if (digits.length - k > 15) return null
    digits = digits + '0'.repeat(-k)
    k = 0
  }
  if (digits.length > 15) return null
  return { s: Number(digits), k: k }
}
function factorExps(n) { // n ≤ 1e12 的素因数指数表（试除，同 simplifySqrt 口径）
  const map = new Map()
  let rad = n
  for (let k = 2; k * k <= rad; k++) {
    while (rad % k === 0) { map.set(k, (map.get(k) || 0) + 1); rad /= k }
  }
  if (rad > 1) map.set(rad, (map.get(rad) || 0) + 1)
  return map
}
function triArea(a, b, c) {
  if (!isFinite(a) || !isFinite(b) || !isFinite(c) || a <= 0 || b <= 0 || c <= 0) return { error: '请输入有效边长' }
  const srt = [a, b, c].sort(function (p, q) { return q - p })
  const x = srt[0], y = srt[1], z = srt[2]
  const decs = [a, b, c].map(decScaleOf)
  let S = null, K = 0
  if (decs.every(function (d) { return d !== null })) {
    K = Math.max(decs[0].k, decs[1].k, decs[2].k)
    const cand = decs.map(function (d) { return d.s * Math.pow(10, K - d.k) })
    if (cand.every(function (v) { return v <= 9007199254740991 / 4 })) S = cand.sort(function (p, q) { return q - p })
  }
  if (S !== null) {
    if (S[1] + S[2] < S[0]) return { error: '不能构成三角形' }
    if (S[1] + S[2] === S[0]) return { type: 'degenerate', area: 0 }
  } else {
    if (y + z < x) return { error: '不能构成三角形' }
    if (y + z === x) return { type: 'degenerate', area: 0 }
  }
  // 数值面积：先按最大边归一化再算（Heron 中间量 (x+(y+z))·… 在边长
  // 1e100 时达 1e400 溢出，属中间量溢出而非结果溢出），最后乘回 x²。
  const ux = y / x, uz = z / x
  const areaUnit = 0.25 * Math.sqrt((1 + (ux + uz)) * (uz - (1 - ux)) * (uz + (1 - ux)) * (1 + (ux - uz)))
  const area = areaUnit * x * x
  if (!isFinite(area)) return { error: '数字太大，超出精确计算范围' }
  let exact = null
  if (S !== null) {
    const F = [S[0] + S[1] + S[2], S[1] + S[2] - S[0], S[0] - S[1] + S[2], S[0] + S[1] - S[2]]
    if (F.every(function (v) { return v <= 1e12 })) {
      const merged = new Map()
      for (const f of F) for (const ent of factorExps(f)) merged.set(ent[0], (merged.get(ent[0]) || 0) + ent[1])
      if (typeof BigInt === 'function') {
        let coefB = BigInt(1), radB = BigInt(1)
        for (const ent of merged) {
          if (ent[1] % 2 === 1) radB *= BigInt(ent[0])
          if (ent[1] >= 2) coefB *= BigInt(ent[0]) ** BigInt(ent[1] >> 1)
        }
        let cnB = coefB, cdB = BigInt(4) * (BigInt(10) ** BigInt(2 * K))
        let g = cnB, h = cdB
        while (h !== BigInt(0)) { const t = g % h; g = h; h = t }
        cnB /= g; cdB /= g
        const toSafeNum = function (v) {
          if (v > (BigInt(10) ** BigInt(21))) return null
          const n = Number(v)
          try { return BigInt(n) === v ? n : null } catch (e) { return null }
        }
        const cnN = toSafeNum(cnB), cdN = toSafeNum(cdB), radN = toSafeNum(radB)
        if (cnN !== null && cdN !== null && radN !== null) exact = { cn: cnN, cd: cdN, rad: radN }
      } else {
        // 运行时无 BigInt（如手环 QuickJS）：纯 Number 路径，任一中间量超安全整数即放弃精确形
        let coefN = 1, radN = 1, okN = true
        for (const ent of merged) {
          if (ent[1] % 2 === 1) { radN *= ent[0]; if (radN > 9007199254740991) okN = false }
          if (ent[1] >= 2) { coefN *= Math.pow(ent[0], ent[1] >> 1); if (coefN > 9007199254740991) okN = false }
        }
        let cdN = 4 * Math.pow(10, 2 * K)
        if (cdN > 9007199254740991) okN = false
        if (okN) {
          let cnN = coefN
          let g = cnN, h = cdN
          while (h !== 0) { const t = g % h; g = h; h = t }
          cnN /= g; cdN /= g
          if (Number.isSafeInteger(cnN) && Number.isSafeInteger(cdN) && Number.isSafeInteger(radN)) exact = { cn: cnN, cd: cdN, rad: radN }
        }
      }
    }
  }
  return { type: 'ok', area: area, exact: exact }
}

function solveLinear(a, b, c, d) {
  if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) return { error: '数字太大，超出精确计算范围' }
  let A = a - c, B = d - b
  if (!isFinite(A) || !isFinite(B)) {
    const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d))
    A = a / m - c / m
    B = d / m - b / m
    if (!isFinite(A) || !isFinite(B)) return { error: '数字太大，超出精确计算范围' }
  }
  if (A === 0) return B === 0 ? { type: 'infinite' } : { type: 'none' }
  const x = B / A
  if (!isFinite(x)) return { error: '数字太大，超出精确计算范围' }
  return { type: 'one', x: x, frac: toFraction(x) }
}

function solveQuad(a, b, c) {
  if (a === 0) {
    if (b === 0) return c === 0 ? { type: 'infinite' } : { type: 'none' }
    const lx = -c / b
    if (!isFinite(lx)) return { error: '数字太大，超出精确计算范围' }
    return { type: 'linear', x: lx }
  }
  if (!isFinite(a) || !isFinite(b) || !isFinite(c)) return { error: '数字太大，超出精确计算范围' }
  const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c))
  const scaled = m > 1e100 || m < 1e-100
  const a1 = scaled ? a / m : a
  const b1 = scaled ? b / m : b
  const c1 = scaled ? c / m : c
  const bigD = (isIntVal(a) && isIntVal(b) && isIntVal(c)) ? bigDisc(a, b, c) : null
  let discN, discOut, exactCls = null
  // 2026-11-15 第十六轮复审：缩放分支里 discOut 还原失败（真 Δ 溢出
  // 双精度）时只能回落归一化值，页面若照 disc 显示会把 Δ = 4e400 标
  // 成「Δ = 4」。此时另给 discStr（真 Δ 的课本式字符串）供页面优先
  // 显示；discApprox 标记它是否为近似（真 Δ 位数 ≤12 时是精确整数串）。
  let discStr = null, discApprox = false
  const supOf = function (e) { return (e < 0 ? '⁻' : '') + String(Math.abs(e)).split('').map(function (ch) { return SUP_DIGITS[ch] }).join('') }
  if (bigD !== null) {
    exactCls = bigD > BigInt(0) ? 1 : bigD < BigInt(0) ? -1 : 0
    if (!scaled) {
      discN = Number(bigD)
      discOut = discN
    } else {
      const mB = BigInt(m), m2B = mB * mB
      const negD = bigD < BigInt(0), absD = negD ? -bigD : bigD
      const dnD = absD.toString().length, dnM = m2B.toString().length
      const shiftD = 19 - (dnD - dnM)
      const qD = shiftD >= 0 ? (absD * (BigInt(10) ** BigInt(shiftD))) / m2B : absD / (m2B * (BigInt(10) ** BigInt(-shiftD)))
      let vD = Number(qD), eD = -shiftD
      while (eD <= -170) { vD *= 1e-170; eD += 170 }
      if (eD !== 0) vD *= Math.pow(10, eD)
      discN = negD ? -vD : vD
      const restored = (discN * m) * m
      discOut = (isFinite(restored) && restored !== 0) ? restored : discN
      if (discOut === discN && bigD !== BigInt(0)) {
        const digs = absD.toString()
        if (digs.length <= 12) discStr = (negD ? '−' : '') + digs
        else {
          // 尾数与指数同源（log10 法）：尾数取自归一化 Δ、指数由缩放
          // 还原——不能混用 BigInt 精确位数（discN≈1 时会拼出差 10 倍
          // 的串）。尾数四舍五入顶到 10 时进位归一。
          const lg = Math.log10(Math.abs(discN)) + 2 * Math.log10(m)
          let ex = Math.floor(lg)
          let mt = parseFloat(Math.pow(10, lg - ex).toPrecision(12))
          if (mt >= 10) { mt = 1; ex++ }
          discStr = (negD ? '−' : '') + String(mt) + '×10' + supOf(ex)
          discApprox = true
        }
      }
    }
  } else {
    const discPair = det2ddPair(b1, b1, a1, c1, 4)
    // 判别式取 dd 对的 hi+lo（比单 hi 更准；显示的 Δ 值用它）。
    // 分类仍用 1e-14 相对容差（1.5.20 第十四轮复审 N-01 定版「模糊带」）：
    // 纯 dd 符号会把小数输入的表示噪声当真——(1,0.6,0.09) 本是重根
    // −0.3，dd 判别式 −1.33e-17 会误判为无实数根；(1,2,1±1e-15) 这种
    // 15 位小数输入在初高中不存在，regression-1.5.20 §1f 已钉死模糊带
    // 内侧判重根，故不收紧（见 BUGLOG 1.6.0 自查 B3）。
    discN = discPair[0] + discPair[1]
    if (!scaled && isIntVal(a) && isIntVal(b) && isIntVal(c)) exactCls = ddPairSign(discPair)
    const discRaw = b * b - 4 * a * c
    if (!scaled) discOut = discN
    else {
      const rst = (discN * m) * m
      discOut = (isFinite(rst) && rst !== 0) ? rst : ((isFinite(discRaw) && discRaw !== 0) ? discRaw : discN)
      if (discOut === discN && discN !== 0) {
        const lg = Math.log10(Math.abs(discN)) + 2 * Math.log10(m)
        let ex = Math.floor(lg)
        let mt = parseFloat(Math.pow(10, lg - ex).toPrecision(12))
        if (mt >= 10) { mt = 1; ex++ }
        discStr = (discN < 0 ? '−' : '') + String(mt) + '×10' + supOf(ex)
        discApprox = true
      }
    }
  }
  const eps = 1e-14 * Math.max(Math.abs(b1 * b1), Math.abs(4 * a1 * c1))
  const cls = exactCls !== null ? exactCls : (discN > eps ? 1 : discN >= -eps ? 0 : -1)
  if (cls === 1) {
    const sq = Math.sqrt(discN)
    const rA = (-b1 - (b1 >= 0 ? sq : -sq)) / (2 * a1)
    const rB = c1 / (a1 * rA)
    if (!isFinite(rA) || !isFinite(rB)) return { error: '数字太大，超出精确计算范围' }
    // 两根恒按 x1 < x2（教材惯例）：Vieta 避相消算出的是大、小两根，旧版
    // 按 b 的符号原样返回，x²−5x+6 = 0 会写成 x1 = 3、x2 = 2。
    return { type: 'two', disc: discOut, discStr: discStr, discApprox: discApprox, x1: Math.min(rA, rB), x2: Math.max(rA, rB) }
  }
  if (cls === 0) {
    const x = -b1 / (2 * a1)
    if (!isFinite(x)) return { error: '数字太大，超出精确计算范围' }
    return { type: 'one', disc: 0, x: x }
  }
  const re = -b1 / (2 * a1)
  const im = Math.sqrt(-discN) / Math.abs(2 * a1)
  if (!isFinite(re) || !isFinite(im)) return { error: '数字太大，超出精确计算范围' }
  return { type: 'complex', disc: discOut, discStr: discStr, discApprox: discApprox, re: re, im: im }
}

function solveSystem(a1, b1, c1, a2, b2, c2) {
  if (![a1, b1, c1, a2, b2, c2].every(function (v) { return isFinite(v) })) return { error: '数字太大，超出精确计算范围' }
  const m1 = Math.max(Math.abs(a1), Math.abs(b1), Math.abs(c1))
  if (m1 > 1e100 || (m1 > 0 && m1 < 1e-100)) { a1 /= m1; b1 /= m1; c1 /= m1 }
  const m2 = Math.max(Math.abs(a2), Math.abs(b2), Math.abs(c2))
  if (m2 > 1e100 || (m2 > 0 && m2 < 1e-100)) { a2 /= m2; b2 /= m2; c2 /= m2 }
  const bigDs = (isIntVal(a1) && isIntVal(b1) && isIntVal(c1) && isIntVal(a2) && isIntVal(b2) && isIntVal(c2))
    ? bigDets(a1, b1, c1, a2, b2, c2) : null
  if (bigDs !== null) {
    const DB = bigDs[0], DxB = bigDs[1], DyB = bigDs[2]
    if (DB !== BigInt(0)) {
      const x = Number(DxB) / Number(DB), y = Number(DyB) / Number(DB)
      if (!isFinite(x) || !isFinite(y)) return { error: '数字太大，超出精确计算范围' }
      return { type: 'one', x: x, y: y, xFrac: toFraction(x), yFrac: toFraction(y) }
    }
    if (DxB === BigInt(0) && DyB === BigInt(0)) {
      if ((a1 === 0 && b1 === 0 && c1 !== 0) || (a2 === 0 && b2 === 0 && c2 !== 0)) return { type: 'none' }
      return { type: 'infinite' }
    }
    return { type: 'none' }
  }
  const Dp = det2ddPair(a1, b2, a2, b1, 1)
  const Dxp = det2ddPair(c1, b2, c2, b1, 1)
  const Dyp = det2ddPair(a1, c2, a2, c1, 1)
  const D = Dp[0] + Dp[1], Dx = Dxp[0] + Dxp[1], Dy = Dyp[0] + Dyp[1]
  const sysIntPair = (m1 <= 1e100 && !(m1 > 0 && m1 < 1e-100) && m2 <= 1e100 && !(m2 > 0 && m2 < 1e-100))
    && isIntVal(a1) && isIntVal(b1) && isIntVal(c1) && isIntVal(a2) && isIntVal(b2) && isIntVal(c2)
  if (sysIntPair) {
    if (ddPairSign(Dp) !== 0) {
      const x = Dx / D, y = Dy / D
      if (!isFinite(x) || !isFinite(y)) return { error: '数字太大，超出精确计算范围' }
      return { type: 'one', x: x, y: y, xFrac: toFraction(x), yFrac: toFraction(y) }
    }
    if (ddPairSign(Dxp) === 0 && ddPairSign(Dyp) === 0) {
      if ((a1 === 0 && b1 === 0 && c1 !== 0) || (a2 === 0 && b2 === 0 && c2 !== 0)) return { type: 'none' }
      return { type: 'infinite' }
    }
    return { type: 'none' }
  }
  // 非整数系数：仍用 1e-14 相对容差（与 solveQuad 同一「模糊带」口径，
  // 见上；行列式真为 1.11e-15 的 (1,1,2,1,1+1e-15,3) 这类 15 位小数
  // 输入在初高中不存在，收紧会误伤小数平行判定，故不改）。
  const eD = 1e-14 * Math.max(Math.abs(a1 * b2), Math.abs(a2 * b1))
  const eX = 1e-14 * Math.max(Math.abs(c1 * b2), Math.abs(c2 * b1))
  const eY = 1e-14 * Math.max(Math.abs(a1 * c2), Math.abs(a2 * c1))
  if (Math.abs(D) > eD) {
    const x = Dx / D, y = Dy / D
    if (!isFinite(x) || !isFinite(y)) return { error: '数字太大，超出精确计算范围' }
    return { type: 'one', x: x, y: y, xFrac: toFraction(x), yFrac: toFraction(y) }
  }
  if (Math.abs(Dx) <= eX && Math.abs(Dy) <= eY) {
    if ((a1 === 0 && b1 === 0 && c1 !== 0) || (a2 === 0 && b2 === 0 && c2 !== 0)) return { type: 'none' }
    return { type: 'infinite' }
  }
  return { type: 'none' }
}

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
    if (['c', 'f', 'k'].indexOf(fromId) < 0 || ['c', 'f', 'k'].indexOf(toId) < 0) return NaN
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

function baseConvert(str, fromBase) {
  let s = String(str).trim().toUpperCase()
  if (!s) return null
  let neg = false
  if (s[0] === '-') { neg = true; s = s.slice(1) }
  if (!s) return { error: '无法解析' }
  const digits = '0123456789ABCDEF'
  for (const ch of s) {
    const d = digits.indexOf(ch)
    if (d < 0 || d >= fromBase) return { error: '含超出进制的数字' }
  }
  const v = parseInt(s, fromBase)
  if (isNaN(v)) return { error: '无法解析' }
  if (v > 9007199254740991) return { error: '数值太大（上限 2⁵³−1）' }
  const sign = (neg && v !== 0) ? '-' : ''
  return {
    bin: sign + v.toString(2), oct: sign + v.toString(8),
    dec: sign + v.toString(10), hex: sign + v.toString(16).toUpperCase()
  }
}

export default {
  eqSign: eqSign,
  evaluate: evaluate,
  cleanNum: cleanNum,
  formatPlain: formatPlain,
  formatDisplay: formatDisplay,
  sciStr: sciStr,
  sciToPlain: sciToPlain,
  toFraction: toFraction,
  fracIsExact: fracIsExact,
  fracCalc: fracCalc,
  gcdLcm: gcdLcm,
  simplifySqrt: simplifySqrt,
  solveLinear: solveLinear,
  solveQuad: solveQuad,
  solveSystem: solveSystem,
  triArea: triArea,
  UNIT_CATS: UNIT_CATS,
  convertUnit: convertUnit,
  baseConvert: baseConvert
}
