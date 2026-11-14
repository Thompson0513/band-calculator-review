// 手环计算器 · 纯逻辑层（表达式求值 / 分数 / 方程 / 换算 / 进制）
// 与界面无关，可在 Node 里单独测试。

// ---------- 表达式求值 ----------
// 显示字形：× ÷ − ；内部统一映射为 * / -
// 支持：函数 sin cos tan log ln sqrt(√) cbrt(³√) abs、幂 ^、后缀 ² ! °
// % 语义：单值后缀 = /100（如 50% → 0.5）；
//         在 a + b% / a − b% 中按计算器惯例 = a ± a×b%（如 100+10% → 110）
// 三角函数默认角度制（贴合中小学生），opts.deg=false 时为弧度制

const FUNC_NAMES = ['sin', 'cos', 'tan', 'log', 'ln', 'abs']

// 上标指数映射（1.5.17）：课本式科学计数法把指数写成右上角小字（同 x² 的 ²），
// ¹²³ 是带圈数字区的历史码点（U+00B9/B2/B3），其余在上标区（U+2070、U+2074–2079），
// 负号用 U+207B ⁻。码点逐一核对见 tests/regression-1.5.17.mjs 的映射证据节
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
      // 课本式科学计数折叠（1.5.17）：显示层的「尾数×10＋上标指数」文本
      //（单位带回的过程式等）再入算式时，在此折回与 e 记法等值的文字量。
      // 只认机器格式，防与手打式子歧义：指数带 ⁻、或含 ² 以外的上标数字
      //（键盘只有 ² 键、打不出），必为显示层产物；单个 ² 时 a×10² 与手打
      // a×(10²) 恒等、也可折，但其后跟 ! % ° ^ ² 会改变结合时不折（保留
      // 手打语义）。全 ² 的多位指数（如 ²²）与手打连按 ² 不可分，不折
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
      // 纯整数文字量的精确性检查（1.5.10）：9007199254740993 这类整数在解析时已被舍入成
      // 9007199254740992，旧版静默按错数计算。16 位起逐位核对：能精确表示的（如 1e16）放行，
      // 已被舍入的明确报「整数超出精确范围」，不让用户对着错误整数以为精确。
      const digs = intDigitsOf(lit)
      if (digs !== null) {
        if (digs.length >= 16) {
          if (!isFinite(v)) throw new Error('overflow')
          // 核对优先用 BigInt 精确比较：String(v) 是最短回读串，21 位附近会出现「已舍入但回读同串」的盲区
          //（如 9007199254740993e5，真实差 31072 却回读同串）；无 BigInt 的运行时 1.5.13 改用
          // toFixed(0) 的精确十进制展开比对（<1e21 时给出双精度值的全部整数位），盲区关闭；
          // ≥22 位保守报错。
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

// 把数字文字量规整成「意图整数」的十进制数字串（纯整数 / 小数 / e 记法统一处理）：
// 移位后仍是整数的给出数字串（供逐位核对），否则返回 null（不是整数声称，浮点近似属预期，不查）。
// 1.5.14 改按小数点位置统一移位（旧版先按「小数部分无有效数字」过滤再移位）：
// 900719925474099.3e1 移位后恰是整数 9007199254740993，旧版因小数部分含 3 直接
// 放行、静默舍入成 …992（ChatGPT 第十份报告实证）。极端指数（|exp|>400）先挡：
// 1e999999999 旧版在 '0'.repeat(shift) 处构造近 10 亿字符、抛 Invalid string length
//（同报告实证）；这种指数下值必然溢出/下溢，不是整数精确性问题，交回普通求值。
function intDigitsOf(lit) {
  // 整数部分允许为空（1.5.16）：'.9007199254740993e16' 这类小数点开头的科学
  // 计数文字量旧版因正则要求 ^(\d+) 直接返回 null、绕过 ≥16 位核对，静默舍入
  // 成 …992（第十一轮复审实证）；放宽后移位逻辑不变（整数部位数按 0 算）
  const m = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(lit)
  if (!m) return null
  if (!m[1] && !m[2]) return null
  const exp = m[3] ? parseInt(m[3], 10) : 0
  if (exp > 400 || exp < -400) return null
  const raw = m[1] + (m[2] || '')
  if (/^0+$/.test(raw)) return '0'
  // 小数点位置（相对 raw 首位）：整数部位数 + 指数
  const pointPos = m[1].length + exp
  if (pointPos <= 0) return null // 0.00…x 纯小数
  let digs
  if (pointPos >= raw.length) digs = raw + '0'.repeat(pointPos - raw.length)
  else {
    if (!/^0*$/.test(raw.slice(pointPos))) return null // 移位后仍带小数
    digs = raw.slice(0, pointPos)
  }
  digs = digs.replace(/^0+/, '')
  // e 记法豁免只剩一条（1.5.14 口径修订）：总位数远超整数精确范围（如 1e308、
  // 应用自身格式化的 3.69844555555e+34）是数量级记法，不查；≤21 位的整数声称
  // 不分写法一律核对——1.5.11 曾按「有效数字多即近似记法」豁免 9.007…e15 与
  // 1.0000000000000005e16，但它们与 900719925474099.3e1（第十份报告 K 案）的
  // 危害同形：精确值都是 <1e21 的整数、都会被静默换成另一个整数全位显示，
  // 豁免线按位数划才自洽
  if (m[3] !== undefined && digs.length > 21) return null
  return digs || '0'
}

// 两数和的精确误差项（Knuth TwoSum）：非零即 a+b 的双精度结果已被舍入
function twoSumErr(a, b) {
  const s = a + b
  const bb = s - a
  return (a - (s - bb)) + (b - bb)
}
// 两数积的精确误差项（Dekker TwoProduct，劈分常数 2^27+1）：非零即 a*b 已被舍入。
// 调用方须保证 |a|、|b| ≤ 1e150（劈分乘法不溢出）
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
    // 阶乘是精确整数运算：23! 起双精度装不下精确值（23! 与真值差 1572864），
    // 旧版静默给舍入值还当精确整数显示（ChatGPT 第九份报告实证）；逐步用
    // TwoProduct 误差项核对，装不下就明确报「整数超出精确范围」（与 gcdLcm 口径一致）。
    // 22! 及以下每步乘积都可精确表示，不受影响
    if (twoProdErr(r, k) !== 0) throw new Error('precision')
    r *= k
  }
  return r
}

