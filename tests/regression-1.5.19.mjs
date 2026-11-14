// regression-1.5.19.mjs — 第十三轮复审（对 1.5.18）核实成立的 2 项修复回归。
// 【1.5.19 同版修订（版本号不变，仍 1.5.19/vc58，用户拍板）】
//  修订一 · 显示层收口：1.5.19 初版的分层钉注（§1h/§4d）把「保留下来的
//    极小精确差在 formatDisplay 仍显示 0」记为显示层既有边界；同版修订
//    将其收口——formatDisplay 在归零分支加「精确微差救援」（isShortMantissa：
//    尾数去尾零后 <2^8、即有效位 ≤8 位才放行）。§1h/§4d 两条钉注的期望
//    因此由 '0' 修订为课本式科学计数实测值（旧值→新值逐条列于 §7 头注），
//    其余既有断言期望一律未动。
//  修订二 · 绘图极端参数卡死：二次函数 a=1、b=−2e15/−2e15−4/−2e17（经
//    openPlot/drawPlot）旧版 8 秒不返回。注入计数定位实证：b=−2e15 族卡
//    在 Y 轴刻度循环（k≈−5e33、k++ 不再前进，Y 循环 300 万次不退出、X
//    循环仅 11 次），b=−2e17 卡在 X 轴刻度循环（k≈5e16 > 2^53）。修法：
//    两轴刻度 k 循环各加推进守卫（推进值不严格变大即跳出）＋迭代上限
//    1000 兜底。§8 钉三组参数的返回时限与标签数组；正常基线沿用 §5。
//  修订三 · 极端尺度刻度标签过长（B-03 实际布局半）：fmtTick 的步长自
//    适应在极端尺度把有效数字推到 15 位——H 例 Y 标签 −2.499999995×10²⁰
//    （18 字）/−2.49999999499999×10²⁰（23 字）、X 标签 15 字，塞进
//    24–26px 定宽标签框逐字竖排、重叠不可读（velasim 实测）。修法：
//    fmtTick 科学计数分支在 |E|≥10（|v|≥1e10 或 0<|v|<1e-10）时把
//    digs 封顶 5 位（去尾零沿用 trimSci），标签如 −2.5×10²⁰（9 字）；
//    中等尺度（|E|<10）步长自适应不动（§9j 钉 1.5.16 的 1e9 量级、步长
//    2e-4 用例逐字不变）。封顶后不可分辨的相邻刻度由 buildPlot 既有去
//    重翻步长＋减量兜底收口，去重/兜底机制本身未动。
//    【Y 轴个数口径——与简报字面的出入，在此明示】简报要求 H 例 Y 轴恰
//    2 个短标签，实测收口为 1 个：H 例 Y 窗 [−2.4999999950000013e20,
//    −2.499999994999988e20] 宽仅 1.33e6、最终两刻度值仅差 1e6，而 5 位
//    有效数字在 2.5e20 量级的分辨率是 1e16——任何 ≤10 字标签都无法区
//    分相差 1e6 的两个值（区分须 ≥12 位有效数字、标签 ≥17 字，与短标
//    签目标互斥）。窗口内两刻度在短标签下必然同文，减量兜底减为 1 个
//    −2.5×10²⁰ 是唯一诚实结果，§9e 按实测钉住，待主代理裁定。
//    既有断言修订清单（仅此九条，逐条旧值→新值）：
//      本文件 §5f Y 标签 ['1×10¹⁵','1.00000000000001×10¹⁵'] → ['1×10¹⁵']
//        （15 位尾数对在 5 位封顶下同文、兜底减量）
//      本文件 §5g H 例 Y 标签数 ≥2 → ==1（理由见上 Y 轴口径）
//      本文件 §5i tickY 与 labY 同数 → '2/1'（兜底减量后记号与标签数脱钩）
//      regression-1.5.18 §5a H 例 Y 标签数 ≥2 → ==1（同上）
//      regression-1.5.18 §5d tickY 与 labY 同数 → '2/1'（同上）
//      regression-1.5.18 §6a '−1.7976931348623×10³⁰⁸' → '−1.7977×10³⁰⁸'（封顶 5 位）
//      regression-1.5.18 §6c 最坏标签长度 21 → 6（同上）
//      regression-1.5.16 §12a 最坏标签长度 21 → 6（同上）
//      regression-1.5.17 §7b 最坏标签长度 21 → 6（同上）
//  修复一（P1）求值层吸附误吞真实小差值：1.5.18 的吸附只有相对阈值
//    （|结果| ≤ max(|左|,|右|)×2^-50 → 归零），用户手打字面量的精确差
//    一并被吞：1.0000000000000002−1 求值给 0（真值 2^-52，Sterbenz 条
//    件下减法精确）。复审方独立提取 calc.js 执行复现，我方亲验属实。
//    定版修法 = 误差来源追踪（taint）：求值链中的值带 dirty 标记——
//    字面量 clean；一步加/减产出的值 dirty 当且仅当该步 TwoSum 误差
//    err≠0 或任一操作数已 dirty；标记沿括号/一元/后缀/乘除/^ 透传；
//    吸附在原阈值条件上追加「本步 dirty」才触发。0.1+0.2 首步 err≠0
//    → 链条 dirty → −0.3 残差照旧吸附；全程精确的链条不许动。
//    口径钉注：0.30000000000000004−0.3 保留 5.551115123125783e-17——
//    两个操作数都是用户手打字面量、减法本身精确（err=0），「手打即
//    精确」，与 0.1+0.2−0.3（中间步先产生舍入）来源不同、处置不同。
//    混合链钉注：0.1+(0.2−0.3) 与 (0.2−0.3)+0.1 均 = 2^-55
//    （2.7755575615628914e-17）：0.2−0.3 的 TwoSum 误差恰为 0（两字
//    面量的双精度差可精确表示）、末步误差亦 0，全程无舍入 → clean →
//    不吸附。这是 taint 原理的必然后果（与 (0.1+0.2)−0.3 的不对称来
//    自舍入发生的位置），按实测如实钉住，不为凑「应为 0」改实现。
//    显示分层钉注：上述保留下来的极小差值（2^-52 级、2^-55 级）在主
//    显示 formatDisplay 仍给 '0'——那是 cleanNum 的 12 位可表示性判
//    别（与 sin 尾巴同族、1.5.18 分层时明示不动），属显示层既有边
//    界、非本轮范围；求值层真值已对，续算（如 ×10^10）结果正确且
//    显示正常。本文件 §1/§4 各钉一条该分层事实，防未来误读为回归。
//  修复二（P2）绘图刻度去重退出漏洞：两轴循环退出条件
//    `!labDup(l) || l.length <= 2` 使标签只剩 2 个时哪怕仍重复也收
//    工（复审方静态查出）。修法：循环退出后若仍重复，减到 1 个标
//    签（取中点那个）。触发输入构造说明：经 drawPlot/openPlot 用户
//    路径试构造，lin2 大截距族去重均正常收敛、quad2 顶点 1e15 级
//    候选实测超时未返回（既有问题、与本轮无关，已在交付报告中单
//    列），故按定版备用口径用页面自身方法 buildPlot 的合成量程钉
//    住退出路径（buildPlot 与 drawPlot/openPlot 共用同一实现）。
// 章节：1 P1 攻击集 2 原 B-01 验收集 3 守卫 4 混合链（taint 不对称）
//       5 B-02 合成量程＋基线 6 版本锁与落点审计
//       7 同版修订一（显示层精确微差救援）8 同版修订二（绘图卡死守卫）
//       9 同版修订三（极端尺度短标签封顶）
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }
const E = (s, o) => calc.evaluate(s, o)
const FD = (v) => calc.formatDisplay(v)
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
const calcSrc = readFileSync(new URL('../src/common/calc.js', import.meta.url), 'utf8')
function loadPage(storageImpl) {
  let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
  globalThis.__storage = storageImpl
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__calc = calc
  globalThis.__paykey = { keyMatches: () => false, normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), shortCodeForDevice: () => 'AAAAAA' }
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  const pageMod = { exports: {} }
  new Function('module', 'exports', script)(pageMod, pageMod.exports)
  return pageMod.exports
}
const memStore = {}
const def = loadPage({ get(o) { o.success(memStore[o.key] || '') }, set(o) { memStore[o.key] = o.value } })
function makeInst(pageDef) {
  const d = pageDef || def
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(d.data)))
  for (const k of Object.keys(d)) if (typeof d[k] === 'function') inst[k] = d[k].bind(inst)
  inst.onInit()
  inst.unlocked = true // 与真机已解锁状态一致，绕开付费门（本文件不测付费行为）
  return inst
}
function eqSolveLines(e1, e2) {
  const inst = makeInst()
  inst.eqExpr = e1; inst.eqExpr2 = e2 || ''
  inst.eqSolve()
  return inst.eqLines
}
function drawPlot(type, vals) {
  const i = makeInst()
  i.plotType = type; i.plotVals = vals
  i.drawPlot()
  return i
}
function buildSynth(f, x0, x1) {
  const i = makeInst()
  i.buildPlot({ f: f, x0: x0, x1: x1, title: 't', keyPts: [], lines: [], back: 'plotcfg' })
  return i
}
function dupAdj(labs) { for (let j = 1; j < labs.length; j++) if (labs[j] === labs[j - 1]) return true; return false }

