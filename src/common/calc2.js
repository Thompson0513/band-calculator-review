// 1.6.0 新工具引擎（解直角三角形 / 排列组合 / 数列 / 正弦·余弦定理）。
// 单独成文件、只被第二页（pages/tools2）引用：主页不加载这部分代码，
// 控制主页的运行时内存占用（手环 QuickJS 堆上限很紧，见 BUGLOG 1.6.0）。
// 口径与 calc.js 一致：角度用「度」；全程普通 Number（运行时无 BigInt，
// 禁 BigInt 字面量与调用）；引擎只给数值与结构化判定，精确形由页面层负责。

// ===== 1.6.0 新增工具引擎（解直角三角形 / 排列组合 / 数列 / 正弦·余弦定理）=====
// 口径：角度一律用「度」；全程普通 Number（手环运行时无 BigInt，禁 BigInt
// 字面量与调用）；引擎只给数值与结构化判定，精确形显示由页面层负责。

function deg2rad(d) { return d * Math.PI / 180 }
function rad2deg(r) { return r * 180 / Math.PI }
function clampUnit(x) { return x > 1 ? 1 : (x < -1 ? -1 : x) }

// 解直角三角形：角 C = 90°，k = {a,b,c,A,B}（边长 / 度，缺的给 null）。
// 已知任意两个量（至少一条边）补齐全部；多给的量做一致性校验。
function solveRightTri(k) {
  const a = k.a, b = k.b, c = k.c, A0 = k.A, B0 = k.B
  const nSide = (a != null) + (b != null) + (c != null)
  const nAng = (A0 != null) + (B0 != null)
  if (nSide + nAng < 2) return { error: '再多填一个量就能解' }
  if (nSide === 0) return { error: '至少要填一条边' }
  if ((a != null && !(a > 0)) || (b != null && !(b > 0)) || (c != null && !(c > 0))) return { error: '边长要大于 0' }
  if ((A0 != null && !(A0 > 0 && A0 < 90)) || (B0 != null && !(B0 > 0 && B0 < 90))) return { error: '锐角要在 0° 到 90° 之间' }
  if (A0 != null && B0 != null && Math.abs(A0 + B0 - 90) > 1e-6) return { error: '两个锐角加起来要等于 90°' }
  let A = A0, B = B0
  if (A != null && B == null) B = 90 - A
  if (B != null && A == null) A = 90 - B
  let x = a, y = b, z = c
  // 2026-11-15 第十六轮复审：平方直算会溢出/下溢——1e200 的平方是
  // Infinity（校验变 NaN 比较、假通过）、1e-200 的平方下溢成 0（斜边算
  // 成 0 还报成功）。全部改尺度归一化：斜边用 max 边缩放后开方；已知斜
  // 边求直角边用 (z−x)(z+x) 的归一化乘积形（不开大数平方、无相消）。
  if (x != null && y != null && z == null) { const m = Math.max(x, y); z = m * Math.sqrt((x / m) * (x / m) + (y / m) * (y / m)) }
  else if (x != null && z != null && y == null) { if (!(z > x)) return { error: '斜边 c 要比直角边长' }; y = z * Math.sqrt(((z - x) / z) * ((z + x) / z)) }
  else if (y != null && z != null && x == null) { if (!(z > y)) return { error: '斜边 c 要比直角边长' }; x = z * Math.sqrt(((z - y) / z) * ((z + y) / z)) }
  if (x != null && y != null && z != null) {
    const xn = x / z, yn = y / z
    if (Math.abs(xn * xn + yn * yn - 1) > 1e-6) return { error: '三边不符合勾股定理' }
    const AfromSides = rad2deg(Math.atan2(x, y))
    if (A != null && Math.abs(AfromSides - A) > 0.01) return { error: '填的量对不上' }
    if (A == null) { A = AfromSides; B = 90 - A }
  } else if (A != null) {
    const sA = Math.sin(deg2rad(A)), cA = Math.cos(deg2rad(A))
    if (z != null) { x = z * sA; y = z * cA }
    else if (x != null) { z = x / sA; y = x / Math.tan(deg2rad(A)) }
    else if (y != null) { z = y / cA; x = y * Math.tan(deg2rad(A)) }
  }
  if (x == null || y == null || z == null || A == null || B == null) return { error: '再多填一个量就能解' }
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return { error: '数字太大，超出精确计算范围' }
  return { type: 'ok', a: x, b: y, c: z, A: A, B: B }
}

