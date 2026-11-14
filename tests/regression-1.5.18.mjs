// regression-1.5.18.mjs — 第十二轮复审（对 1.5.17）核实成立的 3 项修复回归。
//  B-01（P1）极小非零结果显示为 0：机制经实跑确认——cleanNum 极小值判别
//    按 12 位回读相对误差（阈值 1e-13）归零，1e-16÷3 的真商相对误差
//    1.0e-12 出界被吞；且 0.1+0.2−0.3 残差（7.6e-13）与真商（1.0e-12）、
//    sin 尾巴（2.2e-12）在该标尺上交错，显示层无状态判别原理上分不开。
//    修复分两层：(1) 求值层 parseExprW 加减步按相对操作数尺度吸附抵消
//    残差（阈值 2^-50≈8 ulp，乘除定标不吸附）；(2) 显示层 formatDisplay
//    对 cleanNum 已归零的极小值做真商救援（isTinyQuotient：v×k 对小整数
//    k 恰为 ≤3 位有效数字的干净十进制数且除回分毫不差）。cleanNum 本身
//    与 formatPlain（接力口径）不动；1.5.6「C 口径记录」与 1.5.12 的
//    cleanNum 直钉断言已按本轮口径修订/保持（见各文件 1.5.18 修订注）。
//  B-02（P2）极端抛物线 Y 轴标签重复：a=0.001、b=999999999 时 Y 轴 7 个
//    标签只有 2 种文本（实跑复现与复审报告逐字一致）。根源：扩窗后步长
//    1e5 相对量级 2.5e20 只有 4e-16，低于 15 位有效数字的分辨粒度。
//    修复：buildPlot 生成刻度后若相邻显示标签重复，步长翻倍重算（下限
//    2 个标签防消失）；正常参数首轮即定、刻度数不变（基线逐字比对）。
//  B-03（P3）fmtTick(−Number.MAX_VALUE, 1e292) 旧版 23 字、突破自称的
//    22 字上限：1.5.17 静态推导把「×10」误数 2 字（实 3 字）。修复：
//    fmtTick 尾部加降位循环，超 22 字逐级降有效位数重渲染。另 1.5.17
//    的 7c 与 1.5.16 的 12b 原用例 -9.99999999999999e308 在 JS 中是
//    -Infinity、走「溢出」短串空转，已同步换成 -Number.MAX_VALUE。
// 章节：1 B-01 验收对 2 求值层吸附与守卫 3 尾巴/cleanNum 分层守卫
//       4 接力守卫 5 B-02 6 B-03 7 边界扫掠（覆盖口径见文末注） 8 版本锁
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }
function throws(name, fn) { try { fn(); ok(name, false) } catch (e) { ok(name, true) } }
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
function feedCalc(expr) {
  const i = makeInst()
  i.expr = expr; i.refreshCalc()
  return i
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
function extractFn(name) {
  const start = ux.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('找不到函数 ' + name)
  let i = ux.indexOf('{', start), depth = 0, j = i
  for (; j < ux.length; j++) { if (ux[j] === '{') depth++; else if (ux[j] === '}') { depth--; if (!depth) break } }
  return ux.slice(start, j + 1)
}
const valEndMatch = ux.match(/const VAL_END = '([^']*)'/)
const FN = ['dm', 'trimSci', 'dispNum', 'fmtTick']
const F = new Function('calc', 'VAL_END', FN.map(extractFn).join('\n') + '\nreturn { ' + FN.join(', ') + ' }')(calc, valEndMatch[1])
const { fmtTick } = F

// ---------- 1) B-01 验收对：极小真商非零显示 ----------
eq('1a A 1×10⁻¹⁶÷3 显示真商', FD(E('1×10⁻¹⁶÷3')), '3.33333333333×10⁻¹⁷')
eq('1b A2 1×10⁻¹⁶÷7 显示真商', FD(E('1×10⁻¹⁶÷7')), '1.42857142857×10⁻¹⁷')
eq('1c A3 1×10⁻¹⁸×3 守卫（本就正常）', FD(E('1×10⁻¹⁸×3')), '3×10⁻¹⁸')
eq('1d 1×10⁻¹⁶÷1.5 显示真商', FD(E('1×10⁻¹⁶÷1.5')), '6.66666666667×10⁻¹⁷')
eq('1e 2×10⁻¹⁶÷3 显示真商', FD(E('2×10⁻¹⁶÷3')), '6.66666666667×10⁻¹⁷')
eq('1f 负真商带 U+2212', FD(-(1e-16 / 3)), '−3.33333333333×10⁻¹⁷')
eq('1g 主界面结果行（fitResStr 限宽 11 位、连接号 ≈）', feedCalc('1×10⁻¹⁶÷3').resDisp, '≈ 3.333333333×10⁻¹⁷')
eq('1h eqSign 真商判 ≈（显示是 12 位舍入）', calc.eqSign(1e-16 / 3), '≈')