// ---------- 1) P1 攻击集：手打字面量精确小差不许再被吸附 ----------
eq('1a 1.0000000000000002−1 = 2^-52', E('1.0000000000000002−1'), 2.220446049250313e-16)
eq('1b 1.0000000000000004−1 = 2^-51', E('1.0000000000000004−1'), 4.440892098500626e-16)
eq('1c 1.0000000000000009−1 = 2^-50', E('1.0000000000000009−1'), 8.881784197001252e-16)
eq('1d 1−0.9999999999999999 = 2^-53', E('1−0.9999999999999999'), 1.1102230246251565e-16)
ok('1e (1.0000000000000002−1)×10^10 非零且数值正确', E('(1.0000000000000002−1)×10^10') !== 0 && Math.abs(E('(1.0000000000000002−1)×10^10') / 2.220446049250313e-6 - 1) < 1e-12)
eq('1f 放大后显示正常（12 位）', FD(E('(1.0000000000000002−1)×10^10')), '0.00000222044604925')
eq('1g 手打即精确：0.30000000000000004−0.3 = 2^-54', E('0.30000000000000004−0.3'), 5.551115123125783e-17)
eq('1h 【同版修订】裸 2^-52 经 formatDisplay 显示实测值（原钉注 0 → 精确微差救援收口，见 §7）', FD(E('1.0000000000000002−1')), '2.22044604925×10⁻¹⁶')