// 排列组合：A(n,r) = n!/(n-r)!，C(n,r) = n!/(r!(n-r)!)。
// exact 标记表示结果是精确整数（未越过安全整数界）；越界仍给数值（约数）。
function permComb(n, r) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) return { error: 'n 和 r 要是非负整数' }
  if (r > n) return { error: 'r 不能大于 n' }
  let A = 1, aExact = true, aOf = false
  for (let i = 0; i < r; i++) {
    A *= (n - i)
    // 2026-11-15 第十六轮复审（续）：A 溢出不连坐 C——C(200,200)=1 这类
    // C 完全可算的组合，旧版因 A=200! 溢出整单报错（全扫描 6561 组）。
    // A 单独标 aOf 置 null，页面只把 A 行标超范围，C 行照常给。
    if (!isFinite(A)) { aOf = true; A = null; break }
    if (A > 9007199254740991) aExact = false
  }
  let C = 1, cExact = true
  // 2026-11-15 第十六轮复审：旧递推 C = C*(n-r+i)/i 先乘后除逐步积累
  // 误差——C(56,27) 算出 7384942649010079（真值 ...080）还标 cExact；
  // 全扫描 n≤999 中可精确表示的 17945 组里 6729 组数值错、45 组错标
  // 精确。改：BigInt 精确递推（只用构造调用＋typeof 守卫，守运行时无
  // 字面量口径）；无 BigInt 时 gcd 约分递推兜底（约分后每步皆整数、中
  // 间值不超过最终结果，安全整数内必然精确）。
  const rr = Math.min(r, n - r)
  if (typeof BigInt === 'function') {
    let bc = BigInt(1)
    for (let i = 1; i <= rr; i++) bc = bc * BigInt(n - rr + i) / BigInt(i)
    cExact = bc <= BigInt(9007199254740991)
    C = Number(bc)
    if (!isFinite(C)) return { error: '数字太大，超出精确计算范围' }
  } else {
    const gcdI = function (p, q) { while (q) { const t = p % q; p = q; q = t } return p }
    let cc = 1
    for (let i = 1; i <= rr; i++) {
      let num = n - rr + i, den = i
      const g1 = gcdI(num, den); num /= g1; den /= g1
      const g2 = gcdI(cc, den); cc /= g2; den /= g2
      cc *= num
      if (den !== 1) { cc /= den; cExact = false }
      if (!isFinite(cc)) return { error: '数字太大，超出精确计算范围' }
      if (cc > 9007199254740991) cExact = false
    }
    C = cc
  }
  if (aExact && A !== null && !Number.isInteger(A)) aExact = false
  if (cExact && !Number.isInteger(C)) cExact = false
  return { type: 'ok', A: A, C: C, aExact: aExact, cExact: cExact, aOf: aOf }
}

// 数列：kind = 'ap'（x 为公差）| 'gp'（x 为公比），求第 n 项与前 n 项和。
function seqSolve(kind, a1, x, n) {
  if (!Number.isInteger(n) || n < 1) return { error: '项数 n 要是正整数' }
  let an, Sn
  if (kind === 'ap') {
    an = a1 + (n - 1) * x
    Sn = n * (a1 + an) / 2
  } else {
    an = a1 * Math.pow(x, n - 1)
    // 2026-11-15 第十六轮复审：q 接近 1 时 (q^n − 1) 相消——q = 1+1e-12、
    // n = 9999 的和算成 9999（真值 9999.000049989445）。q > 0.5 时改分治
    // 累加 Σq^i（全正项、无相消、只用 Math.pow，不依赖 expm1/log1p 的
    // 运行时支持面）：S(n) = S(n/2)·(1 + q^(n/2))（偶）/ S(n−1) + q^(n−1)（奇）。
    if (x === 1) Sn = a1 * n
    else if (x > 0.5) {
      const sumPow = function (q, nn) {
        if (nn === 1) return 1
        if (nn % 2 === 0) { const h = sumPow(q, nn / 2); return h * (1 + Math.pow(q, nn / 2)) }
        return sumPow(q, nn - 1) + Math.pow(q, nn - 1)
      }
      Sn = a1 * sumPow(x, n)
    }
    else Sn = a1 * (Math.pow(x, n) - 1) / (x - 1)
  }
  if (!isFinite(an) || !isFinite(Sn)) return { error: '数字太大，超出精确计算范围' }
  return { type: 'ok', an: an, Sn: Sn }
}

