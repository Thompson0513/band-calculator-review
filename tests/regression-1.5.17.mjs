// regression-1.5.17.mjs — 科学计数法全应用改课本式（用户定版）：显示禁用
// e 记法，一律「尾数×10＋上标指数」（如 −1×10⁻⁷、1.2346×10¹⁵）；首页新增
// ×10 幂输入键（替代常数 e 键）＋算式回显课本式渲染。内部表示（formatPlain、
// 求值接力串、历史 rf）仍是 e 记法/全精度纯文本，只改显示与回显层；解析端
// 三头通吃：tokenizer 折叠认课本式、dispExact 经 sciToPlain 回读、旧 e 串
// 原样可解析。本文件 harness 自带 paykey 惰性桩、不读 paykey.js（断言不涉及
// 付费校验行为）；审查仓副本与本地逐字一致、无需适配改写。
// 章节：
//  0 上标映射码点证据（逐字核对 U+2070/00B9/00B2/00B3/2074–2079/207B）
//  1 sciStr/sciToPlain 单元与往返等值
//  2 formatDisplay 批量：零 e 记法残留＋负号字形
//  3 各产生点代表例（结果行/DP/DA/termNum/fmtTick/fmtPoly/单位/全位行/根式行）
//  4 往返链 A：新格式结果→带回再算（历史回退/单位带回/tokenizer/eqSign）
//  5 往返链 B：旧 e 格式历史→读入迁移显示→再带回
//  6 首页输入链：×10 键按键序列→回显、退格链、= 后续算、键表与防歧义守卫
//  7 宽度静态审计：各控件最长输出 vs 行宽/格宽（数字见 BUGLOG 1.5.17）
//  8 源码级 e 残留审计（显示路径必须经 sciStr 收口）
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }
function throws(name, fn) { try { fn(); ok(name, false) } catch (e) { ok(name, true) } }
const E = (s, o) => calc.evaluate(s, o)
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
const calcSrc = readFileSync(new URL('../src/common/calc.js', import.meta.url), 'utf8')
const NOT_E = /[0-9]e[+-]?[0-9]|[0-9]E[+-]?[0-9]/ // 记法 e（数字-e-数字形态），单词/常数 e 不在此列
function loadPage(storageImpl) {
  let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
  globalThis.__storage = storageImpl
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__router = { push() {}, back() {} }
  globalThis.__calc = calc
  globalThis.__paykey = { keyMatches: () => false, normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), shortCodeForDevice: () => 'AAAAAA' }
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import router from '@system.router'", 'const router = globalThis.__router')
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
function extractFn(name) {
  const start = ux.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('找不到函数 ' + name)
  let i = ux.indexOf('{', start), depth = 0, j = i
  for (; j < ux.length; j++) { if (ux[j] === '{') depth++; else if (ux[j] === '}') { depth--; if (!depth) break } }
  return ux.slice(start, j + 1)
}
const valEndMatch = ux.match(/const VAL_END = '([^']*)'/)
const supdMatch = ux.match(/const SUPD = '([^']*)'/)
const FN = ['dm', 'FD', 'dispNum', 'trimSci', 'fmtTick', 'DP', 'DA', 'fitResStr', 'hardFit', 'termNum', 'fmtPoly', 'pvStr', 'vertexLine', 'rootsLine', 'linRootLine', 'trigInfoLines', 'ansStr', 'sciEcho', 'unitNumStr', 'unitRatioClean', 'buildUnitProc', 'unitCarryExpr', 'isRealCalc', 'linePx']
const F = new Function('calc', 'VAL_END', 'SUPD', FN.map(extractFn).join('\n') + '\nreturn { ' + FN.join(', ') + ' }')(calc, valEndMatch[1], supdMatch[1])
const { fmtTick, DP, DA, fitResStr, termNum, fmtPoly, pvStr, linRootLine, ansStr, sciEcho, unitNumStr, buildUnitProc, unitCarryExpr, isRealCalc, linePx } = F