// ---------- 2) 求值层吸附：残差归零、合法小量不误伤 ----------
eq('2a B 0.1+0.2−0.3 求值即 0', E('0.1+0.2−0.3'), 0)
eq('2b B 显示 0', FD(E('0.1+0.2−0.3')), '0')
eq('2c B2 (0.1+0.2−0.3)×10^10 求值即 0（残差在源头吸附、不被放大）', E('(0.1+0.2−0.3)×10^10'), 0)
eq('2d B2 显示 0', FD(E('(0.1+0.2−0.3)×10^10')), '0')
eq('2e B2 主界面（内部 ^ 形）', feedCalc('(0.1+0.2−0.3)×10^10').resDisp, '= 0')
eq('2f 守卫 1e-17+1e-17 同尺度合法小量', E('1×10⁻¹⁷+1×10⁻¹⁷'), 2e-17)
eq('2g 守卫 0+1e-17 结果即操作数', E('0+1×10⁻¹⁷'), 1e-17)
ok('2h 守卫 3e-17−1e-17 不吸附（结果与操作数同量级）', E('3×10⁻¹⁷−1×10⁻¹⁷') !== 0)
eq('2i 守卫 3e-17−1e-17 显示', FD(E('3×10⁻¹⁷−1×10⁻¹⁷')), '2×10⁻¹⁷')
ok('2j 守卫 (1+1e-13)−1 合法差不吸附', E('1.0000000000001−1') !== 0)
eq('2k 守卫百分号惯例 200−10%', E('200−10%'), 180)
eq('2l 守卫普通减法 0.3−0.1 原值', E('0.3−0.1'), 0.19999999999999998)
eq('2m 方程路径未串改：0+1e-17=0 仍判不相等', eqSolveLines('0+0.00000000000000001=0')[0], '两边不相等')

// ---------- 3) 尾巴与 cleanNum 分层守卫 ----------
eq('3a sin(180°) 尾巴仍归零', FD(E('sin(180)')), '0')
eq('3b cos(90°) 尾巴仍归零', FD(E('cos(90)')), '0')
eq('3c 裸 sin 尾巴 formatDisplay 仍 0（判别不放行）', FD(Math.sin(Math.PI)), '0')
eq('3d 裸 cos 尾巴 formatDisplay 仍 0', FD(Math.cos(Math.PI / 2)), '0')
eq('3e 【1.5.19 同版修订】裸残差双精度值 = 2^-54、与手打精确差同值，formatDisplay 按短尾数救援显示（旧期望 0；尾巴防线在求值层 taint、经 evaluate 的同式显示仍 0，见 regression-1.5.19 §7e）', FD(0.1 + 0.2 - 0.3), '5.55111512313×10⁻¹⁷')
eq('3f cleanNum 直钉保持：(1/3)*1e-15 仍 0（1.5.12 口径）', calc.cleanNum((1 / 3) * 1e-15), 0)
eq('3g cleanNum 直钉保持：sin 尾巴原值仍 0', calc.cleanNum(1.2246467991473532e-16), 0)
eq('3h 显示层分层：(1/3)*1e-15 经救援显示', FD((1 / 3) * 1e-15), '3.33333333333×10⁻¹⁶')
eq('3i 无理数缩放不救援（已知残余边界：与旧版同为 0）', FD(Math.SQRT2 * 1e-17), '0')
eq('3j formatPlain 接力口径不变：真商原值仍给 0 串', calc.formatPlain(1e-16 / 3), '0')

// ---------- 4) 接力守卫 ----------
eq('4a C 10÷3×3 恰 10', E('10÷3×3'), 10)
eq('4b C2 1×10⁻¹⁶÷3×3 恰 1e-16', E('1×10⁻¹⁶÷3×3'), 1e-16)
eq('4c C2 显示', FD(E('1×10⁻¹⁶÷3×3')), '1×10⁻¹⁶')