// 一般三角形（正弦 / 余弦定理）：k = {a,b,c,A,B,C}（边长 / 度，缺的给 null）。
// 给任意三个量（至少一条边）求全部解；SSA 可能两解。多给的量做一致性校验。
function solveTriangle(k) {
  const S = [k.a, k.b, k.c], G = [k.A, k.B, k.C]
  const nS = S.filter(function (v) { return v != null }).length
  const nG = G.filter(function (v) { return v != null }).length
  if (nS + nG < 3) return { error: '还要再填一个量' }
  if (nS === 0) return { error: '至少要填一条边' }
  for (let i = 0; i < 3; i++) {
    if (S[i] != null && !(S[i] > 0)) return { error: '边长要大于 0' }
    if (G[i] != null && !(G[i] > 0 && G[i] < 180)) return { error: '角要在 0° 到 180° 之间' }
  }
  const gIdx = [0, 1, 2].filter(function (i) { return G[i] != null })
  if (gIdx.length >= 2 && G[gIdx[0]] + G[gIdx[1]] >= 180) return { error: '两个角加起来要小于 180°' }
  // 三个角全给时也要校验内角和（旧版只拦了前两个角，30°+60°+100° 会漏过）。
  if (gIdx.length === 3 && Math.abs(G[0] + G[1] + G[2] - 180) > 1e-6) return { error: '三个角加起来要等于 180°' }
  function finish(s, g) {
    // 面积按最大边归一化再算（1e200 的边直接相乘会溢出），最后乘回 sc²。
    const sc = Math.max(s[0], s[1])
    const area = 0.5 * (s[0] / sc) * (s[1] / sc) * Math.sin(deg2rad(g[2])) * sc * sc
    return { a: s[0], b: s[1], c: s[2], A: g[0], B: g[1], C: g[2], area: area }
  }
  function fromSSS(s) {
    // 余弦定理的边平方会溢出（1e200² = Infinity → NaN 角）：先归一化再算角，
    // 角度与边长缩放无关。
    // 2026-11-15 第十六轮复审：角度改半角 atan2 形——旧 acos 形在参数近
    // ±1 时精度全灭：(1,1,1e-8) 的小角被算成 0 后被兜底误杀、SAS 极小
    // 夹角算出的第三边误差 15%。半角形 tan(A/2) = √((s−b)(s−c)/(s(s−a)))
    // 对小角与近 180° 角都稳定（归一化边上求值，无溢出）。
    const sc = Math.max(s[0], s[1], s[2])
    const n = [s[0] / sc, s[1] / sc, s[2] / sc]
    const hs = (n[0] + n[1] + n[2]) / 2
    // 2026-11-15 第十七轮复审：hs − n[i] 改稳定差形 ((大边 − n[i]) + 小边)/2
    // （另两边里先拿大的减 n[i]、再加小的）。直算时 hs 先把三边求和，极小
    // 边被圆整吞掉——(1,1,1e-16) 的 hs 圆成 1，三个角全算成 0；若先拿极小
    // 边减大边（如 1e-100 − 1）残差同样被吞。近邻相减精确（Sterbenz）：
    // (1,1,1e-16) 的角算回 (90°, 90°, ≈5.7e-15°)，面积也随之正确。
    const d = [0, 1, 2].map(function (i) {
      const j = (i + 1) % 3, m = (i + 2) % 3
      const hi = Math.max(n[j], n[m]), lo = Math.min(n[j], n[m])
      return Math.max(0, ((hi - n[i]) + lo) / 2)
    })
    const g = [0, 1, 2].map(function (i) {
      const j = (i + 1) % 3, m = (i + 2) % 3
      // 根号分开乘：d[j]·d[m] 在极小边时先下溢成 0（(5e-301)² 量级），
      // 分开开方再乘可把可算范围推到双精度下限附近。
      const num = Math.sqrt(d[j]) * Math.sqrt(d[m])
      const den = Math.sqrt(Math.max(0, hs)) * Math.sqrt(d[i])
      return 2 * rad2deg(Math.atan2(num, den))
    })
    return finish(s, g)
  }
  // 小数边退化：0.1+0.2 在十进制下恰好等于 0.3，但浮点加法得
  // 0.30000000000000004 会漏过「三边退化」判定。把三边精确放大成整数再比。
  function sidesDegenerateExact(s) {
    let k = 0
    const ints = []
    for (let i = 0; i < 3; i++) {
      const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(s[i]))
      if (!m) return false
      let digs = (m[2] + (m[3] || '')).replace(/^0+/, '')
      let kk = (m[3] || '').length - (m[4] ? parseInt(m[4], 10) : 0)
      if (kk < 0) { if (digs.length - kk > 15) return false; digs = digs + '0'.repeat(-kk); kk = 0 }
      if (digs.length > 15 || digs === '') return false
      if (kk > k) k = kk
      ints.push({ d: digs, kk: kk, neg: m[1] === '-' })
    }
    const scaled = ints.map(function (o) { return (o.neg ? -1 : 1) * Number(o.d + '0'.repeat(k - o.kk)) })
    if (scaled.some(function (v) { return !Number.isSafeInteger(v) })) return false
    const srt = scaled.slice().sort(function (p, q) { return q - p })
    return srt[1] + srt[2] === srt[0]
  }
  // 三边和精确比较（2026-11-15 第十七轮复审）：(次大 + 最小) 与最大边比
  // 大小，按十进制串用 BigInt 精确缩放，无 15 位/安全整数上限。浮点相等
  // 会把 (1,1,1e-16) 误判退化（1 + 1e-16 在双精度里圆成 1），旧
  // sidesDegenerateExact 在缩放 1e16 超安全整数时也会放弃。返回 -1/0/1；
  // 无 BigInt 或解析失败返回 null，调用方退回旧浮点口径（含上面的函数）。
  function sidesSumCmp(s) {
    if (typeof BigInt !== 'function') return null
    let k = 0
    const parts = []
    for (let i = 0; i < 3; i++) {
      const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(s[i]))
      if (!m) return null
      let digs = (m[2] + (m[3] || '')).replace(/^0+/, '')
      let kk = (m[3] || '').length - (m[4] ? parseInt(m[4], 10) : 0)
      if (digs === '') return null
      if (kk < 0) { digs = digs + '0'.repeat(-kk); kk = 0 }
      if (kk > k) k = kk
      parts.push({ d: digs, kk: kk, neg: m[1] === '-' })
    }
    const scaled = parts.map(function (o) {
      const v = BigInt(o.d) * BigInt('1' + '0'.repeat(k - o.kk))
      return o.neg ? -v : v
    })
    scaled.sort(function (p, q) { return p > q ? -1 : (p < q ? 1 : 0) })
    const sum = scaled[1] + scaled[2]
    return sum > scaled[0] ? 1 : (sum < scaled[0] ? -1 : 0)
  }
  function verify(sol) {
    for (let i = 0; i < 3; i++) {
      const sv = [sol.a, sol.b, sol.c][i], gv = [sol.A, sol.B, sol.C][i]
      if (S[i] != null && Math.abs(sv - S[i]) > 1e-6 * Math.max(1, S[i])) return false
      if (G[i] != null && Math.abs(gv - G[i]) > 0.01) return false
    }
    return true
  }
  let sols = null
  if (nS === 3) {
    const s = [S[0], S[1], S[2]]
    const srt = s.slice().sort(function (p, q) { return q - p })
    // 判定优先走十进制精确比较（sidesSumCmp）；拿不到（无 BigInt 等）
    // 才退回浮点比较 + sidesDegenerateExact 的旧口径。
    const cmp = sidesSumCmp(s)
    if (cmp !== null) {
      if (cmp < 0) return { error: '三边不能构成三角形' }
      if (cmp === 0) return { error: '三边退化成一条直线' }
    } else {
      if (srt[1] + srt[2] < srt[0]) return { error: '三边不能构成三角形' }
      if (srt[1] + srt[2] === srt[0] || sidesDegenerateExact(s)) return { error: '三边退化成一条直线' }
    }
    sols = [fromSSS(s)]
  } else if (nS === 2 && nG >= 1) {
    const miss = [0, 1, 2].filter(function (i) { return S[i] == null })[0]
    if (G[miss] != null) {
      // SAS：缺的边所对的角就是夹角
      // 2026-11-15 第十六轮复审：余弦定理直算在夹角极小时相消（a=b=1、
      // C=1e-6° 时第三边误差 15%、C=1e-7° 时 cos 圆整成 1、边算成 0 被
      // 误杀）。改稳定形 c² = (a−b)² + 4ab·sin²(C/2) 并按最大边归一化。
      const i = (miss + 1) % 3, j = (miss + 2) % 3
      const s = [S[0], S[1], S[2]]
      const mm = Math.max(S[i], S[j])
      const ai = S[i] / mm, aj = S[j] / mm
      const sh = Math.sin(deg2rad(G[miss]) / 2)
      s[miss] = mm * Math.sqrt((ai - aj) * (ai - aj) + 4 * ai * aj * sh * sh)
      sols = [fromSSS(s)]
    } else {
      // SSA：已知角对已知边
      const gi = gIdx[0], oi = [0, 1, 2].filter(function (i) { return i !== gi && S[i] != null })[0]
      const mi = [0, 1, 2].filter(function (i) { return i !== gi && i !== oi })[0]
      const sinO = S[oi] * Math.sin(deg2rad(G[gi])) / S[gi]
      if (sinO > 1 + 1e-12) return { error: '这样的三角形不存在' }
      // sinO ≈ 1（浮点尘）时是唯一一个直角解，角度直接取 90，别裂成两个近重解
      const cand = sinO >= 1 - 1e-9 ? [90] : [rad2deg(Math.asin(clampUnit(sinO)))]
      if (cand[0] !== 90) cand.push(180 - cand[0])
      sols = []
      for (const ov of cand) {
        if (G[gi] + ov >= 180) continue
        const mv = 180 - G[gi] - ov
        const s = [S[0], S[1], S[2]], g = [G[0], G[1], G[2]]
        g[oi] = ov; g[mi] = mv
        s[mi] = S[gi] * Math.sin(deg2rad(mv)) / Math.sin(deg2rad(G[gi]))
        sols.push(finish(s, g))
      }
      if (!sols.length) return { error: '这样的三角形不存在' }
    }
  } else if (nG >= 2) {
    // ASA / AAS：两角 + 一边
    const g = [G[0], G[1], G[2]]
    const miss = [0, 1, 2].filter(function (i) { return G[i] == null })[0]
    // 三个角全给时 miss 为 undefined：角已齐，不用再算第三个角。
    if (miss !== undefined) g[miss] = 180 - G[(miss + 1) % 3] - G[(miss + 2) % 3]
    const si = [0, 1, 2].filter(function (i) { return S[i] != null })[0]
    const ratio = S[si] / Math.sin(deg2rad(g[si]))
    const s = [0, 1, 2].map(function (i) { return ratio * Math.sin(deg2rad(g[i])) })
    sols = [finish(s, g)]
  }
  if (!sols) return { error: '还要再填一个量' }
  const passed = sols.filter(verify)
  if (!passed.length) return { error: '填的量对不上' }
  // 兜底：解的角必须落在 (0°, 180°)、面积有限——超大边（1e200）算出的
  // NaN 角 / 溢出面积不许当作解返回。
  const good = passed.filter(function (sol) {
    return [sol.A, sol.B, sol.C].every(function (g) { return isFinite(g) && g > 0 && g < 180 }) && isFinite(sol.area) && sol.area >= 0
  })
  if (!good.length) return { error: '数字太大，超出精确计算范围' }
  return { type: 'ok', solutions: good }
}

export default {
  solveRightTri: solveRightTri,
  permComb: permComb,
  seqSolve: seqSolve,
  solveTriangle: solveTriangle
}
