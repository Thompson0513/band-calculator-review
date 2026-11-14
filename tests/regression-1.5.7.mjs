// 回归测试 1.5.7：ChatGPT 第三份报告（对 GitHub 审查仓 1.5.6 的独立审计）逐项实跑核实后的修复
// A.solveQuad 判别式容差带 Math.max(1, …) 绝对下限：方程整体缩小后
// 真判别式被阈值吞掉——x²−1e-13=0 误报重根 0（应为两实根 ±3.1622776601683795e-7），
// x²+1e-13=0 同样误报重根（应为两虚根 ±3.1622776601683795e-7·i）。
// 这是 1.5.6 在 solveSystem 修过的同一类病，solveQuad 当时漏了。
// 修复：solveQuad 系数尺度归一化（同除以 max(|a|,|b|,|c|)）＋纯相对容差。
// 附带根治：系数整体极小时 b²、4ac 下溢成 0 的情形（1e-200 缩放）也恢复可判。
// 注意锁定口径：原尺度判别式非有限（溢出/NaN）仍先走 1.5.6 的报错门——
// 如 (1e200,1e200,1e200) 归一化本可解，但 b² 已溢出，按既有口径报「数字太大」。
// B.solveSystem 行列式下溢：1e-200 缩放的对角方程组误报无穷多解
// （D 本身下溢成 0，1.5.6 的纯相对阈值救不了）。修复：每行尺度归一化后再判定。
// C.solveLinear 无有限性守卫：A 极小 B 极大时 x 溢出成 Infinity 被当解返回。
// 修复：与 solveQuad 同口径返回 {error}，linSolve 消费点补 r.error 显示。
// D.报告重提的两条：
// - toFraction 1e-10 容差把 0.3333333333 认作 1/3：1.5.6 已裁定为既定口径
// （与主界面分数识别同一标准），本版不改、继续锁定。
// - simplifySqrt 试除法大整数慢：方程根式路径有 sqrtRat 的 N≤1e12 上限设计（实测
// 9 位小数系数 0ms 返回 null）；独立根号页 1e15 级输入实测约 146ms（服务器），
// 属可接受范围，记录在案不改。
// E.审查仓文件拍平导致 tests 的../src/ 引用失效、run-tests.js
// 含本机绝对路径、部分测试依赖未公开的 paykey.js——已在审查仓按真实结构重排
// 并在 README 注明可运行范围，与产品代码无关。
import { readFileSync} from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++} else { fail++; console.log('FAIL:', name)}}
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want)}
function approx(name, got, want, eps) { ok(name + '（got=' + got + '）', Math.abs(got - want) <= (eps || 1e-9) * Math.max(1, Math.abs(want)))}

// ---------- 页面实例 harness（与 1.5.6 同法） ----------
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
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
globalThis.__calc = calc
globalThis.__paykey = paykeyMod
script = script
.replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
.replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
.replace("import device from '@system.device'", 'const device = globalThis.__device')
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

// ---------- A. 报告原例：x²∓1e-13 ----------
{
const r = calc.solveQuad(1, 0, -1e-13)
eq('A x²-1e-13 type', r.type, 'two')
approx('A x²-1e-13 x1', r.x1, 3.1622776601683795e-7, 1e-6)
approx('A x²-1e-13 x2', r.x2, -3.1622776601683795e-7, 1e-6)
approx('A x²-1e-13 disc', r.disc, 4e-13, 1e-6)
}
{
const r = calc.solveQuad(1, 0, 1e-13)
eq('A x²+1e-13 type', r.type, 'complex')
approx('A x²+1e-13 im', r.im, 3.1622776601683795e-7, 1e-6)
approx('A x²+1e-13 re', r.re, 0)
}
{
// 页面级：二次方程页输入 a=1, b=0, c=-0.0000000000001 应给出两根而非重根
const inst = makeInst()
inst.qa = '1'; inst.qb = '0'; inst.qc = '-0.0000000000001'
inst.quadSolve()
ok('A 二次页不报重根（qLines=' + JSON.stringify(inst.qLines) + '）', inst.qLines.join(' ').indexOf('重根') < 0 && inst.qLines.join(' ').indexOf('x1') >= 0)
}