// ---------- 0) 上标映射码点证据 ----------
// 指数串逐字取码点：d 位起为「×10」之后的指数部分
function expCps(s) { const i = s.indexOf('×10'); return [...s.slice(i + 3)].map((c) => c.codePointAt(0)) }
eq('0a ⁰¹ 码点（1e10）', JSON.stringify(expCps(calc.sciStr('1e10'))), JSON.stringify([0x00B9, 0x2070]))
eq('0b ²³ 码点（1e23）', JSON.stringify(expCps(calc.sciStr('1e23'))), JSON.stringify([0x00B2, 0x00B3]))
eq('0c ⁴⁵ 码点（1e45）', JSON.stringify(expCps(calc.sciStr('1e45'))), JSON.stringify([0x2074, 0x2075]))
eq('0d ⁶⁷ 码点（1e67）', JSON.stringify(expCps(calc.sciStr('1e67'))), JSON.stringify([0x2076, 0x2077]))
eq('0e ⁸⁹ 码点（1e89）', JSON.stringify(expCps(calc.sciStr('1e89'))), JSON.stringify([0x2078, 0x2079]))
eq('0f ⁻ 码点（1e-5）', JSON.stringify(expCps(calc.sciStr('1e-5'))), JSON.stringify([0x207B, 0x2075]))
eq('0g 回显侧 SUPD 全位（10^1234567890）', sciEcho('10^1234567890'), '10¹²³⁴⁵⁶⁷⁸⁹⁰')
eq('0h 键面 ˣ 码点 U+02E3', '×10ˣ'.codePointAt(3), 0x02E3)
ok('0i calc.js 源码含完整上标映射表', calcSrc.includes("'4': '⁴'") && calcSrc.includes("'9': '⁹'") && calcSrc.includes("'⁰': '0'") && calcSrc.includes("'⁹': '9'"))

// ---------- 1) sciStr / sciToPlain ----------
eq('1a sciStr 负指数', calc.sciStr('1e-7'), '1×10⁻⁷')
eq('1b sciStr 正指数不带 +', calc.sciStr('-1.2346e+15'), '-1.2346×10¹⁵')
eq('1c sciStr 认 U+2212 尾数负号并保留', calc.sciStr('−2.5e-16'), '−2.5×10⁻¹⁶')
eq('1d sciStr 尾数去尾零', calc.sciStr('1.2300000e+20'), '1.23×10²⁰')
eq('1e sciStr 非科学计数原样', calc.sciStr('0.5159'), '0.5159')
eq('1f sciStr 分组串原样', calc.sciStr('1,234.5'), '1,234.5')
eq('1g sciToPlain 课本式还原', calc.sciToPlain('−1.2346×10¹⁵'), '−1.2346e15')
eq('1h sciToPlain 负指数还原', calc.sciToPlain('1.65×10⁻¹⁶'), '1.65e-16')
eq('1i sciToPlain 旧 e 串原样', calc.sciToPlain('−2.5e-16'), '−2.5e-16')
{
  // 往返等值：sciStr 显示 → sciToPlain → parseFloat 与原值逐位相等
  const vs = [1e-7, -5e-8, 1.65e-16, 2.5e20, 1e21, 1.1e-16, 9.99e22, 3.333e-9, 1.23456789012e-12]
  ok('1j sciStr→sciToPlain→parseFloat 全等值', vs.every((v) => parseFloat(calc.sciToPlain(calc.formatDisplay(v).replace(/,/g, '').replace(/−/g, '-'))) === calc.cleanNum(v))) // 逗号剥离与 useHist 带回路径同口径
}

