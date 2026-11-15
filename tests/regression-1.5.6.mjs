// 二次方程两根恒按 x1<x2 升序；C/D/E 组小根/大根下标随之互换，根值本身不变。
// 回归测试 1.5.6：ChatGPT《1.5.5 上架前深度审核报告》逐项实跑核实后的修复
// A.方程组容差下限误判：solveSystem 的 eD/eX/eY 旧用 max(1, …) 兜底，
// 系数整体在 1e-7 级时真行列式（1e-14 级）被 1e-12 绝对阈值吞掉，唯一解误报无穷多解。
// 修复：阈值改纯相对尺度（去掉 1 下限）。B 组守卫保证当初加容差的用例不回退。
// B.方程组判定全组：容差立项例、平行/重合、含 0 系数、全零行、尺度不变性。
// C.极小数归零：cleanNum 旧阈值 |v|<1e-15 一律归零，把真值 1e-16 也吞了
// （主计算 1÷10^16 显示 0；x²+1e16x+1 的韦达小根 −1e-16 显示 ≈0；方程组同理）。
// 修复：极小值先看能否用 12 位有效数字精确表示——能（1e-16、5e-16）是真值，走科学
// 计数法；不能（sin(180°)=1.2246…e-16、0.1+0.2−0.3=5.55…e-17）是浮点尾巴，仍归零。
// 已知边界（口径记录）：(1/3)×1e-15 这类 12 位表示不干净的真值仍归零，与旧版一致。
// 1.5.18 修订：此边界已被 B-01 推翻——真商族改由求值层加减吸附＋显示层
// 真商救援处理，本节 C 口径记录断言已同步改判（守卫类断言不变）。
// D.二次方程极端系数：判别式溢出/NaN 时旧版不报错——eps 同步溢出误入
// 重根分支给出 −5e+307 假根、NaN 判别式走出 im=NaN、a 极小时稳定求根真返回 −Infinity 根。
// 修复：disc 非有限、或任一根/实部/虚部非有限 → {error:'数字太大，超出精确计算范围'}
// （与 fracCalc/gcdLcm 既有报错同形态）；quad 页与 eqin 消费点补 r.error 显示。
// 报告所述机制（!isFinite(sq) 分支返回两根）经实跑不确：该分支因 eps 同步溢出不可达，
// 真实路径是误入重根分支与稳定求根溢出，如上。
// E.根式假精确：a 输入 √2 的浮点近似 1.41421356237 时 toFraction 返回
// null、quadRadStrs 返回 null、页面回退纯小数——报告担忧的情形不发生。
// a=0.3333333333（10 个 3）被 toFraction 按既定 1e-10 容差认作 1/3（与主界面分数识别
// 同一口径）：c=−3 时 Δ 恢复为完全平方、走有理路径且页面显示的是浮点根原值；
// c=−2 时给出 √6（自检差 1.2e-10 < 1e-9）——均为容差口径内行为，锁定记录。
// F.分数钮边界：355÷113、9999÷9998、123456789÷987654321 三例均无溢出；
// 超分母上限的 123456789/987654321 确认不出钮（canFrac=false）。
// G.单位带回负温：−40 °C→°F 过程式求值 = −40，与 convertUnit 一致。
import { readFileSync} from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++} else { fail++; console.log('FAIL:', name)}}
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want)}
function approx(name, got, want, eps) { ok(name + '（got=' + got + '）', Math.abs(got - want) < (eps || 1e-9))}

