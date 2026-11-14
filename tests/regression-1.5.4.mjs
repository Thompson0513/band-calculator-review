// 回归测试 1.5.4：卡西欧 fx-991 口径对齐两处
// A. 二次方程无理根给根式精确形（quad 页 / eqin 二次路径 / 图象交点行；复数根虚部同理）
//    系数走 calc.toFraction 精确恢复为有理数后算 (P ± Q√m)/R 并约分到最简；
//    恢复失败/超安全整数/数值自检不符 → 整组作废回退既有小数（或分数）显示，绝不硬凑。
//    显示纪律不变：不新增行，quad/eqin 答案行 ≤28 字、复数行 ≤30 字、plot 行 linePx ≤300。
// B. 主界面分数口径（用户拍板）：卡西欧「分数与小数混算结果恒为小数」规则经评估后不采用——
//    分数必须随时能看。canFrac 只看结果值是否有精确分数（calc.toFraction），不看输入形式：
//    带小数点的表达式（0.5×(1÷3) 等）结果照样出分数钮、照样能切换看分数；主行默认仍是小数。
// 覆盖任务点名用例：x²−2 双根式、(3+√17)/4、2x²−8x+2 约成 2±√3、分数系数输入仍出根式、
// 无理/超限系数回退、复数虚部根式、plot 交点根式、混算两例与对照例。
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }

// ---------- 抽取显示层函数（与 1.5.2 同法） ----------
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
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
const FN = ['dm', 'trimSci', 'FD', 'fitResStr', 'hardFit', 'ansStr', 'cplxStr', 'gcd2', 'rMul', 'rSub', 'quadExact', 'sqrtRat', 'radTerm', 'quadRadStrs', 'radAnsStr', 'quadImRad', 'cplxRadStr', 'DP', 'linePx', 'pvStr', 'rootsLine']
const F = new Function('calc', FN.map(extractFn).join('\n') + '\nreturn { ' + FN.join(', ') + ' }')(calc)
const { quadRadStrs, radAnsStr, quadImRad, cplxRadStr, rootsLine, linePx, ansStr } = F

// ---------- A1 函数层：实根根式组装与约分 ----------
let r = calc.solveQuad(1, 0, -2)
eq('x²−2 两根根式', JSON.stringify(quadRadStrs(1, 0, -2, r.x1, r.x2)), JSON.stringify({ x1: '√2', x2: '−√2', exact: true }))
eq('x²−2 x1 行：根式在前小数在后', radAnsStr('x1', r.x1, '√2', 28), 'x1 = √2 ≈ 1.41421356237')
eq('x²−2 x2 行', radAnsStr('x2', r.x2, '−√2', 28), 'x2 = −√2 ≈ −1.41421356237')
r = calc.solveQuad(2, -3, -1)
eq('2x²−3x−1 两根根式', JSON.stringify(quadRadStrs(2, -3, -1, r.x1, r.x2)), JSON.stringify({ x1: '(3+√17)/4', x2: '(3−√17)/4', exact: true }))
eq('(3+√17)/4 答案行', radAnsStr('x1', r.x1, '(3+√17)/4', 28), 'x1 = (3+√17)/4 ≈ 1.780776406')
eq('(3−√17)/4 答案行', radAnsStr('x2', r.x2, '(3−√17)/4', 28), 'x2 = (3−√17)/4 ≈ −0.28077641')
r = calc.solveQuad(2, -8, 2)
eq('2x²−8x+2 化简约分 (8±4√3)/4 → 2±√3', JSON.stringify(quadRadStrs(2, -8, 2, r.x1, r.x2)), JSON.stringify({ x1: '2+√3', x2: '2−√3', exact: true }))
eq('2+√3 答案行', radAnsStr('x1', r.x1, '2+√3', 28), 'x1 = 2+√3 ≈ 3.73205080757')
r = calc.solveQuad(1, 0, -12)
eq('x²−12 带系数根式 2√3', JSON.stringify(quadRadStrs(1, 0, -12, r.x1, r.x2)), JSON.stringify({ x1: '2√3', x2: '−2√3', exact: true }))
r = calc.solveQuad(1, 1, -1)
eq('x²+x−1 黄金根 (−1±√5)/2', JSON.stringify(quadRadStrs(1, 1, -1, r.x1, r.x2)), JSON.stringify({ x1: '(−1+√5)/2', x2: '(−1−√5)/2', exact: true }))
r = calc.solveQuad(3, 0, -1)
eq('3x²−1 分式根式 √3/3', JSON.stringify(quadRadStrs(3, 0, -1, r.x1, r.x2)), JSON.stringify({ x1: '√3/3', x2: '−√3/3', exact: true }))
r = calc.solveQuad(-1, 0, 2)
eq('a<0 时根与 ± 正确配对', JSON.stringify(quadRadStrs(-1, 0, 2, r.x1, r.x2)), JSON.stringify({ x1: '−√2', x2: '√2', exact: true }))

