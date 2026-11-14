// regression-1.5.16.mjs — 第十一轮复审（对 1.5.15）核实成立的 14 项修复回归。
// 核实底稿见 ~/workspace/band-apps/verify-r11/RESULTS.md（12 项完全成立、
// 第 11 项模拟成立、第 12 项静态成立）。逐项：
//  1 混合整数/小数精度：大整数与小数混合运算的舍入步记污染，结算抛 precision
//  2 sideDangling 补 ASCII '/'，'3x=5/' 不再被改题
//  3 小数点键在完整值结尾补 ×0.（隐式乘法与数字键同规则）
//  4 unitCarryExpr '.' 结尾视作完整数值结尾补 ×
//  5 DP 身份塌缩（舍成 0 或 ±1）时改自适应精度，交点/标题不再显示假 0、假 1
//  6 buildPlot 异常过滤豁免贴边单调段，指数曲线尾部画满 91 点
//  7 fmtTick 科学标签位数随步长自适应，相邻刻度可分辨
//  8 fitResStr 纯整数转科学计数分支补 dm()，负号统一 U+2212
//  9 恒等式零侧地板收紧：无二元减法的一侧不许吸收 1e-17 级尾巴
// 10 单位页极小非零结果改 ≈ 科学计数，不再显示裸 0
// 11 历史 loadHist 代次令牌：在途读回调不得复活已清/已覆盖的数据
// 12 fmtTick 标签硬上限 22 字（15 位有效数字上限推出），静态宽度复核记录
// 13 quadExact 返回精确性标志，非精确恢复的根式行改 ≈、虚根回退数值行
// 14 intDigitsOf 覆盖小数点开头科学计数；eqSolve 采样探针加非 0.5 倍数点
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }
function throws(name, fn) { try { fn(); ok(name, false) } catch (e) { ok(name, true) } }
const E = (s, o) => calc.evaluate(s, o)
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
function loadEsmText(src, names) {
  let s = src.replace(/export function /g, 'function ')
  s += '\nmodule.exports = { ' + names + '}'
  const m = { exports: {} }
  new Function('module', 'exports', s)(m, m.exports)
  return m.exports
}
// [审查仓适配] paykey.js 未公开：缺失时用惰性桩满足页面 harness 拼装；本文件断言不涉及付费校验行为，桩不影响结果。本地原版无此回退。
let paykeyMod
try { paykeyMod = loadEsmText(readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8'), 'normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches') } catch (e) { paykeyMod = { normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), normalizeCode: (s) => String(s == null ? '' : s), shortCodeForDevice: () => 'AAAAAA', keyForShortCode: () => '0000000000', keyMatches: () => false } }
function loadPage(storageImpl) {
  let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
  globalThis.__storage = storageImpl
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__calc = calc
  globalThis.__paykey = paykeyMod
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
  return inst
}
function eqSolveLines(e1, e2) {
  const inst = makeInst()
  inst.eqExpr = e1; inst.eqExpr2 = e2 || ''
  inst.eqSolve()
  return inst.eqLines
}
function extractFn(name) {
  const start = ux.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('找不到函数 ' + name)
  let i = ux.indexOf('{', start), depth = 0, j = i
  for (; j < ux.length; j++) { if (ux[j] === '{') depth++; else if (ux[j] === '}') { depth--; if (!depth) break } }
  return ux.slice(start, j + 1)
}
const valEndMatch = ux.match(/const VAL_END = '([^']*)'/)
const FN = ['dm', 'trimSci', 'fmtTick', 'DP', 'fitResStr', 'hardFit', 'gcd2', 'rMul', 'rSub', 'quadExact', 'sqrtRat', 'radTerm', 'quadRadStrs', 'radAnsStr', 'quadImRad', 'dispNum', 'unitNumStr', 'unitRatioClean', 'buildUnitProc', 'unitCarryExpr']
const F = new Function('calc', 'VAL_END', FN.map(extractFn).join('\n') + '\nreturn { ' + FN.join(', ') + ' }')(calc, valEndMatch[1])
const { fmtTick, DP, fitResStr, quadRadStrs, radAnsStr, unitCarryExpr } = F

// ---------- 1) 混合整数/小数精度 ----------
throws('1a 1e16+0.1−1e16 抛 precision（不再显示 = 0）', () => E('10000000000000000+0.1-10000000000000000'))
throws('1b 1e16×0.1+0.1−1e15 抛 precision', () => E('10000000000000000×0.1+0.1-1000000000000000'))
throws('1c 1e21+1−1e21 仍抛 precision（既有口径）', () => E('1000000000000000000000+1-1000000000000000000000'))
eq('1d 0.1+0.2 正常', E('0.1+0.2'), 0.30000000000000004)
eq('1e 1e16×0.5 精确不误伤', E('10000000000000000×0.5'), 5000000000000000)
eq('1f 1e16÷2 精确不误伤', E('10000000000000000÷2'), 5000000000000000)
eq('1g 1e16÷0.5 精确不误伤', E('10000000000000000÷0.5'), 20000000000000000)
eq('1h 2^64 纯大整数不误伤', E('2^64'), 18446744073709552000)
eq('1i 18! 不误伤', E('18!'), 6402373705728000)
{
  const i = makeInst()
  i.expr = '10000000000000000+0.1-10000000000000000'
  i.refreshCalc()
  eq('1j 页面提示整数超出精确范围', i.resDisp, '整数超出精确范围')
  eq('1k 页面 previewOk=false', i.previewOk, false)
}

// ---------- 2) 方程守卫补 '/' ----------
eq('2a 3x=5/ 报算式有问题', eqSolveLines('3x=5/')[0], '算式有问题，检查括号和符号')
eq('2b 3x=5÷ 行为不变', eqSolveLines('3x=5÷')[0], '算式有问题，检查括号和符号')
eq('2c x+=3 行为不变', eqSolveLines('x+=3')[0], '算式有问题，检查括号和符号')
eq('2d 正常方程不受影响', eqSolveLines('2x=4')[1], 'x = 2')

// ---------- 3) 小数点键隐式乘法 ----------
{
  const i = makeInst()
  i.expr = '(2)'; i.pressKey('.')
  eq('3a (2) 后按 . 补 ×0.', i.expr, '(2)×0.')
  i.pressKey('5'); i.refreshCalc()
  eq('3b (2)×0.5 可算', i.previewVal, 1)
}
{
  const i = makeInst()
  i.expr = '5'; i.pressKey('.')
  eq('3c 正常小数输入不变', i.expr, '5.')
  const j = makeInst()
  j.expr = '3.5'; j.pressKey('.')
  eq('3d 已有小数点不重复', j.expr, '3.5')
  const k = makeInst()
  k.expr = '50%'; k.pressKey('.'); k.pressKey('5'); k.refreshCalc()
  eq('3e 50% 后 .5 → 50%×0.5', k.expr + '=' + k.previewVal, '50%×0.5=0.25')
  const m = makeInst()
  m.expr = '(2+3)'; m.pressKey('.'); m.pressKey('5'); m.refreshCalc()
  eq('3f (2+3)×0.5 = 2.5', m.previewVal, 2.5)
}

// ---------- 4) 带回拼接 '.' 结尾 ----------
eq('4a 5. 带回补 ×', unitCarryExpr('5.', '2', '1000'), '5.×(2)')
eq('4b 5. 带回可算且与 5 一致', E(unitCarryExpr('5.', '2', '1000')), E(unitCarryExpr('5', '2', '1000')))
eq('4c 5.0 路径不变', unitCarryExpr('5.0', '2', '1000'), '5.0×(2)')

// ---------- 5) DP 自适应精度 ----------
eq('5a DP(-1e-7) 显示量级', DP(-0.0000001), '−1×10⁻⁷') // 1.5.17 修订：课本式
eq('5b DP(1.00000001) 不塌成 1', DP(1.00000001), '1.00000001')
eq('5c DP(0.000012345) 不舍成 0', DP(0.000012345), '0.000012345')
eq('5d DP(-2.5) 简洁不变', DP(-2.5), '−2.5')
eq('5e DP 顶点 4 位小口径不变', DP(-0.5158730158730159), '−0.5159')
{
  const i = makeInst()
  i.unlocked = true; i.plotType = 'inv'; i.plotVals = { a: '1', b: '0', c: '0', k: '0.0000001', A: '1' }
  i.drawPlot()
  eq('5f 反比例标题不塌成 0', i.plotTitle, 'y = 1×10⁻⁷ / x') // 1.5.17 修订：课本式
  const j = makeInst()
  j.unlocked = true; j.plotType = 'exp'; j.plotVals = { a: '1.00000001', b: '0', c: '0', k: '1', A: '1' }
  j.drawPlot()
  eq('5g 指数标题不塌成 1', j.plotTitle, 'y = 1.00000001ˣ')
  const m = makeInst()
  m.unlocked = true; m.plotType = 'lin2'; m.plotVals = { a: '1', b: '-0.0000001', c: '0', k: '1', A: '1' }
  m.drawPlot()
  eq('5h 交点显示 −1e-7 量级', m.plotLines[0], '与 y 轴交点 (0, −1×10⁻⁷)') // 1.5.17 修订：课本式
}

// ---------- 6) 指数曲线不被截断 ----------
function plotPtsLen(type, vals) {
  const i = makeInst()
  i.unlocked = true; i.plotType = type; i.plotVals = vals
  i.drawPlot()
  return i.plotPts.length
}
eq('6a y=10ˣ 画满 91 点', plotPtsLen('exp', { a: '10', b: '0', c: '0', k: '1', A: '1' }), 91)
eq('6b y=0.1ˣ 画满 91 点', plotPtsLen('exp', { a: '0.1', b: '0', c: '0', k: '1', A: '1' }), 91)
eq('6c 底数 999999999 画满 91 点', plotPtsLen('exp', { a: '999999999', b: '0', c: '0', k: '1', A: '1' }), 91)
ok('6d 反比例渐近过滤不回归（91 点被拆段）', plotPtsLen('inv', { a: '1', b: '0', c: '0', k: '1', A: '1' }) < 91)

// ---------- 7+12) fmtTick 分辨率与标签上限 ----------
{
  const vs = [999999999.9998, 999999999.9999, 1000000000, 1000000000.0001, 1000000000.0002]
  const labs = vs.map((v) => fmtTick(v, 0.0002))
  ok('7a 1e9 量级步长 2e-4 相邻标签互不相同（' + labs.join(',') + '）', new Set(labs).size === labs.length)
  ok('7b 标签长度 ≤22 字硬上限', labs.every((s) => s.length <= 22))
}
eq('7c 常规短标签不回归', fmtTick(-249999999500000000000, 5e19), '−2.5×10²⁰') // 1.5.17 修订：课本式
eq('7d 无步长维持 2 位', fmtTick(-249999999500000000000), '−2.5×10²⁰') // 1.5.17 修订：课本式
eq('7e 纯文本标签不回归', fmtTick(0.5), '0.5')
eq('7f 百万标签不回归', fmtTick(1000000), '1×10⁶') // 1.5.17 修订：课本式
eq('7g 微小刻度不回归', fmtTick(0.000012345, 0.00001), '1.2×10⁻⁵') // 1.5.17 修订：课本式
// 12 静态复核记录：最坏标签 = 15 位有效数字上限推出 22 字
//（1.5.17 修订推导：课本式 = 符号 1＋尾数 16＋「×10」2＋上标指数 ≤3，
// 与 e 形的 22 字上限恰相同）；按 RESULTS.md 同款估算（约 5–6px/字）
// 1.5.18 更正（B-03）：上推导把「×10」误数 2 字（实 3 字），极端标签实际
// 23 字；22 字上限改由 fmtTick 尾部降位循环强制保证，本节 12b 已换真值用例
// ≈ 110–132px，远超 24–26px 标称格宽——病理窗口下标签会溢出标称格向
// 图内延伸，真机可读性留真机验收，静态不下结论
eq('12a 最坏标签字符数', fmtTick(9.99999999999999e20, 1e6).length, 21) // 1.5.17 修订：课本式（尾数 16＋「×10」2＋上标 2＋符号 1）比 e 形长 1 字
ok('12b 15 位上限标签 ≤22 字', fmtTick(-Number.MAX_VALUE, 1e292).length <= 22) // 1.5.18 修订：原用例 -9.99999999999999e308 为 -Infinity、断言空转（第十二轮复审实证），换真实有限最大值；上限由 fmtTick 降位循环兜底（B-03）

// ---------- 8) fitResStr 负号统一 ----------
{
  const s = fitResStr(-1234567890123456, false)
  eq('8a 纯整数科学计数负号 U+2212', s, '−1.2346×10¹⁵') // 1.5.17 修订：课本式
  ok('8b 无 ASCII 负号打头', !s.startsWith('-'))
}

// ---------- 9) 恒等式容差收紧 ----------
eq('9a 0+1e-17=0 判不相等', eqSolveLines('0+0.00000000000000001=0')[0], '两边不相等')
eq('9b 1e-17=0 判不相等', eqSolveLines('1e-17=0')[0], '两边不相等')
eq('9c 0.1+0.2=0.3 仍判相等', eqSolveLines('0.1+0.2=0.3')[0], '两边相等：恒等式')
eq('9d 相消尾巴仍判相等', eqSolveLines('0.1+0.2−0.3=0')[0], '两边相等：恒等式')

// ---------- 10) 单位页极小结果 ----------
{
  const i = makeInst()
  i.catIdx = 4; i.unitFromId = 's'; i.unitToId = 'wk'; i.unitVal = '0.0000000001'
  i.unitCompute()
  eq('10a 1e-10 秒→周 显示 ≈ 科学计数', i.unitRes, '≈ 1.65×10⁻¹⁶') // 1.5.17 修订：课本式
  const j = makeInst()
  j.catIdx = 0; j.unitFromId = 'm'; j.unitToId = 'km'; j.unitVal = '1500'
  j.unitCompute()
  eq('10b 正常量级不回归', j.unitRes, '1.5')
}

// ---------- 11) 历史竞态（可控延迟假 storage，复刻 verify-r11 时序） ----------
{
  const pending = []
  const store = {}
  const raceDef = loadPage({
    get(o) { pending.push(o) },
    set(o) { store[o.key] = o.value }
  })
  const i = makeInst(raceDef)
  i.loadHist()
  i.clearHist()
  pending.splice(0).forEach((o) => o.success(JSON.stringify([{ expr: '1+1', res: '2' }])))
  eq('11a 清空后在途旧回调不复活', i.hist.length, 0)
  i.loadHist()
  i.hist = [{ expr: '9+9', res: '18' }]
  i.saveHist()
  pending.splice(0).forEach((o) => o.success(JSON.stringify([{ expr: '1+1', res: '2' }])))
  eq('11b 保存后在途旧回调不冲新记录', i.hist.length === 1 && i.hist[0].expr, '9+9')
}

// ---------- 13) 根式精确门口径 ----------
{
  const r = calc.solveQuad(0.3333333334, -3, 1)
  const rads = quadRadStrs(0.3333333334, -3, 1, r.x1, r.x2)
  eq('13a 非精确恢复标志 exact=false', rads && rads.exact, false)
  ok('13b 根式行带 ≈', (radAnsStr('x', r.x1, rads && rads.x1, 27, rads && rads.exact) || '').startsWith('x ≈ '))
  const lines = eqSolveLines('0.3333333334x²−3x+1=0')
  ok('13c 方程页根式行带 ≈（' + lines[2] + '）', lines.some((l) => l.indexOf('x1 ≈ ') === 0))
  const exactLines = eqSolveLines('x²−2=0')
  ok('13d 精确系数根式等号不回归（' + exactLines[2] + '）', exactLines.some((l) => l.indexOf('x1 = √2') === 0))
  const fr = calc.solveQuad(1 / 3, 0, -2)
  const frads = quadRadStrs(1 / 3, 0, -2, fr.x1, fr.x2)
  eq('13e 分数输入系数 exact=true', frads && frads.exact, true)
}

// ---------- 14) 接口层加固 ----------
throws('14a .9007199254740993e16 触发大整数检查', () => E('.9007199254740993e16'))
eq('14b .5e1 正常', E('.5e1'), 5)
eq('14c .25e2 正常', E('.25e2'), 25)
ok('14d sin(720x)=0 不再误判恒等式', eqSolveLines('sin(720x)=0')[0] !== '两边相等：恒等式')
eq('14e 同式两边仍判恒等式', eqSolveLines('sin(720x)=sin(720x)')[1], '恒等式：无数个解')

// ---------- V) 版本锁 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  eq('V1 manifest 版本锁 1.5.16/vc55', mf.versionName + '/' + mf.versionCode, '1.5.16/55')
}

console.log('regression-1.5.16: pass=' + pass + ' fail=' + fail)
if (fail) process.exit(1)
