// 回归测试 1.5.8：ChatGPT 第四份报告（对 1.5.7 的独立审计，15 项清单）逐项实跑核实后的修复
//
// A. 判别容差过粗（报告 03 的核心）：相对容差 1e-12 时，
// {x+y=2; x+(1+1e-13)y=2+1e-13}（真唯一解 x=1,y=1）误判无穷多解；
// x²+2x+(1−1e-13)（真两根 −1±3.162…e-7）误判重根。
// 浮点噪声实际只有 1e-16 级——容差收紧到 1e-14（仍留约 100 倍余量），
// solveQuad 的 eps 与 solveSystem 的 eD/eX/eY 同步收紧；全部旧守卫实测不回退。
// B. solveSystem 无有限性守卫（报告 01）：NaN/Infinity 输入旧版一律落「无解」分支
// （分类错误）。修复：入口六输入守卫＋唯一解分支 x/y 守卫，统一 {error} 口径；
// sysSolve 与 eqin 两个消费点补 r.error 显示。solveLinear 顺带补 A/B 中间量守卫
// （Inf−Inf=NaN 旧版会把 NaN 当解返回）。
// C. fracCalc 中间乘积提前溢出（报告 05）：1000000000/1000000001 × 1000000001/1000000000
// 结果是 1，旧版中间乘积约 1e18 直接报错。修复：乘除交叉约分、加减先约分母 gcd，
// 最终安全整数兜底不变，真溢出仍报错。
// D. 根式自检容差对极小根偏宽（报告 08）：quadRadStrs/quadImRad 的数值自检由
// 1e-9·max(1,|v|) 改为 1e-9·|v|+1e-12（相对为主、绝对下限收到 1e-12）。
//
// E. tan 奇点（报告 07）：tan(90°/270°/450°/−90°) 全部已报「没有意义」，不止 90°。
// F. 隐含乘法（报告 §二.1）：引擎 evaluate 不处理，但输入层 pressKey/appendTok 已补 ×：
// 2sin(30)=1、2√(9)=6、(2+3)×4 式、50%×2 均页面实测通过（见 F 组）。
// G. evaluate 返回 Infinity（报告 02）：页面 = 键对 formatPlain='溢出' 明确拦截
// （不记历史、不更新 Ans），分层口径安全，见 G 组；错误提示文案表也已存在。
// H. 绘图渐近线连线（报告 11）：buildPlot 是 90 点点绘、没有连线段，|y|>1e6 的点直接跳过。
// I. 历史存储损坏（报告 12）：loadHist 有 try/catch＋JSON 容错＋条目过滤，见 H 组。
// J. gcdLcm 安全整数（报告 06）：早已用 isSafeInteger 守卫（大数报错、双零报错、负数正常）。
//
// K. solveQuad 原始判别式溢出先报错（报告 04）：1.5.7 已定版口径，报告亦承认是取舍。
// L. toFraction 1e-10 容差（报告重提）：全应用统一口径，1.5.6 已裁定。
// M. 设备码备用状态（报告 13）：属付费系统冻结区＋大改版，按规矩先与用户讨论，不在本版动。
// N. 数据单位 1024 标注 KB/MB（报告 14）：与国内信息技术教材口径一致（1KB=1024B），不改名。
import { readFileSync} from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++} else { fail++; console.log('FAIL:', name)}}
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want)}
function approx(name, got, want, eps) { ok(name + '（got=' + got + '）', Math.abs(got - want) <= (eps || 1e-9) * Math.max(1, Math.abs(want)))}