// ---------- A2 函数层：回退口径（不硬凑） ----------
r = calc.solveQuad(0.5, 0, -1)
eq('分数系数 (1/2)x²−1 仍出根式', JSON.stringify(quadRadStrs(0.5, 0, -1, r.x1, r.x2)), JSON.stringify({ x1: '√2', x2: '−√2', exact: true }))
r = calc.solveQuad(1, 0.5, -0.5)
eq('Δ 为完全平方（根有理）不走根式', quadRadStrs(1, 0.5, -0.5, r.x1, r.x2), null)
r = calc.solveQuad(1, -3, 2)
eq('有理根不走根式', quadRadStrs(1, -3, 2, r.x1, r.x2), null)
eq('系数为无理数恢复失败回退', quadRadStrs(Math.SQRT2, 0, -1, 1, -1), null)
eq('系数超安全整数回退', quadRadStrs(999999937, 999999929, 1, 0, 0), null)
eq('radAnsStr 根式为 null 时与 ansStr 全等（回退不变味）', radAnsStr('x1', Math.SQRT2, null, 28), ansStr('x1', Math.SQRT2, 28))
eq('回退行就是既有小数行', radAnsStr('x1', Math.SQRT2, null, 28), 'x1 ≈ 1.41421356237')
ok('根式答案行不超 28 字', radAnsStr('x1', 1.7807764064044151, '(3+√17)/4', 28).length <= 28)

// ---------- A3 函数层：复数虚部根式 ----------
r = calc.solveQuad(1, 1, 1)
eq('x²+x+1 虚部根式 √3/2', quadImRad(1, 1, 1, r.im), '√3/2')
eq('x²+x+1 x1 精确行', cplxRadStr('x1', r, '√3/2', '+'), 'x1 = −1/2 + √3/2i')
eq('x²+x+1 x2 精确行', cplxRadStr('x2', r, '√3/2', '−'), 'x2 = −1/2 − √3/2i')
ok('复数精确行 ≤30 字', cplxRadStr('x1', r, '√3/2', '+').length <= 30)
r = calc.solveQuad(162, -3, 2)
eq('照片题 162x²−3x+2 虚部 √143/108', quadImRad(162, -3, 2, r.im), '√143/108')
eq('照片题 x1 精确行', cplxRadStr('x1', r, '√143/108', '+'), 'x1 = 1/108 + √143/108i')
eq('照片题 x2 精确行', cplxRadStr('x2', r, '√143/108', '−'), 'x2 = 1/108 − √143/108i')
r = calc.solveQuad(1, 0, 1)
eq('虚部有理（x²+1）不走根式，回落既有行', quadImRad(1, 0, 1, r.im), null)

// ---------- A4 函数层：图象交点行 ----------
r = calc.solveQuad(1, 0, -2)
const pl1 = rootsLine(r.x1, r.x2, quadRadStrs(1, 0, -2, r.x1, r.x2))
eq('plot 交点 √2 并列行', pl1, '与 x 轴交点 x = √2 ≈ 1.41、−√2')
ok('plot √2 行守 linePx ≤300', linePx(pl1) <= 300)
r = calc.solveQuad(3, 0, -1)
const pl2 = rootsLine(r.x1, r.x2, quadRadStrs(3, 0, -1, r.x1, r.x2))
eq('plot 交点 √3/3 只给根式形（塞不下小数）', pl2, '与 x 轴交点 x = √3/3、−√3/3')
ok('plot √3/3 行守 linePx ≤300', linePx(pl2) <= 300)
r = calc.solveQuad(2, -8, 2)
eq('plot 交点 2±√3', rootsLine(r.x1, r.x2, quadRadStrs(2, -8, 2, r.x1, r.x2)), '与 x 轴交点 x = 2+√3、2−√3')
r = calc.solveQuad(2, -3, -1)
eq('plot (3±√17)/4 整行超宽门时回退 DP 小数行（绝不溢出）', rootsLine(r.x1, r.x2, quadRadStrs(2, -3, -1, r.x1, r.x2)), '与 x 轴交点 x = 1.7808、−0.2808')
eq('无 rads 调用与 1.5.2 行为一致', rootsLine(1, 0.5), '与 x 轴交点 x = 1、1/2 = 0.5')