// ---------- 2) 原 B-01 验收集全量（1.5.18 口径不回退） ----------
eq('2a A 1×10⁻¹⁶÷3 显示真商', FD(E('1×10⁻¹⁶÷3')), '3.33333333333×10⁻¹⁷')
eq('2b A2 1×10⁻¹⁶÷7 显示真商', FD(E('1×10⁻¹⁶÷7')), '1.42857142857×10⁻¹⁷')
eq('2c A3 1×10⁻¹⁸×3 显示', FD(E('1×10⁻¹⁸×3')), '3×10⁻¹⁸')
eq('2d B 0.1+0.2−0.3 求值即 0（dirty 链残差照旧吸附）', E('0.1+0.2−0.3'), 0)
eq('2e B 显示 0', FD(E('0.1+0.2−0.3')), '0')
eq('2f B2 (0.1+0.2−0.3)×10^10 求值即 0', E('(0.1+0.2−0.3)×10^10'), 0)
eq('2g C 接力 10÷3×3 恰 10', E('10÷3×3'), 10)
eq('2h C2 1×10⁻¹⁶÷3×3 恰 1e-16', E('1×10⁻¹⁶÷3×3'), 1e-16)

// ---------- 3) 守卫 ----------
eq('3a 1e-17+1e-17 同尺度合法小量', E('1×10⁻¹⁷+1×10⁻¹⁷'), 2e-17)
eq('3b 0+1e-17 结果即操作数', E('0+1×10⁻¹⁷'), 1e-17)
ok('3c (1+1e-13)−1 合法差不吸附', E('(1+1×10⁻¹³)−1') !== 0)
eq('3d sin(180°) 尾巴显示仍 0（函数路径不经吸附）', FD(E('sin(180)')), '0')
eq('3e 0.1+0.2 显示 0.3', FD(E('0.1+0.2')), '0.3')
eq('3f 百分号惯例 200−10% 不变', E('200−10%'), 180)
eq('3g 普通减法 0.3−0.1 原值不变', E('0.3−0.1'), 0.19999999999999998)
eq('3h 3e-17−1e-17 显示不变', FD(E('3×10⁻¹⁷−1×10⁻¹⁷')), '2×10⁻¹⁷')
eq('3i 方程路径未串改：0+1e-17=0 仍判不相等', eqSolveLines('0+0.00000000000000001=0')[0], '两边不相等')