// ---------- 2) formatDisplay 批量 ----------
eq('2a formatDisplay(1e-7)', calc.formatDisplay(1e-7), '1×10⁻⁷')
eq('2b formatDisplay(-5e-8)', calc.formatDisplay(-5e-8), '−5×10⁻⁸')
eq('2c formatDisplay(1.5e21)', calc.formatDisplay(1.5e21), '1.5×10²¹')
eq('2d formatDisplay(1e21)', calc.formatDisplay(1e21), '1×10²¹')
{
  const vs = []
  for (let e = -16; e <= 23; e++) { vs.push(1.23456789 * Math.pow(10, e), -9.8765 * Math.pow(10, e)) }
  const outs = vs.map((v) => calc.formatDisplay(v))
  ok('2e 量级扫掠零 e 记法残留', outs.every((s) => !NOT_E.test(s)))
  ok('2f 量级扫掠负数无 ASCII 负号（字形统一）', vs.every((v, i) => v > 0 || !outs[i].includes('-')))
  ok('2g 普通值不回归：千分位', calc.formatDisplay(1234567.891) === '1,234,567.891' && calc.formatDisplay(0.5159) === '0.5159')
}

// ---------- 3) 各产生点代表例 ----------
{
  const i = makeInst()
  i.expr = '0.0000001×0.0000001'; i.refreshCalc()
  eq('3a 主结果行', i.resDisp, '= 1×10⁻¹⁴')
  const j = makeInst()
  j.expr = '123456789×1000000000'; j.refreshCalc()
  ok('3b 大整数结果行含课本式且 ≤20 字（' + j.resDisp + '）', j.resDisp.indexOf('×10') >= 0 && j.resDisp.length <= 20)
}
eq('3c fitResStr cap 12 分级降精度', fitResStr(-1234567890123456, 12), '−1.2346×10¹⁵')
eq('3d fitResStr cap 13 用 6 位精度', fitResStr(-1234567890123456, 13), '−1.23457×10¹⁵')
eq('3d2 fitResStr cap 11 触 p≥5 地板（与旧 e 形同口径，地板输出可超 cap）', fitResStr(-1234567890123456, 11), '−1.2346×10¹⁵')
eq('3e DP 交点小量', DP(-0.0000001), '−1×10⁻⁷')
eq('3f DP 大值 toPrecision 路径', DP(1.2345678901234568e23), '1.2345679×10²³')
eq('3g DP 常规不回归', DP(-0.5158730158730159), '−0.5159')
eq('3h DA 大振幅', DA(10000.5), '1×10⁴')
eq('3i DA 负大值', DA(-2.5e21), '−2.5×10²¹')
eq('3j termNum 兜底科学计数', termNum(123456789012345678901), '1.235×10²⁰')
eq('3k fmtTick 短串 e 泄漏已堵（5e-7）', fmtTick(5e-7), '5×10⁻⁷')
eq('3l fmtPoly 小系数整理成行', fmtPoly(9.9341075e-8, 100000000, -100000000, true), '9.9341075×10⁻⁸x²+100000000x−100000000')
eq('3m pvStr 交点行（分数放不下退 DP）', linRootLine(1e-7), '与 x 轴交点 x = 1×10⁻⁷（就是方程的解）')
eq('3n ansStr 极小根纯小数行', ansStr('x', 1e-16, 28), 'x = 1×10⁻¹⁶')
eq('3o unitNumStr 极小值课本式', unitNumStr(1e-10), '1×10⁻¹⁰')
eq('3o2 unitNumStr 微小值全位展开不回归（formatPlain 口径）', unitNumStr(1 / 604800), '0.00000165343915344')
eq('3p 单位过程式（秒→周带回源）', buildUnitProc(4, 's', 'wk', 5), '5÷604800')
{
  // 方程数值比较分支的科学量级结果行：两边同为课本式、无 e 记法；
  // 全位展示子分支（ansStr 相同才触发）在科学量级下因 12 位精度口径
  // 不可达（可达的纯整数大数路径已由 regression-1.5.13 C2 覆盖）
  const lines = eqSolveLines('150000000001×10^10=15×10^20')
  eq('3q 不相等判定', lines[0], '两边不相等')
  eq('3r 左边结果行课本式', lines[1], '左边 = 1.50000000001×10²¹')
  eq('3r2 右边结果行课本式', lines[2], '右边 = 1.5×10²¹')
}
{
  // 极小系数二次方程全行课本式：整理成行/判别式行/根行都不带 e 记法；
  // 根 1.732…×10⁻⁷ 无精确根式形（√3/10⁷ 分母超限），按口径回退小数 ≈
  const lines = eqSolveLines('x²−0.00000000000003=0')
  eq('3s 整理成行课本式', lines[0], '整理成 x² − 3×10⁻¹⁴ = 0')
  eq('3s2 判别式行课本式', lines[1], '判别式 Δ = 1.2×10⁻¹³ > 0')
  eq('3s3 根行课本式小数完整（1.6.0 自查 B4 修订：x1 为负根）', lines[2], 'x1 ≈ −1.73205080757×10⁻⁷')
}