function applyFn(name, x, deg, isRad) {
  const useDeg = deg && !isRad
  // 角度制先 % 360 精确归约再换算（1.5.14）：% 对任意大角度都精确，先乘 π/180
  // 再交给 Math.sin/cos 时大角度的换算误差会吃掉有效位——sin(3600000000000°)
  // 曾给 3.15e-6（真值 0）、sin(9007199254740991°) 给 0.5009（真值 sin31°），
  // ChatGPT 第十份报告实证。归约后小角度路径与旧版逐位一致
  if (name === 'sin') return Math.sin(useDeg ? (x % 360) * Math.PI / 180 : x)
  if (name === 'cos') return Math.cos(useDeg ? (x % 360) * Math.PI / 180 : x)
  if (name === 'tan') {
    // 角度制裸数字先走 % 180 精确检查（任意大角度都精确，如 180000090°；弧度近似检查在大 q 时误差会超容差）
    if (useDeg && ((x % 180) + 180) % 180 === 90) throw new Error('undefined')
    const rad = useDeg ? (x % 360) * Math.PI / 180 : x
    // 奇点判定必须落在最终弧度值上（1.5.9 修）：旧版只查角度制裸数字，
    // 带 ° 的输入（° 后缀先把值换算成弧度、isRad=true，useDeg 恒 false）与弧度制 π/2 都绕过检查，
    // Math.tan(π/2) 返回 1.6e16 级大数被当正常结果显示（ChatGPT 第五份报告实证，我上轮探针漏测 ° 路径）。
    // 判据：rad/(π/2) 距最近奇整数 <1e-12（90°/270°/450°/3π/2 的 q 实测恰为整数，留足余量；
    // 89.9999999999° 的 q 距 1 为 1.1e-12，不误伤合法大值）。
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
  // 整数链污染计数（1.5.14）：中间步骤在 ≥1e21 量级发生整数舍入时不立即报错
  //（该量级本就按浮点惯例显示），只记污染；若最终结果被带回 <1e21 的精确显示区，
  // 在 evaluate 结尾统一结算报错。计数制是为了分辨污染来源：×0、^0 等「结果与
  // 被污染操作数无关」的精确湮灭可凭操作数自身的干净程度清除（见 parseTerm）
  let intTaint = 0
  function peek() { return pos < toks.length ? toks[pos] : null }
  function next() { return toks[pos++] }

  // atom：数字/常数/括号/函数调用，返回 {v, rad, dirty}（rad = 子表达式里出现过 °，值已是弧度；
  // dirty = 误差来源追踪标记（1.5.19）：值在求值链中经历过不精确的加减步，见 parseExprW）
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
      // dirty 传播口径（1.5.20 定版，N-04）：精确运算透传——abs 只取绝对
      // 值、不引入舍入，透传 arg.dirty；旧版统一清零使 abs(0.1+0.2)−0.3 的
      // 残差绕过吸附、与 0.1+0.2−0.3 的结果（0）自相矛盾。超越/近似函数
      //（sin/cos/tan/log/ln/√/立方根等）输出自带舍入、误差来源不可由
      // TwoSum 追踪，维持 dirty=false 按新值处理。括号与一元负号本就透传
      //（见 parseAtom 括号分支与 parseFactor），不在此处
      return { v: applyFn(tk.v, arg.v, deg, arg.rad), rad: false, dirty: tk.v === 'abs' ? arg.dirty : false }
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
      else if (op === '²') {
        pctRaw = null
        // 整数平方精确性守卫（1.5.13，与 × 同口径）：装不下精确值且仍在全位显示
        // 量级（<1e21）时报错，不静默给错整数；≥1e21 只记污染（1.5.14）
        if (Number.isInteger(v) && Math.abs(v) <= 1e150 && isFinite(v * v) && twoProdErr(v, v) !== 0) {
          if (Math.abs(v * v) < 1e21) throw new Error('precision')
          intTaint++
        }
        v = v * v
      }
      else if (op === '!') { pctRaw = null; v = fact(v) }
      // ° 换算前先 % 360 精确归约（1.5.14）：旧版直接乘 π/180，90000090° 的换算
      // 误差让其弧度值偏离 π/2 奇数倍约 1e-9、绕过 tan 的 1e-13 奇点判据，给出
      // 5.8e9 的假值（ChatGPT 第十份报告实证）；归约后 rad 恰为 π/2、判据命中
      else if (op === '°') { pctRaw = null; v = (v % 360) * Math.PI / 180; rad = true }
    }
    return { v: v, pctRaw: pctRaw, rad: rad, dirty: base.dirty }
  }
  // power：一元符号 + ^ （右结合，符号结合力低于 ^：−2^2 = −4）
  function parsePower() {
    const tk = peek()
    if (tk && (tk.t === '-' || tk.t === '+')) {
      next()
      const f = parsePower()
      return { v: tk.t === '-' ? -f.v : f.v, pctRaw: null, rad: f.rad, dirty: f.dirty }
    }
    const tB = intTaint
    const base = parsePostfix()
    const baseClean = intTaint === tB
    if (peek() && peek().t === '^') {
      next()
      const tE = intTaint
      const exp = parsePower()
      const expClean = intTaint === tE
      const v = Math.pow(base.v, exp.v)
      if (isNaN(v)) throw new Error('domain')
      // 整数幂精确性守卫（1.5.13）：结果超出安全整数、又没到科学计数法量级（<1e21）时，
      // 用 BigInt 核对真值（3^40 这类幂本身就算出已舍入的整数）；无 BigInt 保守报错。
      // 2^53、2^54、10^20 等真值可精确表示的照常放行；≥1e21 不立即拦、只记污染（1.5.14）
      if (Number.isInteger(base.v) && Number.isInteger(exp.v) && exp.v >= 0 && Number.isInteger(v) && Math.abs(v) > 9007199254740991) {
        let bad = true
        if (typeof BigInt === 'function') { try { bad = BigInt(base.v) ** BigInt(exp.v) !== BigInt(v) } catch (e) { bad = false } }
        if (bad) {
          if (Math.abs(v) < 1e21) throw new Error('precision')
          intTaint++
        }
      }
      // 精确湮灭（1.5.14）：指数确为 0 时结果恒 1、底数确为 1 时结果恒 1、底数
      // 确为 0 时结果恒 0——结果与另一操作数的污染无关，可清本步内的污染
      //（恢复到 tB，兄弟子式的污染保留）；「确为」以该操作数自身求值期间没
      // 新增污染为准（被污染凑出来的 0/1 不算）
      if (v === 1 && ((exp.v === 0 && expClean) || (base.v === 1 && baseClean))) intTaint = tB
      else if (v === 0 && base.v === 0 && baseClean) intTaint = tB
      return { v: v, pctRaw: null, rad: base.rad || exp.rad, dirty: base.dirty || exp.dirty }
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
        // 整数乘积精确性守卫（1.5.13）：TwoProduct 误差项非零即乘积已被舍入；
        // 结果仍在全位显示量级（<1e21）时报错，不静默给错整数（ChatGPT 第九份报告）；
        // ≥1e21 只记污染、由结尾结算（1.5.14，与 +/−/^ 守卫同一口径）
        if (Number.isInteger(left.v) && Number.isInteger(right.v)) {
          const p = left.v * right.v
          if (isFinite(p) && Math.abs(left.v) <= 1e150 && Math.abs(right.v) <= 1e150 && twoProdErr(left.v, right.v) !== 0) {
            if (Math.abs(p) < 1e21) throw new Error('precision')
            intTaint++
          }
          left = { v: p, pctRaw: null, rad: left.rad || right.rad }
        } else {
          const p = left.v * right.v
          // 混合乘法污染（1.5.16）：一侧是超安全范围整数、另一侧是小数时，旧版
          // 直接双精度相乘不做核对——1e16×0.1 的舍入无人记录，后续 −1e15 后
          // 0.125 被当成精确值标 =（第十一轮复审实证）。乘积误差项非零即记
          // 污染，结算口径与整步守卫一致；0.5 这类精确乘数误差项为 0、不误伤。
          // 量级守卫：乘积比大整数操作数小 6 个数量级以上时不记——该步舍入的
          // 绝对误差同比例缩到可忽略，且方程探针 1e-15×1e30 这类合法求值
          //（结果 1e15 与操作数 1e30 相距 15 个数量级）不能被误杀
          const bigI = Math.max(Number.isInteger(left.v) ? Math.abs(left.v) : 0, Number.isInteger(right.v) ? Math.abs(right.v) : 0)
          if (isFinite(p) && p !== 0 && Math.abs(left.v) <= 1e150 && Math.abs(right.v) <= 1e150 &&
            bigI > 9007199254740991 && Math.abs(p) >= bigI * 1e-6 &&
            twoProdErr(left.v, right.v) !== 0) intTaint++
          left = { v: p, pctRaw: null, rad: left.rad || right.rad }
        }
        // 精确湮灭（1.5.14）：任一乘数确为 0（其自身求值没新增污染）时乘积
        // 恒 0、与另一乘数的污染无关，可清本项内的污染（恢复到 t0，兄弟项的
        // 污染保留）；被污染凑出来的 0 则不清——(1e21+1−1e21)×5 的真值是 5
        // 不是 0，不能跟着那个假 0 一起清掉
        if (left.v === 0 && ((right.v === 0 && rightClean) || leftClean)) intTaint = t0
      }
      else {
        if (right.v === 0) throw new Error('div0')
        // 整除精确性守卫（1.5.13）：商是整数时用乘积误差项反核 q×除数 必须恰好
        // 等于被除数，否则这个「整数商」是舍入凑出来的；<1e21 报错、≥1e21 记污染（1.5.14）
        let qv = left.v / right.v
        if (Number.isInteger(left.v) && Number.isInteger(right.v) && Number.isInteger(qv) && Math.abs(qv) <= 1e150 && Math.abs(right.v) <= 1e150 && (twoProdErr(qv, right.v) !== 0 || qv * right.v !== left.v)) {
          if (Math.abs(qv) < 1e21) throw new Error('precision')
          intTaint++
        }
        // 混合除法污染（1.5.16）：超安全范围整数参与、商非整数时，用乘积误差项
        // 反核 qv×除数 是否还原被除数，还原不了说明商已被舍入，记污染（口径
        // 同混合乘法，含量级守卫：商小到不足操作数 1e-6 时不记）
        const bigD = Math.max(Number.isInteger(left.v) ? Math.abs(left.v) : 0, Number.isInteger(right.v) ? Math.abs(right.v) : 0)
        if (!(Number.isInteger(left.v) && Number.isInteger(right.v) && Number.isInteger(qv)) &&
          isFinite(qv) && qv !== 0 && Math.abs(qv) <= 1e150 && Math.abs(right.v) <= 1e150 &&
          bigD > 9007199254740991 && Math.abs(qv) >= bigD * 1e-6 &&
          (twoProdErr(qv, right.v) !== 0 || qv * right.v !== left.v)) intTaint++
        if (qv === 0 && leftClean) intTaint = t0 // 被除数确为 0 时商恒 0，同理清本项污染
        left = { v: qv, pctRaw: null, rad: left.rad || right.rad }
      }
      // 误差来源追踪透传（1.5.19）：乘除本身不吸附，但 dirty 标记按来源
      // 传递（任一操作数 dirty 则结果 dirty），供后续加减步判定吸附资格
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
      // 整数加减精确性守卫（1.5.13）：9007199254740992+1 旧版静默吞掉 +1、结果还
      // 显示精确等号，(9007199254740992+1)−9007199254740992 因此得 0（真值 1）；
      // TwoSum 误差项非零即和已被舍入（ChatGPT 第九份报告实证）。结果 ≥1e21
      // 不立即拦、只记污染（1.5.14）：1e21+1−1e21 曾靠「中间步豁免」把误差带回
      // 精确区静默给 0（真值 1，第十份报告实证），结尾按污染结算
      if (Number.isInteger(lv) && Number.isInteger(rv)) {
        const s = op === '+' ? lv + rv : lv - rv
        const errI = twoSumErr(lv, op === '+' ? rv : -rv)
        if (isFinite(s) && errI !== 0) {
          if (Math.abs(s) < 1e21) throw new Error('precision')
          intTaint++
        }
        // 守卫逻辑不变，仅顺带线程化 dirty 标记（1.5.19，规则与下方同款）
        ldirty = ldirty || rdirty || errI !== 0
        lv = s
      } else {
        const s = op === '+' ? lv + rv : lv - rv
        const errS = twoSumErr(lv, op === '+' ? rv : -rv)
        // 混合加减污染（1.5.16）：1e16+0.1 里 0.1 被双精度静默吞掉，旧版不做
        // 核对，−1e16 后得 0 还标精确（第十一轮复审实证）。一侧是超安全范围
        // 整数时用 TwoSum 误差项核对本步和，非零即记污染、由结尾统一结算；
        // 量级守卫同混合乘法（和比大整数操作数小 6 个数量级以上不记）
        const bigI = Math.max(Number.isInteger(lv) ? Math.abs(lv) : 0, Number.isInteger(rv) ? Math.abs(rv) : 0)
        if (isFinite(s) && bigI > 9007199254740991 && Math.abs(s) >= bigI * 1e-6 &&
          errS !== 0) intTaint++
        // 抵消残差吸附（1.5.18，B-01）：0.1+0.2−0.3 = 5.55e-17 级残差的源头
        // 是加减步操作数自身携带的舍入（相对操作数尺度 ~2^-53/步），显示层
        // 无状态判别分不开它与同量级真商（第十二轮复审实证），必须在求值层
        // 按相对尺度吸附：结果非零、却只有操作数尺度 2^-50（≈8 ulp）量级
        // 时判为抵消残差、归零。乘除定标不吸附；同尺度合法小量（1e-17+
        // 1e-17，结果与操作数同量级）与 0+x（结果即操作数本身）不受影响
        // 误差来源追踪（1.5.19，第十三轮复审 P1）：纯阈值吸附误吞用户手打
        // 字面量的精确小差（1.0000000000000002−1 经 Sterbenz 精确可得
        // 2.22e-16、被旧版归零）。追加来源条件：本步 dirty 才可吸附——
        // dirty 的定义是本步 TwoSum 误差非零（这步本身算不精确）、或任一
        // 操作数已 dirty（误差沿括号/一元/乘除透传，字面量与精确步恒
        // clean）。0.1+0.2 首步误差非零 → 链条 dirty → 后续 −0.3 的残差
        // 照旧吸附；全程精确的链条任何小差值都不许动
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
  // 整数链污染结算（1.5.14）：链上有过 ≥1e21 量级的整数舍入、最终结果又回到
  // <1e21 的精确显示区时，这个「整数」已被污染，不能当精确值交出去。
  // 加减不做湮灭清除：3^50+1−3^50 与 3^50−3^50 在双精度下长得一模一样、
  // 真值却一个是 1 一个是 0，不可区分时宁可拒绝、不装精确（既定边界）
  // 结算口径 1.5.16 扩到混合链：污染也可来自大整数×小数步（如 1e16×0.1），
  // 结果未必是整数（0.125），但只要它会被显示成精确值（dispExact 回读全等），
  // 同样拦截；本来就是近似显示的结果（1/3 类）不受影响、照常交出
  if (intTaint > 0 && Math.abs(out) < 1e21 && dispExact(out, formatDisplay(out))) throw new Error('precision')
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
  // 「精确表示」的判据 1.5.12 放宽到表示级 ulp：1÷10^16×1.1 的乘积双精度值与
  // 12 位十进制回读值差 1 ulp（相对 1.1e-16），旧版严格相等把这类真值误吞成 0
  //（ChatGPT 第八份报告实证）。相对阈值 1e-13 仍低于实测尾巴（sin π 2.2e-12、
  // cos(π/2) 5.3e-13、0.1+0.2−0.3 7.6e-13），尾巴继续归零；(1/3)×1e-15 级
  //（相对差 1e-12）在阈值外、维持 1.5.6 既定边界
  if (Math.abs(v) < 1e-15) return (r12 === v || Math.abs(r12 - v) <= 1e-13 * Math.abs(v)) ? r12 : 0
  return r12
}

// 纯文本（可再次参与运算）：无千分位
function formatPlain(v) {
  const c = cleanNum(v)
  if (isNaN(c)) return '错误'
  if (!isFinite(c)) return '溢出'
  return String(c)
}

// 课本式科学计数（1.5.17，用户定版）：显示层禁用 e 记法，'d.dddde±X' 一律
// 改写成 'd.dddd×10'＋上标指数（如 1e-7 → 1×10⁻⁷、-1.2346e+15 → -1.2346×
// 10¹⁵，正指数不带 +、指数负号用 ⁻）。只改记法外壳：尾数沿用入串的既有
// 精度，仅去掉尾数末尾的 0（与 trimSci 同口径）；尾数负号保持入串原样
//（ASCII '-' 或 '−'），由调用方按既有口径（dispMinus/dm/dispNum）收尾。
// 非 e 记法串原样返回
function sciStr(s) {
  const m = /^([\-−]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(String(s))
  if (!m) return String(s)
  const frac = (m[3] || '').replace(/0+$/, '')
  const exp = parseInt(m[4], 10)
  const sup = (exp < 0 ? '⁻' : '') + String(Math.abs(exp)).split('').map((c) => SUP_DIGITS[c]).join('')
  return m[1] + m[2] + (frac ? '.' + frac : '') + '×10' + sup
}

// 显示串 → 可解析纯文本（1.5.17）：'×10＋上标指数' 还原成 e 记法，供
// dispExact 回读与历史回退串再入算式；e 记法与普通串原样返回，新旧通吃
function sciToPlain(s) {
  return String(s).replace(/×10(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function (w, neg, run) {
    return 'e' + (neg ? '-' : '') + run.split('').map((c) => SUP_TO_DIGIT[c]).join('')
  })
}

// 显示文本：整数部分加千分位
// 显示串与真实值是否严格相等：相等用 =，只是四舍五入的近似值用 ≈
function dispExact(v, s) {
  if (typeof v !== 'number' || !isFinite(v)) return false
  // 显示串里的负号是 −（formatDisplay 统一转换），回读比较前先换回 ASCII；
  // 课本式科学计数（1.5.17）先经 sciToPlain 还原成 e 记法再 parseFloat，
  // 旧 e 记法串不受影响、新旧都认
  const p = parseFloat(sciToPlain(String(s)).replace(/,/g, '').replace(/−/g, '-'))
  if (p === v) return true
  // 0.1+0.2 这类：二进制浮点噪声不是数学近似——先把 v 按 15 位有效数字
  // 抹平噪声，再和显示串比；抹平后还对不上（如 1/3、√2）才是真近似
  return p === parseFloat(v.toPrecision(15))
}
function eqSign(v, s) { return dispExact(v, s === undefined ? formatDisplay(v) : s) ? '=' : '≈' }
// 显示层负号统一成 −（与算式行、方程标题行口径一致，1.5.15）：formatDisplay
// 旧版原样输出 ASCII '-'，结果行/答案行/判别式行与同屏的「−」混排。
// 1.5.17 起科学计数显示改课本式（sciStr，指数是上标 ⁻、没有 ASCII '-'），
// 本函数的 e 后保护只剩历史旧串等存量文本会走到，保留不动
function dispMinus(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '-' && !(i > 0 && (s[i - 1] === 'e' || s[i - 1] === 'E'))) out += '−'
    else out += ch
  }
  return out
}

// 极小真商判别（1.5.18，B-01）：v 是否为「干净十进制数 ÷ 小整数」型的
// 真值——存在小整数 k（2..99）使 v×k 恰为有效数字 ≤3 位的干净十进制数
//（12 位回读全等）、且除回来分毫不差。实测：真商族（1e-16÷3、÷7、÷1.5、
// ÷2.2 等 17 例）全过；0.1+0.2−0.3 残差（2^-54）、sin/cos 的 π 尾巴、
// 无理数缩放、4 万个随机双精度值均零假阳性。cleanNum 的归零判别本身不
// 动（fracIsExact、方程 DP 等调用点口径不变），本判别只供 formatDisplay
// 在显示层救援——相消残差另有求值层加减吸附先行拦截（见 parseExprW）
function isTinyQuotient(v) {
  for (let k = 2; k <= 99; k++) {
    const w = v * k
    if (w === 0 || !isFinite(w)) continue
    if (parseFloat(w.toPrecision(12)) !== w) continue
    if (w / k !== v) continue
    const digs = Math.abs(w).toPrecision(12).replace(/e.*$/, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
    if (digs.length <= 3) return true
  }
  return false
}

// 精确微差判别（1.5.19 同版修订）：v 的二进制尾数是否「短」——Sterbenz
// 相近数相减的精确差（1.0000000000000002−1 = 2^-52 等）是 2 的整数次幂
// 或其短整数倍，尾数有效位极少；浮点尾巴（sin π = 1.2246…e-16）与无理
// 数缩放的尾数则占满 53 位。判定式：x = |v| 反复 ×2/÷2（精确缩放）归
// 一化到 [1, 2)，m = round(x·2^52) 为尾数整数，m 反复 ÷2 去尽尾零后
// m < 2^8 = 256 ⇔ 有效位 ≤8 位 ⇔ 判真。实测：三个精确差族（2^-52、
// 2^-54、2^-55）有效位均为 1；sin π 尾巴、键入字面量 1e-17、√2×10⁻¹⁷
// 均为 53 位；20 万个随机双精度差零命中。与 isTinyQuotient 同哲学：
// cleanNum 本身不动，本判别只供 formatDisplay 在显示层救援——求值层
// taint 已先行决定哪些残差是尾巴（dirty 链吸附归零），到达显示层的
// 非零短尾数值是全程精确的真差，不许再被 12 位判别吞成 0
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
  // 极小真商救援（1.5.18，B-01）：cleanNum 的极小值判别按 12 位表示性
  // 归零，会把 1e-16÷3 的真商 3.333…e-17 与相消尾巴一并吞成 0（第十二
  // 轮复审实证）；过 isTinyQuotient 判别的（乘除定标产生的真小量）按
  // 12 位有效数字课本式显示。尾巴与无理数缩放过不了判别、仍显示 0；
  // formatPlain 不走救援（接力/内部表示口径不变）
  if (s === '0' && v !== 0 && isFinite(v) && isTinyQuotient(v)) return dispMinus(sciStr(String(parseFloat(v.toPrecision(12)))))
  // 精确微差救援（1.5.19 同版修订）：求值层 taint 保住的手打字面量精确
  // 差（2^-52 级）真值已对，却仍被 cleanNum 的相对 1e-13 判别在显示层
  // 归零（第十三轮复审 P1 的显示层残余）；短尾数判别过关的按 12 位有
  // 效数字课本式显示。sin π 尾巴与无理数缩放尾数占满 53 位、过不了
  // 判别，仍显示 0；formatPlain 同样不走本救援（内部表示口径不变）
  if (s === '0' && v !== 0 && isFinite(v) && isShortMantissa(v)) return dispMinus(sciStr(String(parseFloat(v.toPrecision(12)))))
  // 科学计数改课本式（1.5.17）：sciStr 换记法外壳，dispMinus 只收尾数负号
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

// toFraction 给出的分数是否与原值严格相等（1.5.12）：容差内认出的分数可能只是
// 近似（如 1.0000000002÷3 认作 1/3，差 6.7e-11），显示层据此区分「= 分数」
// 与「≈ 分数」，不许近似分数冒充精确值（ChatGPT 第八份报告实证）。
// 判据是「显示精度内相等」：分数与原值都收敛到 12 位有效数字后逐位相等。
// 1/6、4/27 的求值结果与键入的 12 位小数 0.148148148148 在 12 位上与分数完全
// 一致，算精确（1.5.0/1.5.4 既定口径）；0.3333333334 与 1/3 在第 10 位就不同、
// 12 位内对不上，判近似。与 eqSign 的回读口径同哲学：以应用自身的显示精度为准
function fracIsExact(v, fr) {
  if (!fr) return false
  // 分母为 1 的「分数」就是整数本身：与原值逐位相同才算精确（1.5.13）。
  // 旧版一律走 12 位有效数字比对，而 cleanNum 对整数保留全位——1234567890123
  // 这类 13 位精确整数被误标 ≈（ChatGPT 第九份报告实证）；非整数值误认成
  // 整数分数时 fr.n !== v、仍判近似，不受影响
  if (fr.d === 1) return fr.n === v
  return parseFloat((fr.n / fr.d).toPrecision(12)) === cleanNum(v)
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
  // 入口安全整数检查（1.5.9）：超安全范围的输入在解析阶段已被舍入，结果后检拦不住「算的是另一个数」
  if (![n1, d1, n2, d2].every(Number.isSafeInteger)) return { error: '数字太大，超出精确计算范围' }
  if (d1 === 0 || d2 === 0) return { error: '分母不能为 0' }
  // 加减前先分别约简两个输入分数（1.5.10）：MAX/MAX + MAX/MAX 这种输入本身安全，
  // 不约简时中间和 2·MAX 先超安全范围被误报；约简后是 1/1 + 1/1 = 2。乘除同理受益。
  const q1 = reduceFrac(n1, d1), q2 = reduceFrac(n2, d2)
  n1 = q1.n; d1 = q1.d; n2 = q2.n; d2 = q2.d
  let n, d
  // 先约分再乘（1.5.8）：乘除先交叉约分、加减先用分母 gcd 缩小中间乘积，
  // 避免结果本身不大、中间乘积却先超安全整数被误报「数字太大」
  //（例：1000000000/1000000001 × 1000000001/1000000000 = 1，旧版中间乘积约 1e18 直接报错）。
  // 约分用的 gcd 必整除对应两数，以下除法都是精确整除；最终仍有安全整数兜底检查
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
  // 入口安全整数检查（1.5.9）：isInteger 不保证精度，2^53 这类已失精的整数曾被直接算 gcd 返回
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return { error: '数字太大，超出精确计算范围' }
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
  if (!Number.isSafeInteger(n)) return { error: '数字太大，超出精确计算范围' }
  if (n < 0) return { error: '被开方数不能为负' }
  if (n === 0) return { coef: 0, rad: 1, dec: 0 }
  // 输入上限 1e12（1.5.10，与方程根式路径 sqrtRat 的既有上限对齐）：根号页输入框本身有 9 位上限
  //（≤999,999,999），此上限不改变任何可达行为；上限内试除最坏 1e6 次，手环可接受。
  // 注：曾试立方根试除界＋末步完全平方检查，被 1..3000 全量校验抓出反例（18=3²·2 这类 p²·m 型），
  // 该优化的正确性论证不成立，已回退为朴素试除——正确性优先。
  if (n > 1e12) return { error: '数字太大，超出精确计算范围' }
  let coef = 1, rad = n
  for (let k = 2; k * k <= rad; k++) {
    while (rad % (k * k) === 0) { rad /= (k * k); coef *= k }
  }
  return { coef: coef, rad: rad, dec: Math.sqrt(n) }
}

// ---------- 判别式/行列式可靠计算（1.5.20，第十四轮复审 N-01/N-02） ----------
// b²−4ac、a1b2−a2b1 这类「两大乘积相消」在双精度下会把真值丢成 0：
// 999999998x²+999999999x+250000000 的 Δ 精确为 1、双精度算得 0 → 误判重根；
// 方程组 {999999999x+999999998y=1; 999999998x+999999997y=2} 的 D 精确为 −1、
// 双精度算得 0 → 误报无解（复审方 BigInt 核对实证）。口径：
// 系数全为整数值 → BigInt 精确算、判定不带容差（无 BigInt 运行时退回补偿
// 算术，与仓内既有 BigInt 用法同款守卫）；含非整数系数 → 双双精度补偿
// 算术（TwoProduct/TwoSum，乘积与差算到约 2^-106 相对精度）后沿用既有
// 相对容差判定——小数系数的假重根/倍式方程组基线（0.1/0.7 族）靠的正是
// 容差，容差数值不动、只是被判定的量从原始双精度换成高精度值。
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
// det2ddPair(p, q, r, s, k2) = p·q − k2·(r·s) 的双双精度对 [hi, lo]
//（已归一化：|lo| ≤ 0.5·ulp(hi)，hi 为正确舍入值；整数输入且乘积不溢出时
// hi + lo 为精确值，可据对判零/判符号——无 BigInt 运行时整数路径的兜底）
function det2ddPair(p, q, r, s, k2) {
  const pr1 = ddProd(p, q), pr2 = ddProd(r, s)
  const d = ddSum(pr1[0], -k2 * pr2[0])
  const lo = (pr1[1] - k2 * pr2[1]) + d[1]
  return ddSum(d[0], lo)
}
function det2dd(p, q, r, s, k2) { return det2ddPair(p, q, r, s, k2)[0] }
// 双双精度对的符号：归一化后 hi 主导，hi 为 0 时看 lo；对全零返回 0
function ddPairSign(pair) {
  if (pair[0] !== 0) return pair[0] > 0 ? 1 : -1
  if (pair[1] !== 0) return pair[1] > 0 ? 1 : -1
  return 0
}
// 整数系数精确判别式 b²−4ac（BigInt）；无 BigInt 运行时返回 null 退回补偿路径
function bigDisc(a, b, c) {
  if (typeof BigInt !== 'function') return null
  try {
    const A = BigInt(a), B = BigInt(b), C = BigInt(c)
    return B * B - 4n * A * C
  } catch (e) { return null }
}
// 整数系数精确行列式组 [D, Dx, Dy]（BigInt）；无 BigInt 运行时返回 null
function bigDets(a1, b1, c1, a2, b2, c2) {
  if (typeof BigInt !== 'function') return null
  try {
    const A1 = BigInt(a1), B1 = BigInt(b1), C1 = BigInt(c1)
    const A2 = BigInt(a2), B2 = BigInt(b2), C2 = BigInt(c2)
    return [A1 * B2 - A2 * B1, C1 * B2 - C2 * B1, A1 * C2 - A2 * C1]
  } catch (e) { return null }
}
function isIntVal(v) { return Number.isInteger(v) }

// ---------- 三角形面积（1.5.20 新工具） ----------
// 数值：三边排序后用 Kahan 稳定海伦式连乘——细长三角形（如 500000, 500000, 1）
// 不因 s−a 级相消丢精度（与勾股高线法参照相对误差 1e-16 级）。
// 精确形：边长按 String(v) 最短串还原成十进制整数缩放（与 toFraction 同
// 口径），三角形判定（构成/退化）在整数上精确做；四个海伦因子
// F1=a+b+c、F2=b+c−a、F3=a−b+c、F4=a+b−c 各自试除分解（单因子 ≤1e12，
// 与 simplifySqrt 同上限口径）、指数合并得面积 = (cn/cd)·√rad；不可还原、
// 超限或无 BigInt 时 exact 为 null、只给小数——不编造精确形。
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
  // 整数缩放路径（判定＋精确形）；缩放后整数须留出三倍求和余量
  const decs = [a, b, c].map(decScaleOf)
  let S = null, K = 0
  if (decs.every(function (d) { return d !== null }) && typeof BigInt === 'function') {
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
  const area = 0.25 * Math.sqrt((x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z)))
  if (!isFinite(area)) return { error: '数字太大，超出精确计算范围' }
  let exact = null
  if (S !== null) {
    const F = [S[0] + S[1] + S[2], S[1] + S[2] - S[0], S[0] - S[1] + S[2], S[0] + S[1] - S[2]]
    if (F.every(function (v) { return v <= 1e12 })) {
      const merged = new Map()
      for (const f of F) for (const ent of factorExps(f)) merged.set(ent[0], (merged.get(ent[0]) || 0) + ent[1])
      let coefB = 1n, radB = 1n
      for (const ent of merged) {
        if (ent[1] % 2 === 1) radB *= BigInt(ent[0])
        if (ent[1] >= 2) coefB *= BigInt(ent[0]) ** BigInt(ent[1] >> 1)
      }
      let cnB = coefB, cdB = 4n * (10n ** BigInt(2 * K))
      let g = cnB, h = cdB
      while (h !== 0n) { const t = g % h; g = h; h = t }
      cnB /= g; cdB /= g
      // 转 Number 须逐值往返核对（BigInt(Number(x)) === x）：2^53 之外只有
      // 部分整数（2 的幂倍数）可精确表示，能往返才收，绝不给失真精确形
      const toSafeNum = function (v) {
        if (v > (10n ** 21n)) return null
        const n = Number(v)
        try { return BigInt(n) === v ? n : null } catch (e) { return null }
      }
      const cnN = toSafeNum(cnB), cdN = toSafeNum(cdB), radN = toSafeNum(radB)
      if (cnN !== null && cdN !== null && radN !== null) exact = { cn: cnN, cd: cdN, rad: radN }
    }
  }
  return { type: 'ok', area: area, exact: exact }
}

// ---------- 一元一次方程 ax+b = cx+d ----------

function solveLinear(a, b, c, d) {
  // 输入有限性守卫（1.5.20 补齐，与 solveSystem 同口径）：NaN/Inf 输入先挡
  // 下报错；旧版靠下方 A/B 检查兜底同类情形，口径不变
  if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) return { error: '数字太大，超出精确计算范围' }
  let A = a - c, B = d - b
  if (!isFinite(A) || !isFinite(B)) {
    // 两组大数相减溢出（1.5.20，N-06）：(1e308, 0, −1e308, 0) 的 A =
    // 1e308−(−1e308) 溢出成 Infinity、旧版直接报错，但解 x=0 本可表示。
    // 只在原始相减已溢出时才按 max|系数| 归一化重算（同除正数不改变
    // x = B/A）；原始相减有限的路径逐字走旧逻辑——1.5.7 钉注的
    // (1e-320, 0, 0, 1e300)（A、B 均有限、x 本身溢出）仍走下方 x 有限性
    // 检查报错，不被归一化改判成无解
    const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d))
    A = a / m - c / m
    B = d / m - b / m
    if (!isFinite(A) || !isFinite(B)) return { error: '数字太大，超出精确计算范围' }
  }
  if (A === 0) return B === 0 ? { type: 'infinite' } : { type: 'none' }
  const x = B / A
  // A 极小、B 极大时 x 会溢出成 ±Infinity：与 solveQuad 同口径报错，不把无穷大当解（1.5.7）
  if (!isFinite(x)) return { error: '数字太大，超出精确计算范围' }
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
  // 输入有限性守卫（1.5.20 前置，与 solveSystem/solveLinear 统一）：NaN/Inf
  // 输入直接报错。旧版靠原始判别式的 isFinite 检查兜底同类情形，口径不变；
  // 但有限输入的原始判别式溢出自 1.5.20 起不再先行报错——见下方归一化前移
  if (!isFinite(a) || !isFinite(b) || !isFinite(c)) return { error: '数字太大，超出精确计算范围' }
  // 尺度归一化（1.5.7 引入，1.5.20 前移到判别式计算之前）：系数整体不在 [1e-100, 1e100] 时同除以 m = max(|a|,|b|,|c|)，
  // 方程的根不变，判别式与容差回到 O(1) 尺度上算，根治两类尺度病：
  // ① 旧 eps 带 Math.max(1, …) 绝对下限——方程整体缩小（如 x²−1e-13=0）时
  //    真判别式 4e-13 被 1e-12 阈值吞掉、误报重根 0（ChatGPT 第三份报告实证；
  //    solveSystem 的同类问题已在 1.5.6 修掉，这里当时漏了）；
  // ② 系数整体极小时 b²、4ac 直接下溢成 0（如 1e-200 缩放），归一化后恢复可判。
  // 只在极端尺度才归一化：带内系数走原计算路径，避免 (1,−5,6) 这类整数方程
  // 被除法引入 3.0000000000000013 式的浮点灰尘（1.5.7 首版无条件归一化实证回退）。
  // 返回的 disc 尽量还原成原尺度值供页面显示 Δ；还原不出来（下溢）才用归一化值，
  // 保证 Δ 的符号与根的判定一致。
  const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c))
  const scaled = m > 1e100 || m < 1e-100
  const a1 = scaled ? a / m : a
  const b1 = scaled ? b / m : b
  const c1 = scaled ? c / m : c
  // 判别式可靠计算（1.5.20，N-01/N-05）：
  // · 归一化前移后，(1e200, −3e200, 2e200) 这类原始判别式先溢出的方程也能
  //   在归一化尺度上正常判别求根（缩放不改变根与判别式符号）；归一化后仍
  //   真溢出的由下方各分支的根有限性检查报错，口径与旧版一致。
  // · 整数系数走 BigInt 精确判别式（在原始系数上算，符号与归一化尺度一
  //   致）：分类（两根/重根/复数）只依据精确 Δ，不再被相对容差掩盖——
  //   Δ 精确为 1 的近重根方程旧版误判重根（N-01）。discN 由精确 Δ 换算到
  //   归一化尺度：未缩放直接 Number(D)；已缩放时 D 与 m² 可达 1e600 级
  //   BigInt、且系数跨量级时 discN 可小到 1e-308 级（a=1e308、b=c=1 的
  //   Δ/m² ≈ −4e-308）——按十进制位数把 D/m² 的商先放大到约 19 位有效
  //   数字（BigInt 整除），再分段乘回 10 的幂，全程既不溢出也不截断。
  // · 含非整数系数走双双精度补偿值＋既有相对容差（容差理由见下）。
  const bigD = (isIntVal(a) && isIntVal(b) && isIntVal(c)) ? bigDisc(a, b, c) : null
  let discN, discOut, exactCls = null
  if (bigD !== null) {
    exactCls = bigD > 0n ? 1 : bigD < 0n ? -1 : 0
    if (!scaled) {
      discN = Number(bigD)
      discOut = discN
    } else {
      const mB = BigInt(m), m2B = mB * mB
      const negD = bigD < 0n, absD = negD ? -bigD : bigD
      const dnD = absD.toString().length, dnM = m2B.toString().length
      const shiftD = 19 - (dnD - dnM)
      const qD = shiftD >= 0 ? (absD * (10n ** BigInt(shiftD))) / m2B : absD / (m2B * (10n ** BigInt(-shiftD)))
      let vD = Number(qD), eD = -shiftD
      while (eD <= -170) { vD *= 1e-170; eD += 170 }
      if (eD !== 0) vD *= Math.pow(10, eD)
      discN = negD ? -vD : vD
      const restored = (discN * m) * m
      discOut = (isFinite(restored) && restored !== 0) ? restored : discN
    }
  } else {
    const discPair = det2ddPair(b1, b1, a1, c1, 4)
    discN = discPair[0]
    // 整数系数但无 BigInt（如运行时缺失）：未缩放时整数乘积的双双对精确，
    // 据对判符号/判零作兜底分类，不被浮点容差掩盖（N-01 同口径）
    if (!scaled && isIntVal(a) && isIntVal(b) && isIntVal(c)) exactCls = ddPairSign(discPair)
    const discRaw = b * b - 4 * a * c
    if (!scaled) discOut = discRaw
    else {
      const rst = (discN * m) * m
      discOut = (isFinite(rst) && rst !== 0) ? rst : ((isFinite(discRaw) && discRaw !== 0) ? discRaw : discN)
    }
  }
  // 浮点容差：小数系数时 disc 可能是 ±1e-17 级的假信号，按相对量级判零；
  // 纯相对尺度、不设绝对下限（理由同 ①）。系数 1e-14（1.5.8 由 1e-12 收紧）：
  // 1e-12 时 x²+2x+(1−1e-13) 这类真两根（判别式 4e-13）会被误判重根——
  // 浮点噪声实际只有 1e-16 级，1e-14 仍留约 100 倍余量（ChatGPT 第四份报告实证）
  const eps = 1e-14 * Math.max(Math.abs(b1 * b1), Math.abs(4 * a1 * c1))
  const cls = exactCls !== null ? exactCls : (discN > eps ? 1 : discN >= -eps ? 0 : -1)
  if (cls === 1) {
    const sq = Math.sqrt(discN)
    // 稳定求根：先算「-b 与 √Δ 同向相加」的那根（不发生灾难性消去），
    // 另一根用韦达定理 x1·x2 = c/a 推出；x1/x2 顺序与旧公式保持一致
    const rA = (-b1 - (b1 >= 0 ? sq : -sq)) / (2 * a1)
    const rB = c1 / (a1 * rA)
    // a 极小时稳定求根也会溢出成 ±Infinity：同样报错，不许把无穷大当根返回
    if (!isFinite(rA) || !isFinite(rB)) return { error: '数字太大，超出精确计算范围' }
    return b1 >= 0
      ? { type: 'two', disc: discOut, x1: rB, x2: rA }
      : { type: 'two', disc: discOut, x1: rA, x2: rB }
  }
  if (cls === 0) {
    const x = -b1 / (2 * a1)
    if (!isFinite(x)) return { error: '数字太大，超出精确计算范围' }
    return { type: 'one', disc: 0, x: x }
  }
  const re = -b1 / (2 * a1)
  const im = Math.sqrt(-discN) / Math.abs(2 * a1)
  if (!isFinite(re) || !isFinite(im)) return { error: '数字太大，超出精确计算范围' }
  return { type: 'complex', disc: discOut, re: re, im: im }
}

