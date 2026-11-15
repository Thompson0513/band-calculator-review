// 1.6.0 新工具引擎（解直角三角形 / 排列组合 / 数列 / 正弦·余弦定理）。
// 单独成文件、只被第二页（pages/tools2）引用：主页不加载这部分代码，
// 控制主页的运行时内存占用（手环 QuickJS 堆上限很紧，见 BUGLOG 1.6.0）。
// 口径与 calc.js 一致：角度用「度」；引擎只给数值与结构化判定，精确形
// 由页面层负责。BigInt 口径（2026-11-15 第十八轮复审订正）：手环运行时
// 禁 BigInt 字面量（解析期语法错误、整包黑屏）；BigInt() 构造调用仅限
// typeof 守卫＋无 BigInt 兜底处（permComb 的 gcd 路径）；其余精确判定
// （三边比较等）一律纯字符串/Number 实现，不依赖 BigInt 是否存在。

// ===== 1.6.0 新增工具引擎（解直角三角形 / 排列组合 / 数列 / 正弦·余弦定理）=====
// 口径：角度一律用「度」；引擎只给数值与结构化判定，精确形显示由页面层负责。

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
    // 2026-11-15 第十九轮复审：(n−1)·x 本身可能先溢出——a1 = −1.5e308、
    // d = 1e308、n = 3 时 2e308 = Infinity，真 an = 5e307（靠加法抵消）。
    // 直算非有限时按 (n−1) 二分拆开逐段加（apNth）：每段都是数列的真实
    // 部分和、量级不超真 an；真溢出时拆到 m = 1 仍非有限、照旧报错。
    const apNth = function (a, d, m) {
      if (m === 0) return a
      const direct = a + m * d
      if (isFinite(direct) || m === 1) return direct
      if (m % 2 === 0) { const h = apNth(a, d, m / 2); return apNth(h, d, m / 2) }
      return apNth(a, d, m - 1) + d
    }
    an = apNth(a1, x, n - 1)
    // 2026-11-15 第十八轮复审：旧式 n·(a1+an)/2 先乘后除——a1 = 1e304、
    // d = 0、n = 9999 时中间值 9999·2e304 先溢出（真和 9.999e307 本可
    // 表示）。改先算均值再乘 n；a1 + an 本身溢出时用 a1/2 + an/2 兜底
    // （二分在二进制下精确，均值口径不变）。
    let avg = (a1 + an) / 2
    if (!isFinite(avg)) avg = a1 / 2 + an / 2
    Sn = n * avg
  } else {
    an = a1 * Math.pow(x, n - 1)
    // 2026-11-15 第十八轮复审：pow 先溢出/下溢会连累本可表示的 an——
    // a1 = 1e-300、q = 10、n = 310 时 10^309 先溢出，真 an = 1e9。直算
    // 失败时改对数域兜底；真溢出时 exp 仍给 Infinity、照旧报错。
    if (a1 !== 0 && x !== 0 && (an === 0 || !isFinite(an))) {
      const la = Math.log(Math.abs(a1)) + (n - 1) * Math.log(Math.abs(x))
      an = Math.sign(a1) * (x < 0 && (n - 1) % 2 === 1 ? -1 : 1) * Math.exp(la)
    }
    // 2026-11-15 第十六轮复审：q 接近 1 时 (q^n − 1) 相消——q = 1+1e-12、
    // n = 9999 的和算成 9999（真值 9999.000049989445）。q > 0.5 时改分治
    // 累加（全正项、无相消、只用 Math.pow，不依赖 expm1/log1p 的运行时
    // 支持面）。2026-11-15 第十八轮复审：分治改带首项缩放——旧版先算
    // Σq^i 再乘 a1，q = 10、n = 310 时 Σ 本身先溢出（真和 ≈1.111e9）；
    // sumPowA 把 a1 折进递归，每层量级贴着真实部分和走。负公比
    // q < −1 同理（闭式里的 q^n 先溢出），一并走分治；−1 ≤ q ≤ 0.5 的
    // 闭式无溢出风险、保持旧口径。
    if (x === 1) Sn = a1 * n
    else if (x > 0.5 || x < -1) {
      const sumPowA = function (q, nn, a) {
        if (nn === 1) return a
        if (nn % 2 === 0) { const h = sumPowA(q, nn / 2, a); return h + sumPowA(q, nn / 2, a * Math.pow(q, nn / 2)) }
        return sumPowA(q, nn - 1, a) + a * Math.pow(q, nn - 1)
      }
      Sn = sumPowA(x, n, a1)
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
    // 面积 = ½·s0·s1·sin(C)，按 0.5·s0·(s1·sinC) 的顺序算：两个因子
    // 都不超过结果量级，中间量溢出 ⟺ 真面积溢出。旧式先归一化再乘回
    // sc² 有两坑（2026-11-15 第十九轮自查）：sc > 1.3e154 时 sc² 先溢
    // 出（a=b=1e200、C≈5.7e-149° 的真面积 5e249 被误报溢出）；极端边
    // 比下 s1/sc 下溢成 0（a=1e308、b=1e-100、C=90° 的面积被算成 0，
    // 真值 5e207）。
    let area = 0.5 * s[0] * (s[1] * Math.sin(deg2rad(g[2])))
    if (area === 0) {
      // 2026-11-15 第十九轮自查（续）：夹角真值小于最小次正规数时角被
      // 舍入成 0、sin 式面积跟着成 0，但按边长算的真面积未必是 0（SSS
      // 1e308/1e308/1e-100 真面积 5e207）。仅当 sin 式给出 0 时改按边
      // 长走归一化 Kahan 海伦式、乘积下溢再转对数域（与主页 triArea
      // 同法）；非零面积永不走这里、原断言不变。
      const srt = [s[0], s[1], s[2]].sort(function (p, q) { return q - p })
      const x = srt[0], y = srt[1], z = srt[2]
      const ux = y / x, uz = z / x
      const au = 0.25 * Math.sqrt(Math.max((1 + (ux + uz)) * (uz - (1 - ux)) * (uz + (1 - ux)) * (1 + (ux - uz)), 0))
      area = au * x * x
      if (area === 0) {
        const lnX = Math.log(x)
        const lnF1 = lnX + Math.log(1 + y / x + z / x)
        const dxy = x - y
        const F2 = z - dxy
        if (F2 > 0) {
          const lnF2 = Math.log(F2)
          const lnF3 = dxy === 0 ? Math.log(z) : (z > dxy ? Math.log(z) + Math.log(1 + dxy / z) : Math.log(dxy) + Math.log(1 + z / dxy))
          const lnF4 = lnX + Math.log(1 + (y - z) / x)
          const av = Math.exp(-Math.log(4) + 0.5 * (lnF1 + lnF2 + lnF3 + lnF4))
          if (av > 0) area = av
        }
      }
    }
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
    // 2026-11-15 第十九轮自查：边比超 1e308 时归一化会把小边吞成 0、
    // d[i] 跟着塌成 0——(1e308, 1e-100, 1e308) 的 A 角被 atan2(0, 0) 算
    // 成 0°（真值 90°）、verify 误报「填的量对不上」。任一 d[i] 为 0 时
    // 改用原始边长在对数域算半角：rawD 用 (hi−s[i])/2 + lo/2 防加法溢
    // 出、半周长用半值和；普通三角形 d 全正、永不触发，原断言不变。
    if (d[0] === 0 || d[1] === 0 || d[2] === 0) {
      const rawD = function (i) {
        const j = (i + 1) % 3, m = (i + 2) % 3
        const hi = Math.max(s[j], s[m]), lo = Math.min(s[j], s[m])
        return (hi - s[i]) / 2 + lo / 2
      }
      const rd = [rawD(0), rawD(1), rawD(2)]
      const hsR = s[0] / 2 + s[1] / 2 + s[2] / 2
      if (rd.every(function (v) { return v > 0 })) {
        return finish(s, [0, 1, 2].map(function (i) {
          const j = (i + 1) % 3, m = (i + 2) % 3
          const lt = 0.5 * (Math.log(rd[j]) + Math.log(rd[m]) - Math.log(hsR) - Math.log(rd[i]))
          return 2 * rad2deg(Math.atan(Math.exp(lt)))
        }))
      }
    }
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
  // 十进制串工具：边长解析成 { d: 数字串（去前导零）, kk: 小数位 }。
  function decPartsOf(v) {
    const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(v))
    if (!m || m[1] === '-') return null
    let digs = (m[2] + (m[3] || '')).replace(/^0+/, '')
    let kk = (m[3] || '').length - (m[4] ? parseInt(m[4], 10) : 0)
    if (digs === '') return null
    if (kk < 0) { digs = digs + '0'.repeat(-kk); kk = 0 }
    return { d: digs, kk: kk }
  }
  function addDigStr(a, b) { // 两个无前导零的非负整数串相加（逐位进位）
    let i = a.length - 1, j = b.length - 1, carry = 0, out = ''
    while (i >= 0 || j >= 0 || carry) {
      const sm = (i >= 0 ? a.charCodeAt(i--) - 48 : 0) + (j >= 0 ? b.charCodeAt(j--) - 48 : 0) + carry
      out = String.fromCharCode(48 + (sm % 10)) + out
      carry = (sm / 10) | 0
    }
    return out
  }
  function cmpDigStr(a, b) { // 无前导零整数串比较：先比长度、再逐字比
    if (a.length !== b.length) return a.length > b.length ? 1 : -1
    return a === b ? 0 : (a > b ? 1 : -1)
  }
  // 三边和精确比较（2026-11-15 第十七轮复审立、第十八轮改纯字符串）：
  // (次大 + 最小) 与最大边比大小，按十进制串精确缩放，无 15 位/安全整
  // 数上限。浮点相等会把 (1,1,1e-16) 误判退化（1 + 1e-16 在双精度里圆
  // 成 1），旧 sidesDegenerateExact 在缩放 1e16 超安全整数时也会放弃。
  // 第十七轮版靠 BigInt 缩放——第十八轮复审指出无 BigInt 运行时又退回
  // 浮点误判；改纯字符串加法/比较后不依赖 BigInt 是否存在。返回
  // -1/0/1；解析失败返回 null，调用方退回旧浮点口径（含上面的函数）。
  function sidesSumCmp(s) {
    const parts = []
    let k = 0
    for (let i = 0; i < 3; i++) {
      const p = decPartsOf(s[i])
      if (!p) return null
      if (p.kk > k) k = p.kk
      parts.push(p)
    }
    const scaled = parts.map(function (o) { return o.d + '0'.repeat(k - o.kk) })
    scaled.sort(function (p, q) { return cmpDigStr(q, p) })
    return cmpDigStr(addDigStr(scaled[1], scaled[2]), scaled[0])
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
    // 判定优先走十进制精确比较（sidesSumCmp，纯字符串、不依赖
    // BigInt）；解析失败才退回浮点比较 + sidesDegenerateExact 的旧口径。
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
  // 2026-11-15 第十九轮自查：边长算成 Infinity/NaN 的解是结果溢出
  // （如 ASA a=1e308、A=30°、B=60° 的第三边真值 2e308、超双精度上
  // 限），先按溢出滤掉、全军覆没时报溢出；别让它混进 verify 后误报
  // 「填的量对不上」（那句是给输入互相矛盾准备的）。
  const finiteSols = sols.filter(function (sol) { return [sol.a, sol.b, sol.c].every(isFinite) })
  if (!finiteSols.length) return { error: '数字太大，超出精确计算范围' }
  const passed = finiteSols.filter(verify)
  if (!passed.length) return { error: '填的量对不上' }
  // 兜底：解的角必须落在 [0°, 180°)、三角和为 180、面积有限——超大边
  // （1e200）算出的 NaN 角 / 溢出面积不许当作解返回。0 角只可能是极端
  // 边比下真值小于最小次正规数（≈1e-407°）的正确舍入，靠三角和把关。
  const good = passed.filter(function (sol) {
    return [sol.A, sol.B, sol.C].every(function (g) { return isFinite(g) && g >= 0 && g < 180 }) && Math.abs(sol.A + sol.B + sol.C - 180) < 1e-6 && isFinite(sol.area) && sol.area >= 0
  })
  if (!good.length) return { error: '数字太大，超出精确计算范围' }
  return { type: 'ok', solutions: good }
}

// 浮点缩放助手（2026-11-15 第二十轮复审修复引入）：frexp2 把正数拆成
// f × 2^e（f ∈ [1, 2)）；scalbn2 把 2^e 分 256 一段逐段乘回去——一次
// 乘 2^±2046 必先溢出 / 下溢成 0 或 Infinity，逐段乘时中间值不超过最
// 终值（剩余指数同号），最终值可表示则全程可表示。供下面四个引擎在
// 极端量级下恢复真值用，避免「中间量先溢出、真值明明存得下」的假溢出。
// 第二十一轮复审修 frexp2 端点：Math.log2(最大有限数) 舍入到 1024、
// Math.pow(2, 1024) = Infinity 会让尾数变 0——指数先钳到 [-1022, 1023]
// 重算，再用乘除 2 逐级校正（log2 在 2 的幂邻域差 1 也靠它归位）。
function frexp2(x) {
  if (!(x > 0) || !isFinite(x)) return [0, 0]
  let e = Math.floor(Math.log2(x))
  let f = x / Math.pow(2, e)
  if (!isFinite(f) || f === 0) { e = e > 0 ? 1023 : -1022; f = x / Math.pow(2, e) }
  while (f >= 2) { f /= 2; e += 1 }
  while (f < 1) { f *= 2; e -= 1 }
  return [f, e]
}
// (尾数, 指数) 累加器（第二十一轮）：st = [v, e] 表示 v × 2^e，v 带
// 符号、|v| ∈ [1, 2)。expAdd 把一项 f × 2^e（f 带符号）对齐指数加进
// 去再归一化——单向量 / 单复数内部相差数百个数量级的分量统一除以最
// 大值时会先下溢成 0（第二十一轮 BUG-02/04/05），逐项独立缩放累加
// 才保得住。归一化的倍增循环加上限防相消到次正规量级时空转。
function expAdd(st, f, e) {
  if (f === 0) return
  if (st[0] === 0) { st[0] = f; st[1] = e }
  else if (e > st[1]) { st[0] = st[0] * Math.pow(2, st[1] - e) + f; st[1] = e }
  else { st[0] += f * Math.pow(2, e - st[1]) }
  let guard = 0
  while (Math.abs(st[0]) >= 2) { st[0] /= 2; st[1] += 1 }
  while (st[0] !== 0 && Math.abs(st[0]) < 1 && guard++ < 1200) { st[0] *= 2; st[1] -= 1 }
}
function expVal(st) { return st[0] === 0 ? 0 : scalbn2(st[0], st[1]) }
// 单个乘积的缩放版：两因子各自 frexp 后尾数相乘、指数相加再还原——
// 乘积本身可表示时精确恢复，不受因子量级悬殊影响（1e308 × 1e-300
// = 1e8）；乘积真溢出 / 下溢时返回 Infinity / 0（诚实边界）。
function prodT(x, y) {
  if (x === 0 || y === 0) return 0
  const fx = frexp2(Math.abs(x)), fy = frexp2(Math.abs(y))
  return scalbn2(fx[0] * fy[0] * ((x < 0) !== (y < 0) ? -1 : 1), fx[1] + fy[1])
}
function scalbn2(x, e) {
  if (x === 0 || !isFinite(x)) return x
  while (e > 0) { const s = Math.min(e, 256); x *= Math.pow(2, s); e -= s; if (!isFinite(x)) return x }
  while (e < 0) { const s = Math.max(e, -256); x *= Math.pow(2, s); e -= s; if (x === 0) return x }
  return x
}

// 数据统计（2026-11-15 新增，用户点名要方差）：平均数、总体方差 /
// 标准差（分母 n，初中课内口径）、样本方差 / 标准差（分母 n−1，高中
// 样本估计口径）。平均数用「移位 + Welford」：先减首项再累加，大数
// 扎堆（如 100000001、100000002、100000003）时增量都是小量，不相消；
// 数据跨满量程（|x| > 9e307）时移位差 v−K 本身会溢出，改走半量程差
// v/2−K/2（减半是精确的二进制缩放）再 Welford，最后还原。
// 方差改两遍法（2026-11-15 第二十轮复审）：旧 Welford 的 M2 累加器
// 会先于方差真值溢出——[1e154, −1e154, 0] 的 M2 = 2e308 已存不下，
// 但总体方差 6.67e307、样本方差 1e308 都存得下，旧实现整页报错。
// 现第二遍把 Σ(x−均值)² 按 (尾数, 指数) 缩放累加（每项用半差
// h = x/2 − 均值/2 构造，h 恒有限、(2h)² 即该项），最后总体 / 样本
// 各自 scalbn 还原、各自判溢出：哪个真超双精度哪个返回 Infinity，
// 由页面单独标「太大」，不连坐其余统计量。
function statsOf(xs) {
  if (!Array.isArray(xs) || xs.length === 0) return { error: '先加至少一个数据' }
  for (const v of xs) if (!isFinite(v)) return { error: '有数据不对' }
  const n = xs.length
  let maxAbs = 0
  for (const v of xs) maxAbs = Math.max(maxAbs, Math.abs(v))
  const K = xs[0]
  // 半量程切换阈值取 MAX/2（第二十一轮复审）：v − K 不溢出的充要条
  // 件是 2·maxAbs ≤ MAX；旧阈值 9e307 偏高，8.99e307 这类数据相减
  // 已达 1.798e308 溢出、整页误报。
  const half = maxAbs > Number.MAX_VALUE / 2
  let mean = 0, cnt = 0
  for (const v of xs) {
    const d = half ? v / 2 - K / 2 : v - K
    cnt++
    const delta = d - mean
    mean += delta / cnt
  }
  const meanV = half ? (K / 2 + mean) * 2 : K + mean
  if (!isFinite(meanV)) return { error: '数字太大，超出精确计算范围' }
  let acc = 0, accE = 0 // Σ(x−meanV)² = acc × 2^accE，acc ∈ [1, 2)
  for (const v of xs) {
    const h = v / 2 - meanV / 2
    if (h === 0) continue
    const fr = frexp2(Math.abs(h)), f = fr[0], e = fr[1]
    let tf = f * f, te = 2 * e + 2 // (2h)² = f² × 2^(2e+2)
    if (tf >= 2) { tf /= 2; te += 1 }
    if (acc === 0) { acc = tf; accE = te }
    else if (te > accE) { acc = acc * Math.pow(2, accE - te) + tf; accE = te }
    else { acc += tf * Math.pow(2, te - accE) }
    if (acc >= 2) { acc /= 2; accE += 1 }
  }
  const popVar = acc === 0 ? 0 : scalbn2(acc / n, accE)
  const sampVar = n >= 2 ? (acc === 0 ? 0 : scalbn2(acc / (n - 1), accE)) : null
  // 中位数 / 众数 / 极差（2026-11-15 统计补全，用户点名）：中位数偶数
  // 个时取中间两数均值（同号 a + (b−a)/2、异号 a/2 + b/2，见下）；众数按双精度精
  // 确相等计数（输入多为课本小数），全都只出现一次时为 null（无众数）；
  // 极差 = 最大 − 最小，跨 ±1.7e308 时真值超双精度、原样返回 Infinity
  // 由页面单独标「太大」，不连坐其他统计量。
  const srt = xs.slice().sort(function (p, q) { return p - q })
  const mid = n >> 1
  // 偶数个的中位数：同号时 a + (b−a)/2 防 (a+b) 溢出；异号时 (b−a) 本
  // 身会溢出（如 −1.7e308 与 1.7e308），改 a/2 + b/2（第二十轮复审同
  // 类自查——旧移位溢出报错曾把这条挡在前面，移位修好后必须一起修）。
  let median
  if (n % 2 === 1) median = srt[mid]
  else {
    const ma = srt[mid - 1], mb = srt[mid]
    median = (ma <= 0 && mb >= 0) ? ma / 2 + mb / 2 : ma + (mb - ma) / 2
  }
  const freq = new Map()
  for (const v of xs) freq.set(v, (freq.get(v) || 0) + 1)
  let maxF = 0
  for (const cntF of freq.values()) if (cntF > maxF) maxF = cntF
  let modes = null
  if (maxF > 1) {
    modes = []
    for (const ent of freq) if (ent[1] === maxF) modes.push(ent[0])
    modes.sort(function (p, q) { return p - q })
  }
  return {
    type: 'ok', n: n, mean: meanV,
    popVar: popVar, popSd: Math.sqrt(popVar),
    sampVar: sampVar, sampSd: sampVar === null ? null : Math.sqrt(sampVar),
    median: median, modes: modes, range: srt[n - 1] - srt[0]
  }
}

// 分布列期望与方差（2026-11-15 新增，用户点名）：pairs 为 [x, p] 数组。
// 先验概率合法性（0 ≤ p ≤ 1）与 Σp = 1（课本数据的小数加总误差容差
// 1e-9，超了明确报错、不静默归一化——Σp 是否为 1 本就是要核对的）。
// 期望用 (尾数, 指数) 缩放累加（第二十一轮，次正规贡献不被单项乘
// 法舍掉）；方差用两遍法 Σp(x−E)² 加 Kahan，不用 E(X²)−E²——方差
// 远小于期望平方时后者灾难性相消。方差真溢出时 D / sd 返回
// Infinity、期望照常，页面分行标「太大」（第二十一轮，不连坐）。
function distOf(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return { error: '先加至少一组取值和概率' }
  let sp = 0
  for (const pr of pairs) {
    if (!isFinite(pr[0]) || !isFinite(pr[1])) return { error: '有数据不对' }
    if (pr[1] < 0 || pr[1] > 1) return { error: '概率要在 0 到 1 之间' }
    sp += pr[1]
  }
  if (Math.abs(sp - 1) > 1e-9) return { error: '概率之和要等于 1', psum: sp }
  // 期望改 (尾数, 指数) 累加（第二十一轮复审）：x·p 单项先乘会把次
  // 正规量级的贡献舍掉（5e-324 × 0.5 = 0），逐项缩放累加才保得住；
  // E 是凸组合、恒可表示，不再有溢出报错路径。
  const stE = [0, 0]
  for (const pr of pairs) {
    if (pr[1] === 0 || pr[0] === 0) continue // 零概率项无贡献（第二十轮复审）
    const fx = frexp2(Math.abs(pr[0])), fp = frexp2(pr[1])
    expAdd(stE, (pr[0] < 0 ? -1 : 1) * fx[0] * fp[0], fx[1] + fp[1])
  }
  const E = expVal(stE)
  let D = 0
  let comp = 0
  let dInf = false
  for (const pr of pairs) {
    if (pr[1] === 0) continue
    const dv = pr[0] - E
    // |dv| 大时 dv 本身可能溢出成 Infinity（x 与 E 异号满量程），或
    // dv² 先溢出而 p·dv² 真值存得下（p 为次正规量级）：改用半差
    // h = x/2 − E/2（恒有限），t = 4·p·h² 即 p·dv²。
    let t
    if (isFinite(dv) && Math.abs(dv) <= 1e150) t = pr[1] * dv * dv
    else { const h = pr[0] / 2 - E / 2; t = pr[1] * h * h * 4 }
    // 方差真溢出只标 D / sd，不连坐期望（第二十一轮复审，同 statsOf
    // 第二十轮契约）：方差项恒 ≥ 0、一旦溢出只会更大，停累加即可。
    if (!isFinite(t)) { dInf = true; break }
    const y = t - comp
    const s = D + y
    comp = (s - D) - y
    D = s
    if (!isFinite(D)) { dInf = true; break }
  }
  if (dInf) D = Infinity
  if (D < 0) D = 0
  return { type: 'ok', n: pairs.length, E: E, D: D, sd: Math.sqrt(D) }
}

// 向量运算（2026-11-15 新增，用户点名）：a、b 为等长分量数组（2 或
// 3）。普通量级直算（课本数据保持精确，如 (1,2,3)·(4,5,6) 恰 32）；
// 任一向量分量超 1e150 时改按各自最大分量独立归一化再恢复——第二十
// 轮复审实测：旧版两向量共用一个最大值 M，[1e200,1e200] 与
// [1e-200,1e-200] 混算时小向量归一化下溢成 0，被误判零向量（点积
// 2 算成 0、夹角变 null）。独立缩放后点积的恢复乘积 MA·MB 可能先
// 溢出，按 sn·(MA·MB) → (sn·MA)·MB → (sn·MB)·MA 顺序取第一个有限
// 结果；归一化点积恰为 0 时点积就是 0，别让 ∞·0 冒充 NaN。夹角用
// atan2(|a×b|, a·b)（第二十一轮改，见函数内注）。零向量没有夹角
// （angle 为 null）。
function vecOf(a, b) {
  for (const v of a.concat(b)) if (!isFinite(v)) return { error: '有分量不对' }
  const dim = a.length
  let MA = 0, MB = 0
  for (const v of a) MA = Math.max(MA, Math.abs(v))
  for (const v of b) MB = Math.max(MB, Math.abs(v))
  const sum = [], diff = []
  for (let i = 0; i < dim; i++) { sum.push(a[i] + b[i]); diff.push(a[i] - b[i]) }
  if (MA === 0 || MB === 0) {
    return { type: 'ok', dot: 0, magA: MA === 0 ? 0 : vecMag(a, MA), magB: MB === 0 ? 0 : vecMag(b, MB), sum: sum, diff: diff, angle: null }
  }
  const an = a.map(function (v) { return v / MA }), bn = b.map(function (v) { return v / MB })
  let sn = 0, sa = 0, sb = 0
  for (let i = 0; i < dim; i++) { sn += an[i] * bn[i]; sa += an[i] * an[i]; sb += bn[i] * bn[i] }
  // 单个向量内部尺度悬殊时（分量比 > 1e290），小分量除以最大值会下
  // 溢成 0 或掉进次正规精度区——点积改逐项 (尾数, 指数) 累加（第
  // 二十一轮复审：[1e308, 1e-308]·[1e-308, 1e308] 应为 2，统一归
  // 一化算成 0）。模长不受此影响（小分量对模长的贡献低于精度）。
  let lost = false
  for (let i = 0; i < dim; i++) {
    if ((a[i] !== 0 && (an[i] === 0 || Math.abs(an[i]) < 1e-290)) ||
        (b[i] !== 0 && (bn[i] === 0 || Math.abs(bn[i]) < 1e-290))) lost = true
  }
  let dot
  if (MA <= 1e150 && MB <= 1e150) {
    dot = 0
    for (let i = 0; i < dim; i++) dot += a[i] * b[i]
  } else if (lost) {
    const stD = [0, 0]
    for (let i = 0; i < dim; i++) {
      if (a[i] === 0 || b[i] === 0) continue
      const fa = frexp2(Math.abs(a[i])), fb = frexp2(Math.abs(b[i]))
      expAdd(stD, fa[0] * fb[0] * ((a[i] < 0) !== (b[i] < 0) ? -1 : 1), fa[1] + fb[1])
    }
    dot = expVal(stD)
  } else if (sn === 0) dot = 0
  else {
    const p = MA * MB
    if (isFinite(p)) dot = sn * p
    else { const r1 = (sn * MA) * MB; dot = isFinite(r1) ? r1 : (sn * MB) * MA }
  }
  // 夹角改 atan2(|a×b|, a·b)（第二十一轮复审）：acos 在端点附近分辨
  // 率只有约 1e-8 rad，上一轮用「cos 距 ±1 不足 1e-12 就归零」止尘，
  // 反而误杀了 5.7e-5° 这类真实可分辨的小角度；atan2 两端都稳定，
  // 叉积恰为 0 时就是严格平行 / 反向、直接给 0 / 180（无舍入尘）。
  let cross
  if (dim === 2) cross = Math.abs(an[0] * bn[1] - an[1] * bn[0])
  else {
    const cx = an[1] * bn[2] - an[2] * bn[1]
    const cy = an[2] * bn[0] - an[0] * bn[2]
    const cz = an[0] * bn[1] - an[1] * bn[0]
    cross = Math.sqrt(cx * cx + cy * cy + cz * cz)
  }
  const angle = cross === 0 ? (sn >= 0 ? 0 : 180) : Math.atan2(cross, sn) * 180 / Math.PI
  return { type: 'ok', dot: dot, magA: vecMag(a, MA), magB: vecMag(b, MB), sum: sum, diff: diff, angle: angle }
}
function vecMag(v, M) {
  // 直算平方和只在 1e-150 ≤ M ≤ 1e150 时安全：再大平方溢出、再小平方下溢成 0。
  if (M >= 1e-150 && M <= 1e150) { let s = 0; for (const x of v) s += x * x; return Math.sqrt(s) }
  let s = 0
  for (const x of v) { const q = x / M; s += q * q }
  return M * Math.sqrt(s)
}

// 复数四则与模（2026-11-15 新增，用户点名）：z1 = [a, b]、z2 = [c, d]
// （实部、虚部）。乘 / 除先把两个复数按各自最大分量独立缩放（分量落
// 到 [0, 1]），Smith 式在缩放域里算，最后用 scalbn2 把尺度比还原：
// 第二十轮复审实测旧 Smith 式在 z1 = z2 = 1e308+1e308i 时 den =
// c + d·r = 2e308 先溢出、商变 NaN（真值 1）；同类自查发现乘法也有
// 相消 NaN——(1e200+1e200i)² 的实部 a·c − b·d 两项都溢出成
// Infinity、相减变 NaN（真值 0）。缩放域里乘积 ≤ 1、den ∈ [1, 2]，
// 两病同治；尺度悬殊的乘法（如 1e308 × 1e-300）靠独立缩放 + 指数
// 还原也不会被大分量吞掉小分量。除数为 0 时 div 为 null。模长同样
// 按最大分量归一化。第二十一轮复审再进一层：缩放域会丢单个复数
// 内部分量比超 1e308 的小分量，乘 / 除主路径改逐项 prodT 缩放
// （见函数内注），缩放域结果只作积项非有限时的兜底。
function cplxOps(z1, z2) {
  const a = z1[0], b = z1[1], c = z2[0], d = z2[1]
  if (![a, b, c, d].every(isFinite)) return { error: '有数不对' }
  const S1 = Math.max(Math.abs(a), Math.abs(b)), S2 = Math.max(Math.abs(c), Math.abs(d))
  let mul = [0, 0], div = null
  if (S1 !== 0 && S2 !== 0) {
    const f1 = frexp2(S1), f2 = frexp2(S2)
    const a1 = a / S1, b1 = b / S1, c1 = c / S2, d1 = d / S2
    // 缩放域结果（兜底）：积项双双溢出相消时只有它算得对（如
    // (1e200+1e200i)² 实部两项都溢出、缩放域里恰抵消为 0）。
    const mr = a1 * c1 - b1 * d1, mi = a1 * d1 + b1 * c1
    const mf = f1[0] * f2[0], me = f1[1] + f2[1]
    const mulS = [scalbn2(mr * mf, me), scalbn2(mi * mf, me)]
    let qr, qi
    if (Math.abs(c1) >= Math.abs(d1)) {
      const r = d1 / c1, den = c1 + d1 * r
      qr = (a1 + b1 * r) / den; qi = (b1 - a1 * r) / den
    } else {
      const r = c1 / d1, den = c1 * r + d1
      qr = (a1 * r + b1) / den; qi = (b1 * r - a1) / den
    }
    const df = f1[0] / f2[0], de = f1[1] - f2[1]
    const divS = [scalbn2(qr * df, de), scalbn2(qi * df, de)]
    // 主路径（第二十一轮复审）：四项乘积各走 prodT 缩放——单个复数
    // 内部相差极大的分量（1e308 与 1e-308）在缩放域里除以最大值会
    // 先下溢丢失，逐项算才保得住（[1e308,1e-308]×[1,0] 的虚部、
    // [1e308,1e-308]×[1e-308,−1e308] 的实部 2）。任一积项非有限
    // （真溢出或双双溢出相消）时回退缩放域结果。
    const t1 = prodT(a, c), t2 = prodT(b, d), t3 = prodT(a, d), t4 = prodT(b, c)
    mul = [
      (isFinite(t1) && isFinite(t2)) ? t1 - t2 : mulS[0],
      (isFinite(t3) && isFinite(t4)) ? t3 + t4 : mulS[1]
    ]
    // 除法同理：分子 = z1·conj(z2) 逐项算，分母 |z2|² 用缩放域的
    // (c1² + d1²)·f2² × 2^(2e2) 表示、最后 scalbn 还原。
    const u1 = t1, u2 = t2, u3 = t4, u4 = t3 // ac、bd、bc、ad
    const numRe = u1 + u2, numIm = u3 - u4
    if (isFinite(u1) && isFinite(u2) && isFinite(u3) && isFinite(u4) && isFinite(numRe) && isFinite(numIm)) {
      const denF = (c1 * c1 + d1 * d1) * f2[0] * f2[0]
      div = [scalbn2(numRe / denF, -2 * f2[1]), scalbn2(numIm / denF, -2 * f2[1])]
    } else {
      div = divS
    }
  } else if (S2 !== 0) {
    div = [0, 0] // z1 是 0、z2 非 0
  }
  const mag = function (x, y) {
    const m = Math.max(Math.abs(x), Math.abs(y))
    if (m === 0) return 0
    const s = Math.min(Math.abs(x), Math.abs(y)) / m
    return m * Math.sqrt(1 + s * s)
  }
  return {
    type: 'ok',
    add: [a + c, b + d], sub: [a - c, b - d],
    mul: mul, div: div,
    mag1: mag(a, b), mag2: mag(c, d)
  }
}

// 韦达定理与弦长（2026-11-15 新增，用户点名）：直线 y = kx + m 与圆
// 锥曲线联立后的一元二次 ax² + bx + c = 0（a ≠ 0），x1、x2 为交点横
// 坐标。判别式 Δ 与 |x1−x2| 都走 (尾数, 指数) 缩放计算（见函数内
// 注）：第一版按最大系数归一化、系数悬殊时小系数下溢丢失（第二十
// 一轮）；第二版 scalbn2 还原又栽在重根 ∞·0 与极小 dn 上（第二十
// 轮）。弦长 = √(1+k²)·|x1−x2|，√(1+k²) 用稳定式防 k² 溢出。Δ
// 真超双精度才返回 Infinity，原样返回由页面单独处理。
function vietaOf(a, b, c, k) {
  if (![a, b, c, k].every(isFinite)) return { error: '有数不对' }
  if (a === 0) return { error: 'a 不能是 0（不是二次方程）' }
  // Δ = b² − 4ac 改 (尾数, 指数) 累加（第二十一轮复审）：旧法先把系
  // 数除以最大系数 sc，系数间相差超 1e308 时小系数直接下溢成 0——
  // vietaOf(1e308, 0, 1e-308) 真 Δ = −4、无实根，却被算成 Δ = 0 误
  // 判重根（符号都错）。逐项缩放累加后 Δ 的正负与量级都保得住；
  // |x1−x2| = √Δ/|a| 也从 (尾数, 指数) 直接开方再除 |a| 的尾数。
  const st = [0, 0]
  if (b !== 0) { const fb = frexp2(Math.abs(b)); expAdd(st, fb[0] * fb[0], 2 * fb[1]) }
  if (c !== 0) {
    const fa = frexp2(Math.abs(a)), fc = frexp2(Math.abs(c))
    expAdd(st, -4 * fa[0] * fc[0] * ((a < 0) !== (c < 0) ? -1 : 1), fa[1] + fc[1])
  }
  let diffAbs = null, chord = null
  if (st[0] > 0) {
    let sm, se
    if (st[1] % 2 === 0) { sm = Math.sqrt(st[0]); se = st[1] / 2 }
    else { sm = Math.sqrt(2 * st[0]); se = (st[1] - 1) / 2 }
    const fa = frexp2(Math.abs(a))
    diffAbs = scalbn2(sm / fa[0], se - fa[1])
    const ak = Math.abs(k)
    const hyp = ak >= 1 ? ak * Math.sqrt(1 + (1 / ak) * (1 / ak)) : Math.sqrt(1 + ak * ak)
    chord = isFinite(diffAbs) ? prodT(hyp, diffAbs) : Infinity
  } else if (st[0] === 0) {
    diffAbs = 0
    chord = 0
  }
  return {
    type: 'ok', disc: expVal(st), discNeg: st[0] < 0,
    sum: -b / a, prod: c / a, diffAbs: diffAbs, chord: chord
  }
}

export default {
  solveRightTri: solveRightTri,
  permComb: permComb,
  seqSolve: seqSolve,
  solveTriangle: solveTriangle,
  statsOf: statsOf,
  distOf: distOf,
  vecOf: vecOf,
  cplxOps: cplxOps,
  vietaOf: vietaOf
}