// ---------- 4) 往返链 A：新格式 → 带回再算 ----------
eq('4a tokenizer 折叠 2×10³×5', E('2×10³×5'), 10000)
eq('4b tokenizer 折叠衔接运算', E('1.65×10⁻¹⁶×2'), 3.3e-16)
eq('4c tokenizer 折叠括号内（温度式）', E('(1×10⁻⁹−32)÷1.8'), -17.777777777222223)
eq('4d eqSign 精确科学值仍 =', calc.eqSign(1e-16), '=')
eq('4e eqSign 全精度科学值回读判 =（formatDisplay 保最短往返精度）', calc.eqSign(1.2345678901234567e21), '=')
eq('4e0 eqSign 循环小数对照仍 ≈', calc.eqSign(2 / 3), '≈')
eq('4e2 eqSign 负科学值回读仍 =（U+2212 回读）', calc.eqSign(-1e-16), '=')
eq('4e3 eqSign 负科学值 −2.5e-16 仍 =', calc.eqSign(-2.5e-16), '=')
{
  // 历史新记录：按 = 生成 → res 是课本式；删 rf 模拟回退路径带回再算
  const i = makeInst()
  i.expr = '1÷10000000'; i.refreshCalc(); i.pressKey('eq')
  eq('4f 历史新记录 res 课本式', i.hist[0] && i.hist[0].res, '1×10⁻⁷')
  const rec = { expr: i.hist[0].expr, res: i.hist[0].res, sgn: i.hist[0].sgn }
  const j = makeInst()
  j.useHist(rec)
  eq('4g 回退带回内部是 e 纯文本', j.expr, '1e-7')
  eq('4h 回退带回再算等值', j.previewVal, 1e-7)
}
{
  // 单位带回：过程式含课本式段，求值与 convertUnit 等值、回显无 e
  const i = makeInst()
  i.catIdx = 4; i.unitFromId = 's'; i.unitToId = 'wk'; i.unitVal = '0.0000000001'
  i.unitCompute()
  eq('4i 单位极小结果行', i.unitRes, '≈ 1.65×10⁻¹⁶')
  i.unitCarryBack()
  ok('4j 带回式子含课本式段（' + i.expr + '）', i.expr.indexOf('×10⁻¹⁰') >= 0)
  eq('4k 带回再算等值', i.previewVal, calc.convertUnit(4, 's', 'wk', 0.0000000001))
  ok('4l 带回回显无 e 记法', !NOT_E.test(i.exprDisp))
  eq('4m unitCarryExpr 拼接点', unitCarryExpr('5', buildUnitProc(4, 's', 'wk', 5)), '5×(5÷604800)')
}

// ---------- 5) 往返链 B：旧 e 历史 → 迁移显示 → 再带回 ----------
{
  const store = { calc_hist: JSON.stringify([
    { expr: '1÷10000000', res: '1e-7', sgn: '=', ts: Date.now() },
    { expr: '0−5÷100000000', res: '−5e-8', sgn: '=', ts: Date.now() },
    { expr: '2×10^3×5', res: '10000', sgn: '=', ts: Date.now(), rf: '10000' }
  ]) }
  const d2 = loadPage({ get(o) { o.success(store[o.key] || '') }, set(o) { store[o.key] = o.value } })
  const i = makeInst(d2)
  eq('5a 旧 res 迁移为课本式（1e-7）', i.hist[0].res, '1×10⁻⁷')
  eq('5b 旧 res 迁移为课本式（−5e-8）', i.hist[1].res, '−5×10⁻⁸')
  eq('5c 历史 expr 回显渲染（手打 10^ 段）', i.histDisp[2].expr, '2×10³×5')
  const j = makeInst(d2)
  j.useHist(i.hist[0])
  eq('5d 旧记录回退带回再算', j.previewVal, 1e-7)
  const k = makeInst(d2)
  k.useHist(i.hist[1])
  eq('5e 旧负值记录带回再算', k.previewVal, -5e-8)
  eq('5f tokenizer 旧 e 式照常解析', E('1e-7'), 1e-7)
}