// ---------- 页面实例 harness（与 1.5.4 同法） ----------
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
function extractFn(name) {
const start = ux.indexOf('function ' + name + '(')
if (start < 0) throw new Error('找不到函数 ' + name)
let depth = 0, i = ux.indexOf('{', start)
for (; i < ux.length; i++) {
if (ux[i] === '{') depth++
else if (ux[i] === '}') { depth--; if (depth === 0) return ux.slice(start, i + 1)}
}
throw new Error('函数未配平 ' + name)
}
function loadEsmText(src, names) {
let s = src.replace(/export function /g, 'function ')
s += '\nmodule.exports = { ' + names + '}'
const m = { exports: {}}
new Function('module', 'exports', s)(m, m.exports)
return m.exports
}
// [审查仓适配] paykey.js 未公开：缺失时用惰性桩满足页面 harness 拼装；本文件断言不涉及付费校验行为，桩不影响结果。本地原版无此回退。
let paykeyMod
try { paykeyMod = loadEsmText(readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8'), 'normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches') } catch (e) { paykeyMod = { normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), normalizeCode: (s) => String(s == null ? '' : s), shortCodeForDevice: () => 'AAAAAA', keyForShortCode: () => '0000000000', keyMatches: () => false } }
let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
const memStore = {}
globalThis.__storage = { get(o) { o.success(memStore[o.key] || '')}, set(o) { memStore[o.key] = o.value}}
globalThis.__vibrator = { vibrate() {}}
globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210'})}}
  globalThis.__router = { push() {}, back() {} }
globalThis.__calc = calc
globalThis.__paykey = paykeyMod
script = script
.replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
.replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
.replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import router from '@system.router'", 'const router = globalThis.__router')
.replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
.replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
.replace('export default', 'module.exports =')
const pageMod = { exports: {}}
new Function('module', 'exports', script)(pageMod, pageMod.exports)
const def = pageMod.exports
function makeInst() {
const inst = {}
Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
for (const k of Object.keys(def)) if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
inst.onInit()
return inst
}
const FN154 = ['dm', 'trimSci', 'FD', 'fitResStr', 'hardFit', 'ansStr', 'cplxStr', 'gcd2', 'rMul', 'rSub', 'quadExact', 'sqrtRat', 'radTerm', 'quadRadStrs', 'radAnsStr', 'quadImRad', 'cplxRadStr', 'DP', 'linePx', 'pvStr', 'rootsLine']
const F154 = new Function('calc', FN154.map(extractFn).join('\n') + '\nreturn { ' + FN154.join(', ') + '}')(calc)
const FN155 = ['dispNum', 'unitNumStr', 'unitRatioClean', 'buildUnitProc', 'unitCarryExpr']
const F155 = new Function('calc', FN155.map(extractFn).join('\n') + '\nreturn { ' + FN155.join(', ') + '}')(calc)

// ---------- A. 方程组小系数误判（修复正例） ----------
{
const r = calc.solveSystem(1e-7, 0, 1e-7, 0, 1e-7, 1e-7)
eq('A 报告原例 type', r.type, 'one')
approx('A 报告原例 x', r.x, 1); approx('A 报告原例 y', r.y, 1)
}
{
const r = calc.solveSystem(1e-7, 0, 2e-7, 0, 1e-7, 3e-7)
eq('A 微小对角唯一解 type', r.type, 'one')
approx('A 微小对角 x', r.x, 2); approx('A 微小对角 y', r.y, 3)
}
eq('A 微小平行不同常数判无解', calc.solveSystem(1e-7, 1e-7, 2e-7, 1e-7, 1e-7, 3e-7).type, 'none')
{
const inst = makeInst()
inst.s1a = '0.0000001'; inst.s1b = ''; inst.s1c = '0.0000001'
inst.s2a = ''; inst.s2b = '0.0000001'; inst.s2c = '0.0000001'
inst.sysSolve()
eq('A 方程组页 x 行', inst.sLines[0], 'x = 1')
eq('A 方程组页 y 行', inst.sLines[1], 'y = 1')
}

// ---------- B. 方程组守卫组（修前修后一致，不许回退） ----------
eq('B 容差立项例 0.1/0.7 与 3 倍式仍无穷多解', calc.solveSystem(0.1, 0.7, 1, 0.3, 2.1, 3).type, 'infinite')
eq('B 容差例放大 1e6 倍仍无穷多解（尺度不变性）', calc.solveSystem(1e5, 7e5, 1e6, 3e5, 2.1e6, 3e6).type, 'infinite')
eq('B 整数同式 2 倍无穷多解', calc.solveSystem(1, 1, 1, 2, 2, 2).type, 'infinite')
eq('B 整数平行不同常数无解', calc.solveSystem(1, 1, 1, 2, 2, 3).type, 'none')
{
const r = calc.solveSystem(1, 1, 1, 1, -1, 0)
eq('B 普通唯一解 type', r.type, 'one'); approx('B 普通唯一解 x', r.x, 0.5); approx('B 普通唯一解 y', r.y, 0.5)
}
{
const r = calc.solveSystem(0, 1, 2, 1, 0, 3)
eq('B 含 0 系数 type', r.type, 'one'); approx('B 含 0 系数 x', r.x, 3); approx('B 含 0 系数 y', r.y, 2)
}
eq('B 全零行 0=0 无穷多解', calc.solveSystem(0, 0, 0, 1, 1, 1).type, 'infinite')
eq('B 全零行 0=5 无解', calc.solveSystem(0, 0, 5, 1, 1, 1).type, 'none')
eq('B 两行全零一真一假无解', calc.solveSystem(0, 0, 0, 0, 0, 5).type, 'none')

// ---------- C. 极小数归零（修复正例 + 尾巴防护守卫） ----------
eq('C 主计算 1/10^16 显示科学计数', calc.formatDisplay(calc.evaluate('1/10^16')), '1×10⁻¹⁶') // 1.5.17 修订：课本式
eq('C 主计算 1÷10^16 显示科学计数', calc.formatDisplay(calc.evaluate('1÷10^16')), '1×10⁻¹⁶') // 1.5.17 修订：课本式
eq('C 1e-15 不变', calc.formatDisplay(1e-15), '1×10⁻¹⁵') // 1.5.17 修订：课本式（值不变、只换记法）
eq('C 5e-16 是真值', calc.formatDisplay(5e-16), '5×10⁻¹⁶') // 1.5.17 修订：课本式
eq('C −2.5e-16 是真值', calc.formatDisplay(-2.5e-16), '−2.5×10⁻¹⁶') // 1.5.17 修订：课本式
eq('C cleanNum 放行 1e-16', calc.cleanNum(1e-16), 1e-16)
{
const r = calc.solveQuad(1, 1e16, 1)
eq('C 二次方程小根不再吞成 0（1.6.0 自查 B4 修订：小根现为 x2）', calc.formatDisplay(r.x2), '−1×10⁻¹⁶') // 1.5.17 修订：课本式
eq('C 二次方程小根 ansStr（1.6.0 自查 B4 修订：小根现为 x2）', F154.ansStr('x2', r.x2, 28), 'x2 = −1×10⁻¹⁶') // 1.5.17 修订：课本式
}
{
const r = calc.solveSystem(1e16, 0, 1, 0, 1, 1)
eq('C 方程组小解不再吞成 0', calc.formatDisplay(r.x), '1×10⁻¹⁶') // 1.5.17 修订：课本式
}
eq('C 守卫 sin(180°) 尾巴仍归零', calc.formatDisplay(calc.evaluate('sin(180)')), '0')
eq('C 守卫 cos(90°) 尾巴仍归零', calc.formatDisplay(calc.evaluate('cos(90)')), '0')
eq('C 守卫 0.1+0.2−0.3 残差仍归零', calc.formatDisplay(calc.evaluate('0.1+0.2−0.3')), '0')
eq('C 守卫 cleanNum 吞 sin 尾巴原值', calc.cleanNum(1.2246467991473532e-16), 0)
eq('C 口径记录 极小真商改救援显示（1.5.18 修订：原口径为仍归零）', calc.formatDisplay(3.3333333333333335e-16), '3.33333333333×10⁻¹⁶')
eq('C 1e-14 乘积不变', calc.formatDisplay(calc.evaluate('0.0000001×0.0000001')), '1×10⁻¹⁴') // 1.5.17 修订：课本式
eq('C 1e-13 不变', calc.formatDisplay(1e-13), '1×10⁻¹³') // 1.5.17 修订：课本式

// ---------- D. 二次方程溢出（修复正例 + 正常大数守卫） ----------
// 【1.5.20 修订披露】本组前四条与下方页面级两条的旧期望（判别式溢出报错）
// 被第十四轮复审 N-05 定版推翻：旧版先算原始判别式、溢出即报错，1.5.7 的
// 尺度归一化根本没机会执行；1.5.20 改为先归一化再判别，归一化后根/虚部
// 仍非有限才报错。四条的方程在归一化后都有可表示的根/复根，故按新口径
// 改钉结果（逐条见下）；真溢出的三条（a 极小/复数虚部/线性退化）仍报错、
// 未动。1.5.7 A3 的两条同族钉注亦同步修订（见该文件）。
const ERR = '数字太大，超出精确计算范围'
{
const r = calc.solveQuad(1, 1e308, 1)
eq('D【1.5.20 修订】b=1e308 归一化后判两根（旧期望：判别式溢出报错）', r.type, 'two')
approx('D【1.5.20 修订】b=1e308 小根量级', Math.abs(r.x2), 1e-308, 1e-314)
approx('D【1.5.20 修订】b=1e308 大根量级', Math.abs(r.x1), 1e308, 1e302)
}
{
const r = calc.solveQuad(1, 1e200, 1)
eq('D【1.5.20 修订】b=1e200 归一化后判两根（旧期望：判别式溢出报错）', r.type, 'two')
approx('D【1.5.20 修订】b=1e200 小根量级', Math.abs(r.x2), 1e-200, 1e-206)
approx('D【1.5.20 修订】b=1e200 大根量级', Math.abs(r.x1), 1e200, 1e194)
}
{
const r = calc.solveQuad(1e200, 1e200, 1e200)
eq('D【1.5.20 修订】等系数 1e200 归一化后判复数根（旧期望：判别式 NaN 报错）', r.type, 'complex')
approx('D【1.5.20 修订】等系数复根实部', r.re, -0.5)
approx('D【1.5.20 修订】等系数复根虚部', r.im, Math.sqrt(3) / 2)
}
{
const r = calc.solveQuad(1e308, 1, 1)
eq('D【1.5.20 修订】a=1e308 归一化后判复数根（旧期望：判别式 −Infinity 报错）', r.type, 'complex')
approx('D【1.5.20 修订】a=1e308 复根虚部', r.im, 1e-154, 1e-160)
ok('D【1.5.20 修订】a=1e308 复根实部有限', isFinite(r.re))
}
eq('D a 极小稳定求根溢出报错', calc.solveQuad(1e-300, 1e154, 1).error, ERR)
eq('D 复数虚部溢出报错', calc.solveQuad(1e-320, 0, 1e308).error, ERR)
eq('D 线性退化根溢出报错', calc.solveQuad(0, 1e-320, 1e308).error, ERR)
{
const r = calc.solveQuad(1, 1e154, 1)
eq('D 守卫 b=1e154 合法大根 type', r.type, 'two')
approx('D 守卫 小根量级', Math.abs(r.x2), 1e-154, 1e-160)
approx('D 守卫 大根量级', Math.abs(r.x1), 1e154, 1e148)
ok('D 守卫 两根有限', isFinite(r.x1) && isFinite(r.x2))
}
{
const r = calc.solveQuad(2, -3, 1)
eq('D 守卫 普通方程 type', r.type, 'two'); approx('D 守卫 普通根1', r.x1, 0.5); approx('D 守卫 普通根2', r.x2, 1)
}
{
const inst = makeInst()
inst.qa = '1'; inst.qb = '1' + '0'.repeat(200); inst.qc = '1'; inst.quadSolve()
eq('D【1.5.20 修订】二次方程页 b=1e200 显示两根（旧期望：显示报错行）', JSON.stringify(inst.qLines), JSON.stringify(['判别式 Δ = 1 > 0', 'x1 = −1×10²⁰⁰', 'x2 = −1×10⁻²⁰⁰']))
eq('D【1.5.20 修订】b=1e200 有根时可看图象（旧期望：不可看图象）', inst.qCanPlot, true)
}

// ---------- E. 根式精确性（核实记录，不属实） ----------
{
const a = 1.41421356237
const r = calc.solveQuad(a, 0, -2)
eq('E √2 浮点近似系数 toFraction 为 null', calc.toFraction(a), null)
eq('E √2 浮点近似系数 quadRadStrs 回退 null', F154.quadRadStrs(a, 0, -2, r.x1, r.x2), null)
const inst = makeInst()
inst.qa = '1.41421356237'; inst.qb = '0'; inst.qc = '-2'; inst.quadSolve()
eq('E quad 页回退纯小数 x1', inst.qLines[1], 'x1 ≈ −1.189207115')
ok('E quad 页无根式冒充', inst.qLines.join('').indexOf('√') < 0 || inst.qLines[0].indexOf('Δ') >= 0 && inst.qLines[1].indexOf('√') < 0 && inst.qLines[2].indexOf('√') < 0)
}
{
const inst = makeInst()
inst.qa = '0.3333333333'; inst.qb = '0'; inst.qc = '-3'; inst.quadSolve()
eq('E 0.3333333333 被认作 1/3（既定容差口径）', JSON.stringify(calc.toFraction(0.3333333333)), JSON.stringify({ n: 1, d: 3}))
eq('E Δ 完全平方走有理路径 x1 显示浮点根原值', inst.qLines[1], 'x1 = −3.00000000015')
eq('E Δ 完全平方走有理路径 x2 显示浮点根原值', inst.qLines[2], 'x2 = 3.00000000015')
const r = calc.solveQuad(0.3333333333, 0, -2)
eq('E 口径记录 c=−2 时给 √6（自检容差内）', JSON.stringify(F154.quadRadStrs(0.3333333333, 0, -2, r.x1, r.x2)), JSON.stringify({ x1: '−√6', x2: '√6', exact: false }))
}

// ---------- F. 分数钮边界（核实记录，不属实） ----------
function feedCalc(expr) { const i = makeInst(); i.expr = expr; i.refreshCalc(); return i}
{
const ci = feedCalc('355÷113')
eq('F 355÷113 出钮', ci.canFrac, true)
eq('F 355÷113 钮面直显分数（7 字）', ci.chipText, '355/113')
ci.fracOn = true; ci.refreshCalc()
eq('F 355÷113 切换后主行', ci.resDisp, '= 355/113')
ok('F 355÷113 切换后主行 ≤16 字', ci.resDisp.length <= 16)
}
{
const ci = feedCalc('9999÷9998')
eq('F 9999÷9998 出钮', ci.canFrac, true)
eq('F 9999÷9998 分数 9 字超直显上限回落文字钮', ci.chipText, '看分数')
ci.fracOn = true; ci.refreshCalc()
eq('F 9999÷9998 切换后主行', ci.resDisp, '= 9999/9998')
ok('F 9999÷9998 切换后主行 ≤16 字', ci.resDisp.length <= 16)
}
{
const ci = feedCalc('123456789÷987654321')
eq('F 超分母上限不出钮', ci.canFrac, false)
ok('F 超分母上限主行 ≤16 字', ci.resDisp.length <= 16, ci.resDisp)
}

// ---------- G. 单位带回负温（核实记录，不属实） ----------
eq('G −40 °C→°F 过程式', F155.buildUnitProc(3, 'c', 'f', -40), '−40×1.8+32')
eq('G −40 °C→°F 过程式求值', calc.evaluate(F155.buildUnitProc(3, 'c', 'f', -40)), -40)
eq('G −40 °C→°F 与 convertUnit 一致', calc.convertUnit(3, 'c', 'f', -40), -40)
eq('G −40 °F→°C 过程式', F155.buildUnitProc(3, 'f', 'c', -40), '(−40−32)÷1.8')
eq('G −40 °F→°C 过程式求值', calc.evaluate(F155.buildUnitProc(3, 'f', 'c', -40)), -40)

console.log('regression-1.5.6: ' + pass + ' passed, ' + fail + ' failed')
if (fail) process.exit(1)
