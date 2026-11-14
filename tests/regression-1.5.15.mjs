// regression-1.5.15.mjs — 1.5.15 自查轮（作者方按 ChatGPT 式打法全量自查：
// 历史 bug 类型逐类回扫——引擎 fuzz 2600+ 例、方程矩阵约 1000 例、绘图 46 例、
// 工具页约 1300 例、输入层约 4600 次按键、界面静态审计、存储容错、性能计时）
// 确认 3 项属实并修复：
// 1. 绘图刻度标签溢出：极端尺度窗口（1.5.14 的 H 例 a=0.001、b=999999999）下
//    fmtTick 输出 21 位全数字标签（−249999999500000000000），塞进 24–26px 刻度格
//    必然重叠成一团。修复：纯文本长 >7 字改 2 位有效数字科学计数（步长本身是
//    整步、读尺度足够）；常规值域（≤7 字）逐字不变。
// 2. 结果数字负号字形全 App 不统一：formatDisplay 原样输出 ASCII '-'，而算式行、
//    方程标题行、DP 等路径用 '−'——主界面结果、方程答案行、判别式行、分数串、
//    根式串（radTerm）同屏混排两种负号。修复：formatDisplay 统一转换（科学计数
//    指数负号保持 ASCII），dispExact 回读先换回 ASCII 防 eqSign 误判；页面分数串
//    与根式串经 dm()/radTerm 同步统一。种子/回读串（formatPlain）不动。
// 3. 方程输入悬空运算符被静默吞：evalSide 宽容裁尾使「x+=3」被当成 x=3 解掉
//    另一个问题（2x+=7、x−=3、方程组同病）。修复：eqSolve 对含 x/y 或 = 的输入
//    校验任一边不得以运算符结尾，报「算式有问题，检查括号和符号」；括号未闭合
//    的宽容（自动补）与中间一元 +/-（x++2=5）保留，纯算式输入（如 5+）维持宽容。
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
function makeInst() {
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
  for (const k of Object.keys(def)) if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
  inst.onInit()
  return inst
}
function eqSolveLines(e1, e2) {
  const inst = makeInst()
  inst.eqExpr = e1; inst.eqExpr2 = e2 || ''
  inst.eqSolve()
  return inst.eqLines
}
function feedCalc(expr, fracOn) {
  const i = makeInst()
  i.expr = expr; i.refreshCalc()
  if (fracOn) { i.fracOn = true; i.refreshCalc() }
  return i
}

// ---------- 函数提取（fmtTick / dm 直接验） ----------
function extractFn(name) {
  const start = ux.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('找不到函数 ' + name)
  let depth = 0, i = ux.indexOf('{', start)
  for (; i < ux.length; i++) {
    if (ux[i] === '{') depth++
    else if (ux[i] === '}') { depth--; if (depth === 0) return ux.slice(start, i + 1) }
  }
  throw new Error('函数未配平 ' + name)
}
const FX = new Function('calc', 'dispNum', extractFn('dm') + '\n' + extractFn('trimSci') + '\n' + extractFn('fmtTick') + '\nreturn { dm, fmtTick }')(calc, (p) => String(p).replace(/^-/, '−'))
const fmtTick = FX.fmtTick, dm = FX.dm

// ---------- T. 绘图刻度标签 ----------
eq('T1 常规刻度 0', fmtTick(0), '0')
eq('T2 常规刻度 −2', fmtTick(-2), '−2')
eq('T3 常规刻度 0.5', fmtTick(0.5), '0.5')
eq('T4 常规刻度 999999（6 字）', fmtTick(999999), '999999')
eq('T5 百万改科学计数', fmtTick(1000000), '1e+6')
eq('T6 负百万', fmtTick(-1000000), '−1e+6')
eq('T7 H 例 Y 刻度（2.5e20 量级）', fmtTick(-249999999500000000000), '−2.5e+20')
eq('T8 H 例 X 刻度（5e11 量级）', fmtTick(-500000030000), '−5e+11')
ok('T9 极端刻度长度 ≤8', fmtTick(-249999999499999800000).length <= 8 && fmtTick(123456789012345).length <= 8)
eq('T10 微小刻度', fmtTick(0.000012345), '1.2e-5')
{
  const i = makeInst()
  i.unlocked = true
  i.plotType = 'quad2'; i.plotVals = { a: '0.001', b: '999999999', c: '0', k: '1', A: '1' }
  i.drawPlot()
  const labs = i.plotLabX.concat(i.plotLabY).map((t) => t.lab)
  // T11 口径 1.5.16 修订：fmtTick 改步长自适应位数（第十一轮第 7 项）后，极端
  // 窗口的标签位数按可分辨性放宽（硬上限 22 字），原「≤8 字」断言被「≤22 字
  // ＋X 轴互不相同」取代；该图 Y 轴整带宽仅为量级的 1e-15，15 位有效数字内
  // 个别标签仍会重复，属双精度边界、已记 BUGLOG
  ok('T11 H 例刻度标签 ≤22 字且 X 轴互不相同（' + labs.join(',') + '）', labs.every((s) => s.length <= 22) && new Set(i.plotLabX.map((t) => t.lab)).size === i.plotLabX.length)
  ok('T12 H 例仍出图且纵向 ≥10 种', i.view === 'plot' && new Set(i.plotPts.map((p) => p.t)).size >= 10)
}