// ---------- 4) 混合链：taint 不对称（全程精确 → 不吸附） ----------
eq('4a 前提：0.2−0.3 本身精确（双精度差可精确表示）', E('0.2−0.3'), -0.09999999999999998)
eq('4b 0.1+(0.2−0.3) = 2^-55（无舍入步、不吸附）', E('0.1+(0.2−0.3)'), 2.7755575615628914e-17)
eq('4c (0.2−0.3)+0.1 = 2^-55（同上）', E('(0.2−0.3)+0.1'), 2.7755575615628914e-17)
eq('4d 【同版修订】2^-55 经 formatDisplay 显示实测值（原钉注 0 → 精确微差救援收口，见 §7）', FD(E('0.1+(0.2−0.3)')), '2.77555756156×10⁻¹⁷')

// ---------- 5) B-02：合成量程退出路径＋正常基线 ----------
{
  // 修复前实测：X/Y 均为 ['1×10¹⁵','1×10¹⁵']（剩 2 个仍重复、旧逻辑收工）
  const b = buildSynth((x) => x, 999999999999997, 1000000000000007)
  const xl = b.plotLabX.map((t) => t.lab), yl = b.plotLabY.map((t) => t.lab)
  ok('5a 双轴合成量程：X 无相邻重复', !dupAdj(xl))
  ok('5b 双轴合成量程：Y 无相邻重复', !dupAdj(yl))
  eq('5c 双轴合成量程：X 减到 1 个标签', JSON.stringify(xl), JSON.stringify(['1×10¹⁵']))
  eq('5d 双轴合成量程：Y 减到 1 个标签', JSON.stringify(yl), JSON.stringify(['1×10¹⁵']))
}
{
  // 修复前实测：X = ['1×10¹⁵','1×10¹⁵'] 重复退出；Y 本就 2 个互异、不应被动
  // 【同版修订三】Y 的 15 位尾数对（1×10¹⁵ 与 1.00000000000001×10¹⁵，相差
  // 仅 10）在 5 位封顶下同文不可分辨，去重＋兜底同样减为 1 个（机制未动）
  const b = buildSynth((x) => x, 999999999999998, 1000000000000008)
  const xl = b.plotLabX.map((t) => t.lab), yl = b.plotLabY.map((t) => t.lab)
  eq('5e X 单轴触发：X 减到 1 个标签', JSON.stringify(xl), JSON.stringify(['1×10¹⁵']))
  eq('5f 【同版修订三】Y 短标签不可分辨、兜底减为 1 个（旧期望两互异长标签，见 §9 头注）', JSON.stringify(yl), JSON.stringify(['1×10¹⁵']))
}
{
  // H 例（1.5.18 基线）：收敛为 2 个互异标签、不触发减量，行为逐字不变
  // 【同版修订三】短标签封顶后 Y 两刻度同文、触发减量兜底（见 §9 头注）
  const h = drawPlot('quad2', { a: '0.001', b: '999999999', c: '0', k: '1', A: '1' })
  const ylabs = h.plotLabY.map((t) => t.lab)
  const xlabs = h.plotLabX.map((t) => t.lab)
  ok('5g 【同版修订三】H 例 Y 标签两两不同（' + ylabs.join(',') + '）（旧期望 ≥2 个长标签；短标签下兜底收口为 1 个，见 §9 头注）', new Set(ylabs).size === ylabs.length && ylabs.length === 1)
  ok('5h H 例 X 标签两两不同', new Set(xlabs).size === xlabs.length)
  eq('5i 【同版修订三】H 例刻度记号/标签数（旧期望同数；兜底后 tick 2 / lab 1）', h.plotTickY.length + '/' + h.plotLabY.length, '2/1')
}
{
  // 正常参数基线（与 regression-1.5.18 §5 同款）：计数与标签逐字不变
  const q = drawPlot('quad2', { a: '1', b: '2', c: '1', k: '1', A: '1' })
  eq('5j 正常二次 labX/labY 计数不变', q.plotLabX.length + '/' + q.plotLabY.length, '7/8')
  eq('5k 正常二次 Y 标签逐字不变', JSON.stringify(q.plotLabY.map((t) => t.lab)), JSON.stringify(['2', '4', '6', '8', '10', '12', '14', '16']))
  const l = drawPlot('lin2', { a: '1', b: '1', c: '0', k: '2', A: '1' })
  eq('5l 正常一次 labX/labY 计数不变', l.plotLabX.length + '/' + l.plotLabY.length, '7/8')
  const s = drawPlot('sin', { a: '1', b: '0', c: '0', k: '1', A: '1' })
  eq('5m 正常正弦 labX/labY 计数不变', s.plotLabX.length + '/' + s.plotLabY.length, '7/10')
}

