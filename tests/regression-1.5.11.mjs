// 回归测试 1.5.11：ChatGPT 第七份报告（对 1.5.10 的独立复审）逐项实跑核实后的修复
//
// A. eqSolve 二次系数估计精度（报告一.1，部分属实）：报告原例 1e8x+1e-7x²=1e8 的分类其实正确
//（双根都在），但 ±1 二阶差分的相消误差达 19%，大根 x2 显示 −8.39e14、偏离真值 −1e15 约 16%。
// 改用 ±3 二阶差分估计 a（误差 0.66%，实测 x2=−1.0066e15），验证探针随之改 ±2/±4。
// 更极端的 1e-9x² 例（系数比约 1e17）中二次项低于大线性项在一切安全探针点的浮点噪声底，
// 采样法原理上不可见、会被判一次——属采样识别固有边界（需结构解析才能解），文档化取舍，不假修。
// 顺带修「整理成」表头：非零小系数被显示成 0x²（DP 取整所致），改科学计数显示。
// B. 常数等式容差（报告一.2，属实）：1=1.0000000005 旧版被 1e-9·max(1,·) 判「恒等式」。
// 改 1e-12 相对＋1e-15 绝对地板（只吸收 0.1+0.2 级浮点残差）：该例判不相等，0.1+0.2=0.3 仍判相等。
// C. 整数文字量 .0/e 记法规避（报告一.3，属实）：9007199254740993.0 / 9007199254740993e0 /
// 9.007199254740993e15 旧版都绕过纯整数检查静默舍入。分词器改用 intDigitsOf() 把文字量规整为
// 意图整数数字串（移位语义：总移位决定整数性）后统一核对；非整数文字量（.5 小数等）不受影响。
// D. 历史 ts 超 Date 范围（报告一.4，属实）：ts=1e300 通过 isFinite 后时间显示「NaN年NaN月NaN日」。
// 加载时加 |ts| ≤ 8640000000000000（Date 有效范围）校验，超限归 0。
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
// [审查仓适配] paykey.js 未公开：缺失时用惰性桩满足页面 harness 拼装；本文件断言不涉及付费校验行为，桩不影响结果。本地原版无此回退。
let paykeyMod
try { paykeyMod = loadEsmText(readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8'), 'normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches') } catch (e) { paykeyMod = { normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), normalizeCode: (s) => String(s == null ? '' : s), shortCodeForDevice: () => 'AAAAAA', keyForShortCode: () => '0000000000', keyMatches: () => false } }
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

// ---------- A. 二次系数估计精度 ----------
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '100000000x+0.0000001x^2=100000000'; inst.eqExpr2 = ''; inst.eqSolve()
  ok('A 原例判二次双根（got=' + JSON.stringify(inst.eqLines) + '）', inst.eqLines.length >= 4 && inst.eqLines[2].indexOf('x1') === 0)
  const x2line = inst.eqLines.find(l => l.indexOf('x2') === 0) || ''
  const x2v = parseFloat(x2line.split('=')[1].replace(/,/g, '').replace(/\u2212/g, '-').trim())
  ok('A 大根相对误差 <2%（got=' + x2line + '）', Math.abs(x2v + 1e15) / 1e15 < 0.02)
  ok('A 表头不再显示 0x²（got=' + inst.eqLines[0] + '）', inst.eqLines[0].indexOf('0x²') < 0 && inst.eqLines[0].indexOf('×10⁻⁸') >= 0) // 1.5.17 修订：课本式（原判 e−8/e-8）
}
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = 'x^2-3x+2=0'; inst.eqExpr2 = ''; inst.eqSolve()
  ok('A 常规二次不回退', inst.eqLines.some(l => l.indexOf('x1 = 2') === 0) && inst.eqLines.some(l => l.indexOf('x2 = 1') === 0))
  const inst2 = makeInst(); inst2.unlocked = true
  inst2.eqExpr = '0.0000001x^3=0.0000008'; inst2.eqExpr2 = ''; inst2.eqSolve()
  eq('A 三次小系数仍拒绝', inst2.eqLines[0], '只支持一元一次 / 二次方程')
  const inst3 = makeInst(); inst3.unlocked = true
  inst3.eqExpr = '0.0000001x^2-0.0000003x+0.0000002=0'; inst3.eqExpr2 = ''; inst3.eqSolve()
  ok('A 小系数真二次不回退', inst3.eqLines.some(l => l.indexOf('x1 = 2') === 0))
}