// ---------- M. 负号字形统一 ----------
eq('M1 formatDisplay 负数千分位', calc.formatDisplay(-1234.5), '−1,234.5')
eq('M2 formatDisplay 科学计数指数负号保持 ASCII', calc.formatDisplay(-2.5e-16), '−2.5e-16')
eq('M3 formatDisplay 正数不变', calc.formatDisplay(1234.5), '1,234.5')
eq('M4 eqSign 对负小数仍判 =（dispExact 回读兼容）', calc.eqSign(-0.75), '=')
eq('M5 主界面负小数', feedCalc('0−3÷4').resDisp, '= −0.75')
eq('M6 主界面分数形', feedCalc('0−3÷4', true).resDisp, '= −3/4')
eq('M7 分数切换钮显示另一形式（小数）', feedCalc('0−3÷4', true).chipText, '−0.75')
eq('M8 近似负数连接号仍 ≈', feedCalc('1÷3−1').resDisp, '≈ −0.66666667')
eq('M9 自由输入负根', JSON.stringify(eqSolveLines('−x−x=10')), JSON.stringify(['整理成 −2x − 10 = 0', 'x = −5']))
eq('M10 判别式负值行', eqSolveLines('x²+x+999999')[1], '判别式 Δ = −3,999,995 < 0')
{
  const i = makeInst()
  i.s1a = '1'; i.s1b = '1'; i.s1c = '-3'; i.s2a = '1'; i.s2b = '-1'; i.s2c = '1'; i.sysSolve()
  eq('M11 方程组页负解', JSON.stringify(i.sLines), JSON.stringify(['x = −1', 'y = −2']))
  const j = makeInst()
  j.fn1 = '1'; j.fd1 = '2'; j.fn2 = '3'; j.fd2 = '4'; j.fop = '-'; j.fracSolve()
  ok('M12 分数页负结果（' + j.fLines.join('|') + '）', j.fLines.join('|').indexOf('= −1/4') >= 0 && j.fLines.join('|').indexOf('小数 = −0.25') >= 0)
  const k = makeInst()
  k.qa = '1'; k.qb = '0'; k.qc = '-2'; k.quadSolve()
  eq('M13 二次页根式负根行', k.qLines[2], 'x2 = −√2 ≈ −1.41421356237')
}
eq('M14 dm 指数负号保护', dm('-1.5e-7'), '−1.5e-7')
eq('M15 dm 分数串', dm('-3/4'), '−3/4')
// 种子/回读不受显示转换影响：按 = 后算式种子仍是可回读的精确串
{
  const i = makeInst()
  for (const key of ['0', '−', '3', '÷', '4']) i.pressKey(key)
  i.pressKey('eq')
  eq('M16 按 = 后种子', i.expr, '−0.75')
  eq('M17 按 = 后结果行', i.resDisp, '= −0.75')
}

// ---------- D. 方程悬空运算符 ----------
eq('D1 x+=3 报错不再静默解', JSON.stringify(eqSolveLines('x+=3')), JSON.stringify(['算式有问题，检查括号和符号']))
eq('D2 2x+=7 同', JSON.stringify(eqSolveLines('2x+=7')), JSON.stringify(['算式有问题，检查括号和符号']))
eq('D3 x−=3 同', JSON.stringify(eqSolveLines('x−=3')), JSON.stringify(['算式有问题，检查括号和符号']))
eq('D4 右边悬空 3x=5−', JSON.stringify(eqSolveLines('3x=5−')), JSON.stringify(['算式有问题，检查括号和符号']))
eq('D5 方程组悬空', JSON.stringify(eqSolveLines('x+y=3', 'x−=1')), JSON.stringify(['算式有问题，检查括号和符号']))
eq('D6 常数式悬空 5+=3', JSON.stringify(eqSolveLines('5+=3')), JSON.stringify(['算式有问题，检查括号和符号']))
ok('D7 中间一元 + 保留合法（x++2=5）', eqSolveLines('x++2=5').join('|').indexOf('x = 3') >= 0)
ok('D8 括号未闭合宽容保留（(x+1=5）', eqSolveLines('(x+1=5').join('|').indexOf('x = 4') >= 0)
eq('D9 纯算式悬空维持宽容（5+）', JSON.stringify(eqSolveLines('5+')), JSON.stringify(['= 5']))
ok('D10 正常方程不受影响', eqSolveLines('2x=4').join('|').indexOf('x = 2') >= 0)

// ---------- V. 版本锁 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  eq('V1 manifest 版本锁 1.5.15/vc54', mf.versionName + '/' + mf.versionCode, '1.5.15/54')
}

console.log('regression-1.5.15: pass=' + pass + ' fail=' + fail)