// ---------- 6) 版本锁与落点审计 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  eq('6a manifest 版本锁 1.5.19/vc58', mf.versionName + '/' + mf.versionCode, '1.5.19/58')
}
ok('6b 吸附 taint 条件落点（stepDirty 前置）', calcSrc.includes('stepDirty && s !== 0'))
ok('6c B-02 减量兜底落点（X）', ux.includes('if (labDup(lX)) lX = [lX[Math.floor(lX.length / 2)]]'))
ok('6d B-02 减量兜底落点（Y）', ux.includes('if (labDup(lY)) lY = [lY[Math.floor(lY.length / 2)]]'))

// ---------- 7) 同版修订一：显示层精确微差救援 ----------
// 既有断言修订清单（本节钉注，交付报告同步披露，仅此三条）：
//   §1h 旧期望 '0' → 新期望 '2.22044604925×10⁻¹⁶'（理由：本节收口对象本身）
//   §4d 旧期望 '0' → 新期望 '2.77555756156×10⁻¹⁷'（同上）
//   regression-1.5.18 §3e 旧期望 '0' → 新期望 '5.55111512313×10⁻¹⁷'：该条把
//   裸 JS 残差双精度值（2^-54）直喂 formatDisplay，与本文件 §7a 的手打精确
//   差是同一个双精度值、无状态显示层不可区分，两条旧期望不可兼得；尾巴
//   防线本就在求值层 taint（经 evaluate 的 0.1+0.2−0.3 显示仍 0，§7e 钉住）
eq('7a 手打差显示', FD(E('0.30000000000000004−0.3')), '5.55111512313×10⁻¹⁷')
eq('7b 负微差显示（尾数负号 U+2212）', FD(E('1−1.0000000000000002')), '−2.22044604925×10⁻¹⁶')
eq('7c 不误放：sin(π) 弧度制尾巴（53 位尾数）仍 0', FD(E('sin(π)', { deg: false })), '0')
eq('7d 不误放：√2×10⁻¹⁷ 无理缩放（53 位尾数）仍 0', FD(Math.SQRT2 * 1e-17), '0')
eq('7e 不误放：0.1+0.2−0.3 求值层已吸附、显示仍 0', FD(E('0.1+0.2−0.3')), '0')
// 字面量 1×10⁻¹⁷ 现状钉注：1e-17 的双精度值尾数占满 53 位、不经本救援；
// 它本就被 cleanNum 的「12 位可精确表示」判据放行（1.5.6 既定口径），
// 显示为课本式 '1×10⁻¹⁷'——任务简报称其「显示 0」与实测不符，按实测钉住
eq('7f 字面量 1×10⁻¹⁷ 显示（现状钉注：cleanNum 12 位放行、非本救援）', FD(E('1×10⁻¹⁷')), '1×10⁻¹⁷')
eq('7g formatPlain 不走救援（接力/内部表示口径不变）', calc.formatPlain(E('1.0000000000000002−1')), '0')
eq('7h eqSign 回读逻辑未改：微差显示判 ≈', calc.eqSign(E('1.0000000000000002−1')), '≈')
ok('7i 精确微差救援落点（isShortMantissa＋formatDisplay 分支）', calcSrc.includes('function isShortMantissa') && calcSrc.includes('isShortMantissa(v)) return dispMinus'))

