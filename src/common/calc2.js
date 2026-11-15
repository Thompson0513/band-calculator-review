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
  if (x != null && y != null && z == null) z = Math.sqrt(x * x + y * y)
  else if (x != null && z != null && y == null) { if (!(z > x)) return { error: '斜边 c 要比直角边长' }; y = Math.sqrt(z * z - x * x) }
  else if (y != null && z != null && x == null) { if (!(z > y)) return { error: '斜边 c 要比直角边长' }; x = Math.sqrt(z * z - y * y) }
  if (x != null && y != null && z != null) {
    if (Math.abs(x * x + y * y - z * z) > 1e-6 * z * z) return { error: '三边不符合勾股定理' }
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
  let A = 1, aExact = true
  for (let i = 0; i < r; i++) {
    A *= (n - i)
    if (!isFinite(A)) return { error: '数字太大，超出精确计算范围' }
    if (A > 9007199254740991) aExact = false
  }
  let C = 1, cExact = true
  for (let i = 1; i <= r; i++) {
    C = C * (n - r + i) / i
    if (!isFinite(C)) return { error: '数字太大，超出精确计算范围' }
    if (C > 9007199254740991) cExact = false
  }
  if (aExact && !Number.isInteger(A)) aExact = false
  if (cExact && !Number.isInteger(C)) cExact = false
  return { type: 'ok', A: A, C: C, aExact: aExact, cExact: cExact }
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
    Sn = x === 1 ? a1 * n : a1 * (Math.pow(x, n) - 1) / (x - 1)
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
    const sc = Math.max(s[0], s[1], s[2])
    const n = [s[0] / sc, s[1] / sc, s[2] / sc]
    const g = [0, 1, 2].map(function (i) {
      const j = (i + 1) % 3, m = (i + 2) % 3
      return rad2deg(Math.acos(clampUnit((n[j] * n[j] + n[m] * n[m] - n[i] * n[i]) / (2 * n[j] * n[m]))))
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
    if (srt[1] + srt[2] < srt[0]) return { error: '三边不能构成三角形' }
    if (srt[1] + srt[2] === srt[0] || sidesDegenerateExact(s)) return { error: '三边退化成一条直线' }
    sols = [fromSSS(s)]
  } else if (nS === 2 && nG >= 1) {
    const miss = [0, 1, 2].filter(function (i) { return S[i] == null })[0]
    if (G[miss] != null) {
      // SAS：缺的边所对的角就是夹角
      const i = (miss + 1) % 3, j = (miss + 2) % 3
      const s = [S[0], S[1], S[2]]
      s[miss] = Math.sqrt(S[i] * S[i] + S[j] * S[j] - 2 * S[i] * S[j] * Math.cos(deg2rad(G[miss])))
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