// ---------- 二元一次方程组 {a1·x+b1·y=c1, a2·x+b2·y=c2} ----------

function solveSystem(a1, b1, c1, a2, b2, c2) {
  // 有限性守卫（1.5.8）：输入含 NaN/Infinity 时旧版一律落到「无解」分支（分类错误）；
  // 与 solveQuad/solveLinear 统一口径，先挡下来报错
  if (![a1, b1, c1, a2, b2, c2].every(function (v) { return isFinite(v) })) return { error: '数字太大，超出精确计算范围' }
  // 行尺度归一化（1.5.7）：每行尺度不在 [1e-100, 1e100] 时同除以该行
  // max(|a|,|b|,|c|)，解不变；防系数整体极小/极大时 D、Dx、Dy 下溢成 0 或
  // 溢出成 Inf/NaN 把判定带偏（1e-200 缩放的对角方程组曾误报无穷多解——
  // 1.5.6 的纯相对阈值救不了下溢，因为 D 本身已下溢没了）。
  // 只在极端尺度才归一化：普通行走原路径，避免除法给整数方程组引入
  // 1.0000000000000002 式灰尘（1.5.7 首版无条件归一化实证回退）
  const m1 = Math.max(Math.abs(a1), Math.abs(b1), Math.abs(c1))
  if (m1 > 1e100 || (m1 > 0 && m1 < 1e-100)) { a1 /= m1; b1 /= m1; c1 /= m1 }
  const m2 = Math.max(Math.abs(a2), Math.abs(b2), Math.abs(c2))
  if (m2 > 1e100 || (m2 > 0 && m2 < 1e-100)) { a2 /= m2; b2 /= m2; c2 /= m2 }
  // 行列式可靠计算（1.5.20，N-02）：与 solveQuad 同套路——归一化后的系数
  // 全为整数值时走 BigInt 精确行列式、判定不带容差（D 精确 −1 的方程组旧
  // 版被双精度相消误报无解）；含非整数系数时走双双精度补偿值＋下方既有
  // 相对容差判定（容差理由与数值均不变，只是被判定的量换成高精度值）
  const bigDs = (isIntVal(a1) && isIntVal(b1) && isIntVal(c1) && isIntVal(a2) && isIntVal(b2) && isIntVal(c2))
    ? bigDets(a1, b1, c1, a2, b2, c2) : null
  if (bigDs !== null) {
    const DB = bigDs[0], DxB = bigDs[1], DyB = bigDs[2]
    if (DB !== 0n) {
      const x = Number(DxB) / Number(DB), y = Number(DyB) / Number(DB)
      if (!isFinite(x) || !isFinite(y)) return { error: '数字太大，超出精确计算范围' }
      return { type: 'one', x: x, y: y, xFrac: toFraction(x), yFrac: toFraction(y) }
    }
    if (DxB === 0n && DyB === 0n) {
      // 还要排除「一行全 0 但 c≠0」这类实际无解
      if ((a1 === 0 && b1 === 0 && c1 !== 0) || (a2 === 0 && b2 === 0 && c2 !== 0)) return { type: 'none' }
      return { type: 'infinite' }
    }
    return { type: 'none' }
  }
  const Dp = det2ddPair(a1, b2, a2, b1, 1)
  const Dxp = det2ddPair(c1, b2, c2, b1, 1)
  const Dyp = det2ddPair(a1, c2, a2, c1, 1)
  const D = Dp[0], Dx = Dxp[0], Dy = Dyp[0]
  // 整数系数但无 BigInt：未被行归一化改写时整数乘积的双双对精确，据对
  // 判零作兜底（与 BigInt 分支同判定结构，N-02 同口径）
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
  // 浮点容差（同 solveQuad 套路）：小数系数时 D 可能是 1e-17 级的假信号
  //（如 0.1x+0.7y=1 与它的 3 倍式），严格判零会误报唯一解，必须按相对量级判。
  // 阈值必须是纯相对尺度、不能给下限：若按 max(1, …) 兜底，系数整体在 1e-7 级时
  // 真行列式只有 1e-14 级，会被 1e-12 的绝对阈值误判为零，把唯一解误报成
  // 无穷多解（1.5.6 实证修复：{0.0000001x=0.0000001; 0.0000001y=0.0000001}）
  // 容差系数 1e-14（1.5.8 由 1e-12 收紧，理由同 solveQuad：1e-12 时
  // {x+y=2; x+(1+1e-13)y=2+1e-13} 这类真唯一解（行列式 1e-13 级）会被误判无穷多解；
  // 浮点噪声只有 1e-16 级，1e-14 仍留约 100 倍余量）
  const eD = 1e-14 * Math.max(Math.abs(a1 * b2), Math.abs(a2 * b1))
  const eX = 1e-14 * Math.max(Math.abs(c1 * b2), Math.abs(c2 * b1))
  const eY = 1e-14 * Math.max(Math.abs(a1 * c2), Math.abs(a2 * c1))
  if (Math.abs(D) > eD) {
    const x = Dx / D, y = Dy / D
    if (!isFinite(x) || !isFinite(y)) return { error: '数字太大，超出精确计算范围' }
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