// ---------- 8) 同版修订二：绘图极端参数卡死（openPlot 全路径计时） ----------
function openQuad(a, b, c) {
  const inst = makeInst()
  inst.qa = a; inst.qb = b; inst.qc = c
  const t0 = Date.now()
  inst.openPlot('quad')
  return { inst: inst, ms: Date.now() - t0 }
}
for (const [tag, b] of [['8a b=−2e15（Y 循环卡死族）', '-2000000000000000'], ['8b b=−2e15−4（Y 循环卡死族）', '-2000000000000004'], ['8c b=−2e17（X 循环卡死族）', '-200000000000000000']]) {
  const r = openQuad('1', b, '0')
  ok(tag + '：<2 秒返回（实测 ' + r.ms + ' ms）', r.ms < 2000)
  ok(tag + '：图象打开且标签为数组', r.inst.view === 'plot' && Array.isArray(r.inst.plotLabX) && Array.isArray(r.inst.plotLabY))
}
ok('8d 推进守卫落点（X）', ux.includes('if (k === prevKX || ++guardX > 1000) break'))
ok('8e 推进守卫落点（Y）', ux.includes('if (k === prevKY || ++guardY > 1000) break'))

// ---------- 9) 同版修订三：极端尺度短标签封顶（B-03 实际布局半） ----------
// H 例两轴最终标签串原文（本轮实测）：
//   X = ['−5×10¹¹']（7 字）  Y = ['−2.5×10²⁰']（9 字）
// 修订理由与 Y 轴个数口径（简报要求恰 2 个、实测 1 个的数学证明）见文件头
// 修订三段落；既有断言修订九条清单同在头注，本节只钉新口径事实。
function extractFn9(name) {
  const start = ux.indexOf('function ' + name + '(')
  let depth = 0, i = ux.indexOf('{', start)
  for (; i < ux.length; i++) {
    if (ux[i] === '{') depth++
    else if (ux[i] === '}') { depth--; if (depth === 0) return ux.slice(start, i + 1) }
  }
  throw new Error('函数未配平 ' + name)
}
const fmtTick9 = new Function('calc', 'dispNum', extractFn9('dm') + '\n' + extractFn9('trimSci') + '\n' + extractFn9('fmtTick') + '\nreturn fmtTick')(calc, (p) => String(p).replace(/^-/, '−'))
{
  const h = drawPlot('quad2', { a: '0.001', b: '999999999', c: '0', k: '1', A: '1' })
  const xl = h.plotLabX.map((t) => t.lab), yl = h.plotLabY.map((t) => t.lab)
  eq('9a H 例 X 标签原文', JSON.stringify(xl), JSON.stringify(['−5×10¹¹']))
  eq('9b H 例 Y 标签原文', JSON.stringify(yl), JSON.stringify(['−2.5×10²⁰']))
  ok('9c H 例全部标签 ≤10 字', xl.concat(yl).every((s) => s.length <= 10))
  ok('9d H 例两轴标签各自两两不同', new Set(xl).size === xl.length && new Set(yl).size === yl.length)
  eq('9e H 例 Y 标签数（实测 1：两刻度差 1e6 ≪ 5 位分辨率 1e16、短标签下必然同文，兜底收口——与简报「恰 2 个」的出入见头注，待裁定）', yl.length, 1)
}
eq('9f fmtTick 极端最坏值短化（旧 21 字长串）', fmtTick9(9.99999999999999e20, 1e6), '1×10²¹')
eq('9g fmtTick −MAX_VALUE 短化（旧 22 字）', fmtTick9(-Number.MAX_VALUE, 1e292), '−1.7977×10³⁰⁸')
eq('9h fmtTick H 例 Y 终步长（8e5）直钉', fmtTick9(-249999999500000000000, 800000), '−2.5×10²⁰')
eq('9i fmtTick H 例 X 刻度（步长 1e4）直钉', fmtTick9(-500000030000, 10000), '−5×10¹¹')
{
  const vs = [999999999.9998, 999999999.9999, 1000000000, 1000000000.0001, 1000000000.0002]
  eq('9j 中等尺度不封顶：1e9 量级步长 2e-4 标签逐字不变（1.5.16 §7a 同款）', JSON.stringify(vs.map((v) => fmtTick9(v, 0.0002))), JSON.stringify(['9.999999999998×10⁸', '9.999999999999×10⁸', '1×10⁹', '1.0000000000001×10⁹', '1.0000000000002×10⁹']))
}
ok('9k 封顶落点（|E|≥10 → digs≤5）', ux.includes('if (Math.abs(E) >= 10 && digs > 5) digs = 5'))

console.log('regression-1.5.19: pass=' + pass + ' fail=' + fail)
if (fail) process.exit(1)
