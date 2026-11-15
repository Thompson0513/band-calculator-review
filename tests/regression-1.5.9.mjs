// 回归测试 1.5.9：ChatGPT 第五份报告（对 1.5.8 的独立复审）逐项实跑核实后的修复
//
// A. tan 奇点 ° 路径漏洞（报告一.1，属实——我第四轮探针只测了不带 ° 的输入，结论错误，本轮认错）：
// ° 后缀先把值换算成弧度并置 isRad=true，applyFn 的 useDeg 恒 false，旧奇点检查被绕过，
// tan(90°)=16331239353195370、弧度制 tan(π÷2) 同样漏过。修复：奇点判定统一落在最终弧度值上：
// rad/(π/2) 距最近奇整数 <1e-12 即抛 undefined（90°/270°/450°/3π/2 的 q 实测恰为整数；
// 89.9999999999° 的 q 距 1 为 1.1e-12，不误伤）。
// B. gcdLcm 入口补 isSafeInteger（报告一.2，部分属实）：旧版 gcdLcm(2^53, 0) 直接返回 gcd=2^53。
// C. fracCalc 入口补 isSafeInteger（报告一.3，卫生项）：后检拦不住「输入在解析阶段已被舍入」。
// D. 容差边界扫描（报告二）：近重根 δ 扫描＋根代回残差、方程组分类矩阵（近平行两侧/成比例两侧/尺度）。
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

// ---------- A. tan 奇点 ----------
const E = (s, o) => { try { return calc.evaluate(s, o) } catch (e) { return 'ERR:' + e.message } }
const DEG = { deg: true }, RAD = { deg: false }
for (const s of ['tan(90°)', 'tan(270°)', 'tan(450°)', 'tan(-90°)'])
  eq('A 引擎 ' + s + ' 无意义', E(s, DEG), 'ERR:undefined')
for (const s of ['tan(π÷2)', 'tan(3×π÷2)', 'tan(-π÷2)'])
  eq('A 引擎 弧度 ' + s + ' 无意义', E(s, RAD), 'ERR:undefined')
eq('A 引擎 tan(90) 裸数字仍拦', E('tan(90)', DEG), 'ERR:undefined')
approx('A 引擎 tan(45°)=1', E('tan(45°)', DEG), 1, 1e-12)
approx('A 引擎 弧度 tan(π÷4)=1', E('tan(π÷4)', RAD), 1, 1e-12)
ok('A 引擎 tan(89.9999999999°) 大有限数不误伤（got=' + E('tan(89.9999999999°)', DEG) + '）', isFinite(E('tan(89.9999999999°)', DEG)) && E('tan(89.9999999999°)', DEG) > 1e11)
approx('A 引擎 角度制 tan(π÷2)=tan(1.57°) 不误拦', E('tan(π÷2)', DEG), 0.027422438482097765, 1e-12)
{
  const inst = makeInst(); inst.unlocked = true
  inst.pressKey('tan('); inst.pressKey('9'); inst.pressKey('0'); inst.pressKey('°')
  eq('A 页面 tan(90°) 预览', inst.resDisp, '没有意义')
  const inst2 = makeInst(); inst2.unlocked = true
  inst2.pressKey('tan('); inst2.pressKey('4'); inst2.pressKey('5'); inst2.pressKey('°'); inst2.pressKey(')')
  ok('A 页面 tan(45°) 预览 ≈1（got=' + inst2.resDisp + '）', /= 1$|= 0.99/.test(inst2.resDisp))
}

// ---------- B/C. 安全整数入口 ----------
eq('B gcdLcm(2^53, 0) 入口拦', calc.gcdLcm(9007199254740992, 0).error, '数字太大，超出精确计算范围')
eq('B gcdLcm(3, 2^53) 入口拦', calc.gcdLcm(3, 9007199254740992).error, '数字太大，超出精确计算范围')
eq('B gcdLcm(MAX_SAFE, MAX_SAFE).gcd', calc.gcdLcm(9007199254740991, 9007199254740991).gcd, 9007199254740991)
eq('B gcdLcm(-MAX_SAFE, 0).gcd', calc.gcdLcm(-9007199254740991, 0).gcd, 9007199254740991)
eq('B gcdLcm(0, 5) 原行为', JSON.stringify(calc.gcdLcm(0, 5)), JSON.stringify({ gcd: 5, lcm: 0 }))
eq('B gcdLcm(12, 18) 原行为', JSON.stringify(calc.gcdLcm(12, 18)), JSON.stringify({ gcd: 6, lcm: 36 }))
eq('C fracCalc(2^53,1,+,1,1) 入口拦', calc.fracCalc(9007199254740992, 1, '+', 1, 1).error, '数字太大，超出精确计算范围')
eq('C fracCalc(1,1,+,1,2^53) 入口拦', calc.fracCalc(1, 1, '+', 1, 9007199254740992).error, '数字太大，超出精确计算范围')
eq('C fracCalc 大安全边界精确 n', calc.fracCalc(4503599627370495, 4503599627370495, '*', 2, 1).n, 2)
eq('C fracCalc(1,2,-,1,3)=1/6', calc.fracCalc(1, 2, '-', 1, 3).n + '/' + calc.fracCalc(1, 2, '-', 1, 3).d, '1/6')
eq('C fracCalc 非整数原报错', calc.fracCalc(0.5, 1, '+', 1, 1).error, '请输入整数')