// ---------- 页面实例 harness（与 1.5.7 同法，可指定 storage 行为） ----------
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
function loadEsmText(src, names) {
let s = src.replace(/export function /g, 'function ')
s += '\nmodule.exports = { ' + names + '}'
const m = { exports: {}}
new Function('module', 'exports', s)(m, m.exports)
return m.exports
}
const paykeyMod = loadEsmText(readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8'), 'normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches')
function loadPage(storageImpl) {
let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
globalThis.__storage = storageImpl
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
return pageMod.exports
}
const memStore = {}
const def = loadPage({ get(o) { o.success(memStore[o.key] || '')}, set(o) { memStore[o.key] = o.value}})
function makeInst(d) {
const inst = {}
Object.assign(inst, JSON.parse(JSON.stringify((d || def).data)))
for (const k of Object.keys(d || def)) if (typeof (d || def)[k] === 'function') inst[k] = (d || def)[k].bind(inst)
inst.onInit()
return inst
}

// ---------- A. 容差判别力（报告原例） ----------
{
const r = calc.solveSystem(1, 1, 2, 1, 1 + 1e-13, 2 + 1e-13)
eq('A 近平行方程组 type', r.type, 'one')
approx('A 近平行 x', r.x, 1); approx('A 近平行 y', r.y, 1)
}
{
const r = calc.solveQuad(1, 2, 1 - 1e-13)
eq('A 近重根 type', r.type, 'two')
approx('A 近重根 大根', Math.max(r.x1, r.x2), -1 + 3.1622776601683795e-7, 1e-5)
approx('A 近重根 小根', Math.min(r.x1, r.x2), -1 - 3.1622776601683795e-7, 1e-5)
const inst = makeInst()
inst.qa = '1'; inst.qb = '2'; inst.qc = '0.9999999999999'
inst.quadSolve()
ok('A 二次页不报重根（qLines=' + JSON.stringify(inst.qLines) + '）', inst.qLines.join(' ').indexOf('重根') < 0)
}
// A 守卫：浮点噪声级重合/重根不许被收紧后的容差翻案
eq('A 守卫 0.1/0.7 倍式仍无穷多解', calc.solveSystem(0.1, 0.7, 1, 0.3, 2.1, 3).type, 'infinite')
eq('A 守卫 倍式 ×1e6 仍无穷多解', calc.solveSystem(0.1e6, 0.7e6, 1e6, 0.3e6, 2.1e6, 3e6).type, 'infinite')
eq('A 守卫 小数假重根仍判重根', calc.solveQuad(0.1, 0.7, 1.225).type, 'one')
eq('A 守卫 0.3 缩放重根仍判重根', calc.solveQuad(0.3, 0.6, 0.3).type, 'one')
approx('A 守卫 0.3 缩放重根值', calc.solveQuad(0.3, 0.6, 0.3).x, -1)
// A 报告混合数量级三例
{
const r1 = calc.solveSystem(1e-200, 1, 1, 1, 1e-200, 1)
eq('A 混合1 type', r1.type, 'one'); approx('A 混合1 x', r1.x, 1); approx('A 混合1 y', r1.y, 1)
const r2 = calc.solveSystem(1e100, 1e-100, 1, 1e-100, 1e100, 1)
eq('A 混合2 type', r2.type, 'one'); approx('A 混合2 x', r2.x, 1e-100, 1e-6); approx('A 混合2 y', r2.y, 1e-100, 1e-6)
}

// ---------- B. 有限性守卫 ----------
eq('B 方程组 NaN 输入报错', calc.solveSystem(NaN, 1, 1, 1, 1, 1).error, '数字太大，超出精确计算范围')
eq('B 方程组 Inf 输入报错', calc.solveSystem(1, 1, 1, 1, Infinity, 1).error, '数字太大，超出精确计算范围')
eq('B 一次方程 A=NaN 报错', calc.solveLinear(Infinity, 0, Infinity, 5).error, '数字太大，超出精确计算范围')
eq('B 一次方程常规不回退', calc.solveLinear(2, 3, 5, -3).x, 2)
{
const inst = makeInst()
inst.s1a = '1'; inst.s1b = '1'; inst.s1c = '2'; inst.s2a = '1'; inst.s2b = '-1'; inst.s2c = '0'
inst.sysSolve()
eq('B 方程组页常例 x 行', inst.sLines[0], 'x = 1')
eq('B 方程组页常例 y 行', inst.sLines[1], 'y = 1')
}

// ---------- C. fracCalc 交叉约分 ----------
{
const r = calc.fracCalc(1000000000, 1000000001, '*', 1000000001, 1000000000)
eq('C 报告原例 n', r.n, 1); eq('C 报告原例 d', r.d, 1)
const r2 = calc.fracCalc(1, 999999999999, '+', 1, 999999999999)
eq('C 加法同大分母 n', r2.n, 2); eq('C 加法同大分母 d', r2.d, 999999999999)
const r3 = calc.fracCalc(-3, 4, '*', 8, 9)
eq('C 负数交叉约分 n', r3.n, -2); eq('C 负数交叉约分 d', r3.d, 3)
const r4 = calc.fracCalc(2, 3, '/', 4, 5)
eq('C 除法交叉约分 n', r4.n, 5); eq('C 除法交叉约分 d', r4.d, 6)
eq('C 真溢出仍报错', calc.fracCalc(999999999999, 1, '*', 999999999999, 1).error, '数字太大，超出精确计算范围')
const r5 = calc.fracCalc(1, 6, '+', 1, 10)
eq('C 常规加法 n', r5.n, 4); eq('C 常规加法 d', r5.d, 15)
}

// ---------- F. 输入层隐含乘法（页面实测锁定） ----------
{
const inst = makeInst(); inst.unlocked = true
for (const k of ['2', 'sin(', '3', '0', ')']) inst.pressKey(k)
eq('F 2sin(30) 表达式', inst.expr, '2×sin(30)')
eq('F 2sin(30) 结果', inst.resDisp, '= 1')
const inst2 = makeInst(); inst2.unlocked = true
for (const k of ['2', '√(', '9', ')']) inst2.pressKey(k)
eq('F 2√(9) 结果', inst2.resDisp, '= 6')
const inst3 = makeInst(); inst3.unlocked = true
for (const k of ['(', '2', '+', '3', ')', '4']) inst3.pressKey(k)
eq('F (2+3)4 结果', inst3.resDisp, '= 20')
}

// ---------- G. evaluate Infinity 的页面拦截 ----------
{
const inst = makeInst(); inst.unlocked = true
inst.expr = '1e308×1e308'
inst.refreshCalc()
eq('G 溢出预览显示', inst.resDisp, '≈ 溢出')
inst.pressKey('eq')
eq('G 按 = 后 lastAns 不被污染', inst.lastAns, '')
eq('G 按 = 后不记历史', inst.hist.length, 0)
}

// ---------- H. 历史存储损坏容错 ----------
{
const badDef = loadPage({ get(o) { o.success('corrupted{{{json')}, set(o) {}})
let inst = null, threw = false
try { inst = makeInst(badDef)} catch (e) { threw = true}
ok('H 损坏存储不抛错',!threw)
ok('H 损坏存储历史为空',!!inst && Array.isArray(inst.hist) && inst.hist.length === 0)
}

console.log('regression-1.5.8: pass=' + pass + ' fail=' + fail)
if (fail > 0) process.exit(1)