// ---------- 5) B-02 极端抛物线刻度去重 ----------
{
  const h = drawPlot('quad2', { a: '0.001', b: '999999999', c: '0', k: '1', A: '1' })
  const ylabs = h.plotLabY.map((t) => t.lab)
  const xlabs = h.plotLabX.map((t) => t.lab)
  ok('5a 【1.5.19 同版修订二】H 例 Y 标签两两不同（' + ylabs.join(',') + '）（旧期望 ≥2 个长标签；短标签封顶后两刻度差 1e6 远低于 5 位分辨率 1e16、不可分辨，去重＋减量兜底收口为 1 个 −2.5×10²⁰，见 regression-1.5.19 §9 头注）', new Set(ylabs).size === ylabs.length && ylabs.length === 1)
  ok('5b H 例 X 标签两两不同', new Set(xlabs).size === xlabs.length)
  ok('5c H 例全部标签 ≤22 字', ylabs.concat(xlabs).every((s) => s.length <= 22))
  eq('5d 【1.5.19 同版修订二】H 例刻度记号/标签数（旧期望 tickY 与 labY 同数；减量兜底后 tick 记号仍随最终步长 2 个、标签减为 1 个）', h.plotTickY.length + '/' + h.plotLabY.length, '2/1')
}
{
  // 正常参数基线（1.5.17 实测）：首轮即定、计数与标签逐字不变
  const q = drawPlot('quad2', { a: '1', b: '2', c: '1', k: '1', A: '1' })
  eq('5e 正常二次 labX/labY 计数不变', q.plotLabX.length + '/' + q.plotLabY.length, '7/8')
  eq('5f 正常二次 Y 标签逐字不变', JSON.stringify(q.plotLabY.map((t) => t.lab)), JSON.stringify(['2', '4', '6', '8', '10', '12', '14', '16']))
  const l = drawPlot('lin2', { a: '1', b: '1', c: '0', k: '2', A: '1' })
  eq('5g 正常一次 labX/labY 计数不变', l.plotLabX.length + '/' + l.plotLabY.length, '7/8')
  const s = drawPlot('sin', { a: '1', b: '0', c: '0', k: '1', A: '1' })
  eq('5h 正常正弦 labX/labY 计数不变', s.plotLabX.length + '/' + s.plotLabY.length, '7/10')
}

// ---------- 6) B-03 刻度长度硬上限 ----------
eq('6a 【1.5.19 同版修订二】fmtTick(−MAX_VALUE, 1e292)（旧期望 −1.7976931348623×10³⁰⁸、22 字；极端尺度封顶 5 位后 13 字，见 regression-1.5.19 §9 头注）', fmtTick(-Number.MAX_VALUE, 1e292), '−1.7977×10³⁰⁸')
{
  const vs = [Number.MAX_VALUE, -Number.MAX_VALUE, 1e308, -1e308, 1.5e300, -9.99e99, 1e-300, -1e-300, 5e-324, -5e-324, 1.23456789012345e250, -7.7e-77, 9.99999999999999e20, -249999999500000000000]
  const ss = [undefined, 1e292, 1e-290, 5e-324, 1e15, 0.001, 3]
  let worst = 0, worstCase = ''
  for (const v of vs) for (const st of ss) {
    const s = fmtTick(v, st)
    if (s.length > worst) { worst = s.length; worstCase = v + '/' + st + '=' + s }
  }
  ok('6b 极端量级扫掠全 ≤22 字（最坏 ' + worst + '：' + worstCase + '）', worst <= 22)
}
eq('6c 【1.5.19 同版修订二】常规最坏标签（旧期望 21 字 → 6 字：极端尺度封顶 5 位，见 regression-1.5.19 §9 头注）', fmtTick(9.99999999999999e20, 1e6).length, 6)
eq('6d 常规标签不变', fmtTick(-249999999500000000000), '−2.5×10²⁰')

// ---------- 7) 边界扫掠（非有限/溢出/下溢/除零/非法式代表例） ----------
// 覆盖口径（1.5.18 范围裁定）：不做全子系统逐项人工重审，以全套回归全跑
// ＋本节针对性边界扫掠为覆盖；下列每类各取代表例钉在本文件。
throws('7a 除零 1÷0 报错', () => E('1÷0'))
throws('7b 除零 0÷0 报错', () => E('0÷0'))
throws('7c 除零 2÷(1−1) 报错（吸附不掩盖除零）', () => E('2÷(1−1)'))
eq('7d 溢出 10^309 显示溢出', FD(E('10^309')), '溢出')
eq('7e 溢出 1e308×10 显示溢出', FD(E('1e308×10')), '溢出')
eq('7f 次正规数 10^-320 课本式显示', FD(E('10^-320')), '1×10⁻³²⁰')
eq('7g 下溢 1e-300×1e-100 归零', E('1e-300×1e-100'), 0)
throws('7h 非法式 1+ 报错', () => E('1+'))
throws('7i 非法式 ((2) 报错', () => E('((2)'))
throws('7j 定义域 √(负数) 报错', () => E('√(−1)'))
throws('7k 定义域 log(0) 报错', () => E('log(0)'))
throws('7l 空式报错', () => E(''))

// ---------- 8) 版本锁与落点审计 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  eq('8a manifest 版本锁 1.5.18/vc57', mf.versionName + '/' + mf.versionCode, '1.5.18/57')
}
ok('8b 求值层吸附落点（parseExprW 相对尺度）', calcSrc.includes("Math.pow(2, -50)) ? 0 : s"))
ok('8c 显示层救援落点（isTinyQuotient）', calcSrc.includes('function isTinyQuotient(v)'))
ok('8d fmtTick 降位循环落点', ux.includes('out.length > 22 && digs > 2'))
ok('8e buildPlot 标签去重落点', ux.includes('labDup(lY)') && ux.includes('labDup(lX)'))

console.log('regression-1.5.18: pass=' + pass + ' fail=' + fail)
if (fail) process.exit(1)