// ---------- A2. 尺度不变性扫描：同一方程乘任意尺度，根与判定不变 ----------
{
const bases = [
{ abc: [1, 0, -1], type: 'two', roots: [1, -1]},
{ abc: [1, -3, 2], type: 'two', roots: [2, 1]},
{ abc: [2, -3, -2], type: 'two', roots: [2, -0.5]},
{ abc: [1, -2, 1], type: 'one', roots: [1]},
{ abc: [1, 0, 1], type: 'complex', roots: [1]} // im
]
const scales = [1e-200, 1e-100, 1e-13, 1e-7, 1, 1e7, 1e100, 1e150]
for (const b of bases) {
for (const s of scales) {
const r = calc.solveQuad(b.abc[0] * s, b.abc[1] * s, b.abc[2] * s)
eq('A2 尺度 ' + s + ' · ' + b.abc.join(',') + ' type', r.type, b.type)
if (r.type === 'two') { approx('A2 尺度 ' + s + ' x1', r.x1, b.roots[0], 1e-6); approx('A2 尺度 ' + s + ' x2', r.x2, b.roots[1], 1e-6)}
if (r.type === 'one') approx('A2 尺度 ' + s + ' x', r.x, b.roots[0], 1e-6)
if (r.type === 'complex') approx('A2 尺度 ' + s + ' im', r.im, b.roots[0], 1e-6)
}
}
}

// ---------- A3. 守卫：旧口径不回退 ----------
eq('A3 小数系数假重根仍判重根', calc.solveQuad(0.1, 0.7, 1.225).type, 'one')
approx('A3 假重根值', calc.solveQuad(0.1, 0.7, 1.225).x, -3.5)
eq('A3 判别式溢出仍报错', calc.solveQuad(1, 1e308, 1).error, '数字太大，超出精确计算范围')
eq('A3 b² 溢出成 NaN 仍报错（锁定：有限门先于归一化）', calc.solveQuad(1e200, 1e200, 1e200).error, '数字太大，超出精确计算范围')
{
const r = calc.solveQuad(1, 1e16, 1) // 1.5.6 C 组守卫：韦达小根 −1e-16 不许被归零/丢失
eq('A3 大系数小根 type', r.type, 'two')
const small1 = Math.abs(r.x1) < Math.abs(r.x2) ? r.x1 : r.x2
approx('A3 大系数小根', small1, -1e-16, 1e-3)
}
{
const r = calc.solveQuad(1, 999999999, 1) // 1.4.17 灾难性消去守卫
const small2 = Math.abs(r.x1) < Math.abs(r.x2) ? r.x1 : r.x2
approx('A3 消去守卫小根', small2, -1.000000001e-9, 1e-6)
}
// 整数方程精确性守卫：归一化只许在极端尺度介入，普通整数方程必须保持精确根
{
const r = calc.solveQuad(1, -5, 6)
eq('A3 整数方程 x1 精确', r.x1, 3); eq('A3 整数方程 x2 精确', r.x2, 2)
const s = calc.solveSystem(2, 1, 5, 1, -1, 1)
eq('A3 整数方程组 x 精确', s.x, 2); eq('A3 整数方程组 y 精确', s.y, 1)
}

// ---------- B. 方程组尺度不变性 ----------
{
const scales = [1e-200, 1e-160, 1e-7, 1, 1e7, 1e200]
for (const s of scales) {
const r = calc.solveSystem(s, 0, s, 0, s, s)
eq('B 对角缩放 ' + s + ' type', r.type, 'one')
approx('B 对角缩放 ' + s + ' x', r.x, 1); approx('B 对角缩放 ' + s + ' y', r.y, 1)
eq('B 平行缩放 ' + s + ' 判无解', calc.solveSystem(s, s, 2 * s, s, s, 3 * s).type, 'none')
eq('B 重合缩放 ' + s + ' 判无穷多解', calc.solveSystem(s, s, 2 * s, 2 * s, 2 * s, 4 * s).type, 'infinite')
}
eq('B 守卫 0.1/0.7 倍式仍无穷多解', calc.solveSystem(0.1, 0.7, 1, 0.3, 2.1, 3).type, 'infinite')
eq('B 守卫 1.5.6A 原例', calc.solveSystem(1e-7, 0, 1e-7, 0, 1e-7, 1e-7).type, 'one')
eq('B 零行无解不回退', calc.solveSystem(0, 0, 5, 1, 1, 1).type, 'none')
}

// ---------- C. solveLinear 有限性守卫 ----------
eq('C 溢出解报错', calc.solveLinear(1e-320, 0, 0, 1e300).error, '数字太大，超出精确计算范围')
{
const r = calc.solveLinear(2, 3, 5, -3)
eq('C 常规 type', r.type, 'one'); approx('C 常规 x', r.x, 2)
eq('C 恒等式', calc.solveLinear(1, 2, 1, 2).type, 'infinite')
eq('C 无解', calc.solveLinear(1, 2, 1, 3).type, 'none')
}

console.log('regression-1.5.7: pass=' + pass + ' fail=' + fail)
if (fail > 0) process.exit(1)