// ---------- D. 容差边界扫描＋残差 ----------
const resR = (a, b, c, x) => Math.abs(a * x * x + b * x + c) / (Math.abs(a) * x * x + Math.abs(b * x) + Math.abs(c) + 1e-300)
const resC = (a, b, c, re, im) => {
  const zr = re * re - im * im, zi = 2 * re * im
  return Math.hypot(a * zr + b * re + c, a * zi + b * im) / (Math.abs(a) * (re * re + im * im) + Math.abs(b) * Math.hypot(re, im) + Math.abs(c) + 1e-300)
}
const quadCases = [
  [1, 2, 1, 'one'], [1, 2, 1 - 1e-9, 'two'], [1, 2, 1 - 1e-11, 'two'], [1, 2, 1 - 1e-13, 'two'],
  [1, 2, 1 + 1e-9, 'complex'], [1, 2, 1 + 1e-11, 'complex'], [1, 2, 0.9999999999999, 'two'], [1, 2, 1.0000000000001, 'complex'],
  [1e-8, 2e-8, 1e-8 * (1 - 1e-11), 'two'], [1e8, 2e8, 1e8 * (1 - 1e-11), 'two'], [3, -6, 3, 'one'], [1, 0, 0, 'one']
]
for (const [a, b, c, ty] of quadCases) {
  const r = calc.solveQuad(a, b, c)
  eq('D 扫描 solveQuad(' + a + ',' + b + ',' + c + ') type', r.type, ty)
  if (r.type === 'two') ok('D 扫描 (' + a + ',' + b + ',' + c + ') 两根残差', resR(a, b, c, r.x1) < 1e-9 && resR(a, b, c, r.x2) < 1e-9)
  if (r.type === 'one') ok('D 扫描 (' + a + ',' + b + ',' + c + ') 重根残差', resR(a, b, c, r.x) < 1e-9)
  if (r.type === 'complex') ok('D 扫描 (' + a + ',' + b + ',' + c + ') 复根残差', resC(a, b, c, r.re, r.im) < 1e-9)
}
eq('D 模糊带 x²+2x+(1+1e-15) 判重根（取舍锁定）', calc.solveQuad(1, 2, 1 + 1e-15).type, 'one')
eq('D 成比例相容 infinite', calc.solveSystem(2, 4, 6, 4, 8, 12).type, 'infinite')
eq('D 成比例不相容 none', calc.solveSystem(2, 4, 6, 4, 8, 13).type, 'none')
{
  const uq = calc.solveSystem(1, 1, 2, 1, 1 + 1e-13, 2 + 1e-13)
  eq('D 近平行唯一解 type', uq.type, 'one')
  ok('D 近平行唯一解 (1,1)＋残差', Math.abs(uq.x - 1) < 1e-6 && Math.abs(uq.y - 1) < 1e-6 && Math.abs(uq.x + (1 + 1e-13) * uq.y - (2 + 1e-13)) < 1e-9)
}
eq('D 近平行不相容 none', calc.solveSystem(1, 1, 2, 1 + 1e-13, 1 + 1e-13, 2 + 1.2e-12).type, 'none')
eq('D 近平行相容 infinite', calc.solveSystem(1, 1, 2, 1 + 1e-13, 1 + 1e-13, 2 + 2e-13).type, 'infinite')
eq('D 近平行 ×1e6 不相容 none', calc.solveSystem(1e6, 1e6, 2e6, (1 + 1e-13) * 1e6, (1 + 1e-13) * 1e6, (2 + 1.2e-12) * 1e6).type, 'none')
eq('D 近平行 ×1e6 相容 infinite', calc.solveSystem(1e6, 1e6, 2e6, (1 + 1e-13) * 1e6, (1 + 1e-13) * 1e6, (2 + 2e-13) * 1e6).type, 'infinite')
{
  const mx = calc.solveSystem(1e-200, 1, 1, 1, 1e-200, 1)
  eq('D 混合量级 1e-200 type', mx.type, 'one'); approx('D 混合量级 x', mx.x, 1); approx('D 混合量级 y', mx.y, 1)
  eq('D 混合量级 1e±100 type', calc.solveSystem(1e100, 1e-100, 1, 1e-100, 1e100, 1).type, 'one')
}

// ---------- E. 版本 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  ok('E manifest 版本锁 1.5.9/vc48', mf.versionName === '1.5.9' && mf.versionCode === 48)
}

console.log('regression-1.5.9: pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