// ---------- 6) 首页输入链 ----------
{
  const i = makeInst()
  const sci = i.sciKeys.find((k) => k.v === 'x10')
  ok('6a 科学键盘含 ×10 键且键面课本式', !!sci && sci.label === '×10ˣ')
  // 【1.6.0 修订】常数 e 已在科学键盘恢复（24 键，另加 π、%、Ans）：1.5.17
  // 下岗 e 的理由是怕与 e 记法混淆，而该版自己的课本式 ×10 显示已让 e 记法
  // 从全部结果中消失、混淆源头消除；高中考题又离不开 e，故 1.6.0 定版恢复。
  // 原断言钉的是当时的键表事实，随定版翻转，在此改判并披露（同 1.5.20 先例）
  ok('6b【1.6.0 修订】常数 e 键已在科学键盘恢复、总键数 24', i.sciKeys.some((k) => k.v === 'e') && i.sciKeys.length === 24)
  ok('6c 内部仍可求值常数 e（求值层不动）', Math.abs(E('e') - Math.E) < 1e-15)
}
{
  const i = makeInst()
  for (const k of ['1', '.', '6', '5', 'x10', '−', '1', '6']) i.pressKey(k)
  eq('6d 输入内部式子（存储不动）', i.expr, '1.65×10^−16')
  eq('6e 输入回显课本式', i.exprDisp, '1.65×10⁻¹⁶')
  eq('6f 输入预览值', i.previewVal, 1.65e-16)
  eq('6g 输入结果行', i.resDisp, '= 1.65×10⁻¹⁶')
  i.pressKey('back'); eq('6h 退格删指数位', i.exprDisp, '1.65×10⁻¹')
  i.pressKey('back'); eq('6i 退格删空指数（暂态 ^−）', i.exprDisp, '1.65×10^−')
  i.pressKey('back'); eq('6j 退格删负号（暂态 ^）', i.exprDisp, '1.65×10^')
  i.pressKey('back'); eq('6k 退格删 ^（×10 整体开始拆）', i.exprDisp, '1.65×10')
  i.pressKey('back'); eq('6l 退格删 0', i.exprDisp, '1.65×1')
  i.pressKey('back'); eq('6m 退格删 1', i.exprDisp, '1.65×')
  i.pressKey('back'); eq('6n 退格删 × 只剩尾数', i.exprDisp, '1.65')
  eq('6o 尾数仍可算', i.previewVal, 1.65)
}
{
  const i = makeInst()
  i.pressKey('x10')
  eq('6p 空式子按 ×10 键回显暂态', i.exprDisp, '10^')
  i.pressKey('5')
  eq('6q 正指数回显', i.exprDisp, '10⁵')
  eq('6r 正指数值', i.previewVal, 100000)
  const j = makeInst()
  for (const k of ['2', 'x10', '3', '×', '5']) j.pressKey(k)
  eq('6s 衔接运算回显 2×10³×5', j.exprDisp, '2×10³×5')
  eq('6t 衔接运算值', j.previewVal, 10000)
  const m = makeInst()
  for (const k of ['1', '÷', '4']) m.pressKey(k)
  m.pressKey('eq'); m.pressKey('x10'); m.pressKey('−'); m.pressKey('2')
  eq('6u = 后接 ×10 续算回显', m.exprDisp, '0.25×10⁻²')
  eq('6v = 后接 ×10 续算值', m.previewVal, 0.0025)
}
eq('6w sciEcho 非科学计数 ^ 不动（2^3）', sciEcho('2^3'), '2^3')
eq('6x sciEcho 非科学计数 ^ 不动（100^2）', sciEcho('100^2'), '100^2')
eq('6y sciEcho 非科学计数 ^ 不动（210^3）', sciEcho('210^3'), '210^3')
eq('6z sciEcho 括号内独立 10^ 段', sciEcho('(10^−7)'), '(10⁻⁷)')
eq('6aa 手打连按 ² 不折（防歧义守卫）', E('2×10²²'), 20000)
eq('6ab 手打单个 ² 恒等折叠', E('2×10²'), 200)
ok('6ac 手打 10²! 给约数（1.6.0 自查 B5 修订：100! 不再报错，10²! 仍不折叠）', Math.abs(E('2×10²!') / 1.866524308878882e158 - 1) < 1e-12)
ok('6ad 纯带回数值不误判真实计算（isRealCalc）', isRealCalc('1×10⁻⁹') === false && isRealCalc('1×10⁻⁹+1') === true)