// ---------- 页面实例行为（与 run-tests 同法加载真实页面脚本） ----------
function loadEsmText(src, names) {
  let s = src.replace(/export function /g, 'function ')
  s += '\nmodule.exports = { ' + names + ' }'
  const m = { exports: {} }
  new Function('module', 'exports', s)(m, m.exports)
  return m.exports
}
// [审查仓适配] paykey.js 未公开：缺失时用惰性桩满足页面 harness 拼装；本文件断言不涉及付费校验行为，桩不影响结果。本地原版无此回退。
let paykeyMod
try { paykeyMod = loadEsmText(readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8'), 'normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches') } catch (e) { paykeyMod = { normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), normalizeCode: (s) => String(s == null ? '' : s), shortCodeForDevice: () => 'AAAAAA', keyForShortCode: () => '0000000000', keyMatches: () => false } }
let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
const memStore = {}
globalThis.__storage = { get(o) { o.success(memStore[o.key] || '') }, set(o) { memStore[o.key] = o.value } }
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
const def = pageMod.exports
function makeInst() {
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
  for (const k of Object.keys(def)) if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
  inst.onInit()
  return inst
}

// quad 页：根式行端到端
let inst = makeInst()
inst.qa = '1'; inst.qb = '0'; inst.qc = '-2'; inst.quadSolve()
eq('quad 页 Δ 行不变', inst.qLines[0], '判别式 Δ = 8 > 0')
eq('quad 页 x²−2 x1 行', inst.qLines[1], 'x1 = √2 ≈ 1.41421356237')
eq('quad 页 x²−2 x2 行', inst.qLines[2], 'x2 = −√2 ≈ −1.41421356237')
inst.qa = '2'; inst.qb = '-3'; inst.qc = '-1'; inst.quadSolve()
eq('quad 页 (3+√17)/4 行', inst.qLines[1], 'x1 = (3+√17)/4 ≈ 1.780776406')
inst.qa = '1/2'; inst.qb = '0'; inst.qc = '-1'; inst.quadSolve()
eq('quad 页分数系数（parseCoeff 路径）仍出根式', inst.qLines[1], 'x1 = √2 ≈ 1.41421356237')
inst.qa = '162'; inst.qb = '-3'; inst.qc = '2'; inst.quadSolve()
eq('quad 页复数虚部根式 x1', inst.qLines[2], 'x1 = 1/108 + √143/108i')
eq('quad 页复数虚部根式 x2', inst.qLines[3], 'x2 = 1/108 − √143/108i')
inst.qa = '1'; inst.qb = '0'; inst.qc = '1'; inst.quadSolve()
eq('quad 页虚部有理仍走既有 cplxStr 行', inst.qLines[2], 'x1 = 0 + 1i')
inst.qa = '1'; inst.qb = '-3'; inst.qc = '2'; inst.quadSolve()
eq('quad 页有理根既有双显不回退', inst.qLines[1], 'x1 = 2')
eq('quad 页有理根 x2', inst.qLines[2], 'x2 = 1')

// eqin 二次路径：根式行端到端
inst = makeInst()
inst.eqExpr = 'x²=2'; inst.eqChars1 = inst.eqExpr.split(''); inst.eqSolve()
ok('eqin x²=2 给根式 x1 行', inst.eqLines.join('|').indexOf('x1 = √2 ≈ 1.41421356237') >= 0)
ok('eqin x²=2 给根式 x2 行', inst.eqLines.join('|').indexOf('x2 = −√2 ≈ −1.41421356237') >= 0)
inst.eqExpr = '2x²-3x-1=0'; inst.eqChars1 = inst.eqExpr.split(''); inst.eqSolve()
ok('eqin 2x²−3x−1=0 给 (3+√17)/4 行', inst.eqLines.join('|').indexOf('x1 = (3+√17)/4 ≈ 1.780776406') >= 0)

// 图象页：交点行端到端
inst = makeInst()
inst.unlocked = true
inst.qa = '1'; inst.qb = '0'; inst.qc = '-2'; inst.openPlot('quad')
ok('图象页交点行带根式', inst.plotLines.join('|').indexOf('与 x 轴交点 x = √2 ≈ 1.41、−√2') >= 0)

// ---------- B 主界面分数口径（实例）：只看结果值、不看输入形式 ----------
function feedCalc(expr) {
  const i = makeInst()
  i.expr = expr; i.refreshCalc()
  return i
}
let ci = feedCalc('0.148148148148+0')
eq('混算例1：0.148148148148+0 带小数点仍出分数钮', ci.canFrac, true)
eq('混算例1：钮上是结果值的精确分数 4/27', ci.chipText, '4/27')
eq('混算例1：主行默认仍是小数', ci.resDisp, '≈ 0.148148148')
ci.fracOn = true; ci.refreshCalc()
eq('混算例1：切换后照样看分数', ci.resDisp, '= 4/27')
ci = feedCalc('0.5×(1÷3)')
eq('混算例2：0.5×(1÷3) 带小数点仍出分数钮', ci.canFrac, true)
eq('混算例2：钮上是 1/6', ci.chipText, '1/6')
eq('混算例2：主行默认仍是小数', ci.resDisp, '≈ 0.166666667')
ci = feedCalc('0.1+0.2')
eq('0.1+0.2 仍出分数钮', ci.canFrac, true)
eq('0.1+0.2 钮上是 3/10', ci.chipText, '3/10')
ci = feedCalc('1÷3')
eq('对照：无小数点 1÷3 出分数钮', ci.canFrac, true)
eq('对照：1÷3 钮上是 1/3', ci.chipText, '1/3')
ci = feedCalc('5÷2')
eq('对照：无小数点 5÷2 仍可给分数', ci.canFrac, true)

console.log('regression-1.5.4: ' + pass + ' passed, ' + fail + ' failed')
if (fail) process.exit(1)