// ---------- B. 常数等式容差 ----------
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '1=1.0000000005'; inst.eqExpr2 = ''; inst.eqSolve()
  eq('B 1=1.0000000005 判不相等', inst.eqLines[0], '两边不相等')
  const inst2 = makeInst(); inst2.unlocked = true
  inst2.eqExpr = '0.1+0.2=0.3'; inst2.eqExpr2 = ''; inst2.eqSolve()
  eq('B 0.1+0.2=0.3 判相等（浮点残差）', inst2.eqLines[0], '两边相等：恒等式')
  const inst3 = makeInst(); inst3.unlocked = true
  inst3.eqExpr = '2+2=4'; inst3.eqExpr2 = ''; inst3.eqSolve()
  eq('B 2+2=4 判相等', inst3.eqLines[0], '两边相等：恒等式')
  const inst4 = makeInst(); inst4.unlocked = true
  inst4.eqExpr = '1=2'; inst4.eqExpr2 = ''; inst4.eqSolve()
  eq('B 1=2 判不相等', inst4.eqLines[0], '两边不相等')
}

// ---------- C. 整数文字量绕过形式 ----------
const E = (s, o) => { try { return calc.evaluate(s, o) } catch (e) { return 'ERR:' + e.message } }
eq('C 9007199254740993.0 拦', E('9007199254740993.0'), 'ERR:precision')
eq('C 9007199254740993e0 拦', E('9007199254740993e0'), 'ERR:precision')
// 1.5.14 口径修订（ChatGPT 第十份报告 K 案）：这两条 e 记法的精确值都是 <1e21 的整数，
// 与 900719925474099.3e1 同形——旧版豁免后会被静默换成另一个整数全位显示。
// 豁免线改按总位数划（>21 位才是数量级记法），≤21 位整数声称不分写法一律核对
eq('C 9.007199254740993e15 现按整数声称核对（1.5.14 口径修订）', E('9.007199254740993e15'), 'ERR:precision')
eq('C 1.0000000000000005e16 现按整数声称核对（1.5.14 口径修订）', E('1.0000000000000005e16'), 'ERR:precision')
eq('C 10000000000000000.0 精确放行', E('10000000000000000.0'), 10000000000000000)
eq('C 9007199254740993e5 拦（String 回读盲区，BigInt 精确比较）', E('9007199254740993e5'), 'ERR:precision')
eq('C 900719925474099300000 纯数字形式同拦', E('900719925474099300000'), 'ERR:precision')
eq('C 1.5e3 放行', E('1.5e3'), 1500)
eq('C 1500e-2 放行', E('1500e-2'), 15)
eq('C 9007199254740993.5 非整数不拦', E('9007199254740993.5'), 9007199254740994)
eq('C 123.456 不受影响', E('123.456'), 123.456)

// ---------- D. 历史 ts 范围 ----------
{
  const badStore = { get(o) { o.success(JSON.stringify([{ expr: '1+1', res: '= 2', ts: 1e300 }, { expr: '2+2', res: '= 4', ts: -1e300 }, { expr: '3+3', res: '= 6', ts: 1700000000000 }])) }, set() {} }
  const inst = makeInst(loadPage(badStore)); inst.unlocked = true
  inst.loadHist()
  eq('D ts=1e300 归 0', inst.hist[0].ts, 0)
  eq('D ts=-1e300 归 0', inst.hist[1].ts, 0)
  eq('D 合法 ts 保留', inst.hist[2].ts, 1700000000000)
  ok('D 时间显示无 NaN（got=' + JSON.stringify(inst.histDisp.map(h => h.time)) + '）', inst.histDisp.every(h => h.time.indexOf('NaN') < 0))
}

// ---------- E. 版本 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  ok('E manifest 版本锁 1.5.11/vc50', mf.versionName === '1.5.11' && mf.versionCode === 50)
}

console.log('regression-1.5.11: pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