// ---------- 7) 宽度静态审计 ----------
eq('7a 常规刻度标签 9 字（−2.5×10²⁰）', fmtTick(-249999999500000000000).length, 9)
eq('7b 【1.5.19 同版修订二】最坏刻度标签（旧期望 21 字 → 6 字：极端尺度 |E|≥10 有效数字封顶 5 位，见 regression-1.5.19 §9 头注）', fmtTick(9.99999999999999e20, 1e6).length, 6)
ok('7c 极端刻度标签 ≤22 字硬上限', fmtTick(-Number.MAX_VALUE, 1e292).length <= 22) // 1.5.18 修订：原用例 -9.99999999999999e308 在 JS 中为 -Infinity、走「溢出」短串空转（第十二轮复审实证），换真实有限最大值
ok('7d 结果行 cap 恒守住（cap≥12）', [1e-16, -1234567890123456, 1.5e21, 9.99e18].every((v) => fitResStr(v, 12).length <= 12 && fitResStr(v, 18).length <= 18))
{
  const i = makeInst()
  i.catIdx = 4; i.unitFromId = 's'; i.unitToId = 'wk'; i.unitVal = '0.0000000001'
  i.unitCompute()
  eq('7e 单位极小结果 12 字、字号档 22px（卡宽 304）', i.unitRes.length + '/' + i.unitResPx, '12/22')
}
eq('7f linePx 课本式交点行宽', linePx('与 y 轴交点 (0, −1×10⁻⁷)'), 221)
eq('7f2 linePx 课本式比 e 形宽 20（净多 2 字符×10px）', linePx('与 y 轴交点 (0, −1×10⁻⁷)') - linePx('与 y 轴交点 (0, −1e-7)'), 20)
eq('7f3 linePx 上标字符走 10px 豁免（非 19px 全角）', linePx('⁻⁷'), 25)

// ---------- 8) 源码级 e 残留审计 ----------
ok('8a fmtTick 经 sciStr 收口', ux.includes('return dispNum(calc.sciStr(trimSci(v.toExponential(digs - 1))))'))
ok('8b 单位极小值经 sciStr 收口', ux.includes("this.unitRes = '≈ ' + dispNum(calc.sciStr(r.toExponential(2)))"))
ok('8c DP 出口经 sciStr 收口', (ux.match(/calc\.sciStr\(t\)\.replace/g) || []).length === 2)
eq('8d toExponential 仅两处（fmtTick 与单位极小值，均在 sciStr 内）', (ux.match(/toExponential\(/g) || []).length, 2)
ok('8e formatDisplay 经 sciStr 收口', calcSrc.includes('return dispMinus(sciStr(s))'))
// 【1.6.0 修订】e 键已定版恢复（理由同 §6b 修订注），本断言随之翻转
ok('8f【1.6.0 修订】buildSciKeys 含 e 键定义（e 已恢复）', ux.includes("{ v: 'e', label: 'e'"))
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  eq('8g manifest 版本锁 1.5.17/vc56', mf.versionName + '/' + mf.versionCode, '1.5.17/56')
}

console.log('regression-1.5.17: pass=' + pass + ' fail=' + fail)
if (fail) process.exit(1)
