// 回归测试 1.5.10：ChatGPT 第六份报告（对 1.5.9 的独立复审）逐项实跑核实后的修复
//
// A. eqSolve 小系数非线性误判（报告一.1/一.2，属实）：旧版拟合校验容差 1e-6·max(1,·) 带绝对下限，
// 0.0000001xy=0 被当成 0x+0y=0（与 x=1 判「无数个解」，真解 x=1,y=0）；
// 0.0000001x³=0.0000008 被拟合成一次方程给出 x=8（真解 x=2，三次本应报不支持）。
// 修复：两条路径的校验容差都改相对尺度（1e-8·S＋1e-12，S 为本式采样值最大幅度），
// 二元探针加密到 7 点、一元探针加密到 ±2/±3；小系数真线性/真二次方程不受影响（守卫锁定）。
// B. fracCalc 加减前约简（报告一.3，属实）：MAX/MAX + MAX/MAX 不约简时中间和先溢出误报；
// 入口后先 reduceFrac 两个输入，四则都受益。
// C. 历史字段完整性（报告一.4，属实）：loadHist 旧版只验 expr，res 缺失的条目点开必崩
//（useHist 里 item.res.replace）。修复：过滤要求 expr/res 均为字符串且长度受限，ts 非法归 0；
// useHist 再补一道类型守卫。
// D. tan 容差收紧＋大角度精确检查恢复（报告二.6，部分属实）：q 容差 1e-12→1e-13，
// 89.99999999995°/89.99999999999° 恢复有限大值；同时恢复 1.5.9 被统一检查替代掉的角度制
// % 180 精确检查——大角度（如 180000090°）在弧度近似检查下 q 误差约 4e-10 会漏过，属实测回归点。
// 距极点 <约 1e-12° 的角度（89.999999999999°）与极点在双精度下不可分，判无意义，文档化取舍。
// E. simplifySqrt（报告二.7，部分属实）：补 isSafeInteger 入口；试除界改立方根＋末步完全平方检查
//（正确性：试除后 rad 的素因子都 >n^(1/3)，残余平方因子只可能 rad 本身为完全平方）。
// 页面输入框本身有 9 位上限，旧版最坏约 3e4 次循环，真机无感；本项是引擎层卫生＋为上限放开留余量。
// F. evaluate 整数文字量精确性（报告二.8，属实）：9007199254740993 旧版静默按 9007199254740992 算。
// 修复：分词器对纯整数文字量逐位核对（16 位起），已被舍入的抛 precision 错误，
// 页面提示「整数超出精确范围」；可精确表示的（1e16、2^53 的偶数邻居、1e21）放行。
// G. 图象关键点（报告一.5，复现不成立但做结构加固）：sin A=1 实测关键点 3 个齐全——采样极值与真极值
// 差 0.06%，被 8% 留白兜住。按报告建议把关键点先纳入纵轴范围再过滤，改偶然兜住为结构保证。
// H. plotRange（报告二.9，不属实）：±4/±8/±16 的 chips 从未在模板中渲染（模板无 plotRangeChips
// 循环，plotShowRange 计算了也没用），用户根本点不到，不存在「点了不生效」；属死代码，本版清除。
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

// ---------- A. eqSolve 非线性识别 ----------
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '0.0000001xy=0'; inst.eqExpr2 = 'x=1'; inst.eqSolve()
  eq('A xy 小系数报不支持', inst.eqLines[0], '方程组只支持二元一次')
}
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '0.0000001x^3=0.0000008'; inst.eqExpr2 = ''; inst.eqSolve()
  eq('A 三次小系数报不支持', inst.eqLines[0], '只支持一元一次 / 二次方程')
}
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '0.0000001x^4=0.0000016'; inst.eqExpr2 = ''; inst.eqSolve()
  eq('A 四次小系数报不支持', inst.eqLines[0], '只支持一元一次 / 二次方程')
}
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '0.0000001x+0.0000002y=0.0000003'; inst.eqExpr2 = 'x-y=0'; inst.eqSolve()
  eq('A 小系数真线性方程组 x', inst.eqLines[0], 'x = 1')
  eq('A 小系数真线性方程组 y', inst.eqLines[1], 'y = 1')
}
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '0.0000001x^2-0.0000003x+0.0000002=0'; inst.eqExpr2 = ''; inst.eqSolve()
  ok('A 小系数真二次给根 1 与 2（1.6.0 自查 B4 修订：x1<x2）（got=' + JSON.stringify(inst.eqLines) + '）', inst.eqLines.some(l => l.indexOf('x1 = 1') === 0) && inst.eqLines.some(l => l.indexOf('x2 = 2') === 0))
}
{
  const inst = makeInst(); inst.unlocked = true
  inst.eqExpr = '1000000x^2-3000000x+2000000=0'; inst.eqExpr2 = ''; inst.eqSolve()
  ok('A 大系数二次不回退（1.6.0 自查 B4 修订：x1 为小根 1）', inst.eqLines.some(l => l.indexOf('x1 = 1') === 0))
  const inst2 = makeInst(); inst2.unlocked = true
  inst2.eqExpr = 'x+y=3'; inst2.eqExpr2 = 'x-y=1'; inst2.eqSolve()
  eq('A 常规方程组不回退 x', inst2.eqLines[0], 'x = 2')
}

// ---------- B. fracCalc 约简 ----------
eq('B MAX/MAX + MAX/MAX = 2', JSON.stringify(calc.fracCalc(9007199254740991, 9007199254740991, '+', 9007199254740991, 9007199254740991).n) + '/1', '2/1')
eq('B MAX/MAX × MAX/MAX = 1', calc.fracCalc(9007199254740991, 9007199254740991, '*', 9007199254740991, 9007199254740991).n, 1)
eq('B 6/10 + 9/15 = 6/5', calc.fracCalc(6, 10, '+', 9, 15).n + '/' + calc.fracCalc(6, 10, '+', 9, 15).d, '6/5')
eq('B 负分母 1/-2 + 1/2 = 0', calc.fracCalc(1, -2, '+', 1, 2).n, 0)
eq('B 真溢出仍报错', calc.fracCalc(9007199254740991, 1, '+', 9007199254740991, 1).error, '数字太大，超出精确计算范围')

// ---------- C. 历史字段完整性 ----------
{
  const badStore = { get(o) { o.success(JSON.stringify([{ expr: '1+1' }, { expr: '2+2', res: 42 }, { expr: '3+3', res: '= 6', ts: 'abc' }, { expr: '4+4', res: '= 8', ts: 1700000000000 }])) }, set() {} }
  const inst = makeInst(loadPage(badStore)); inst.unlocked = true
  inst.loadHist()
  eq('C 残缺条目被过滤（剩 2 条）', inst.hist.length, 2)
  eq('C 非法 ts 归 0', inst.hist[0].ts, 0)
  eq('C 合法 ts 保留', inst.hist[1].ts, 1700000000000)
  let crashed = false
  try { inst.useHist({ expr: '1+1' }) } catch (e) { crashed = true }
  ok('C useHist 残缺条目不崩', !crashed)
  inst.useHist(inst.hist[1])
  eq('C useHist 合法条目可用', inst.expr, '= 8')
}

// ---------- D. tan 边界 ----------
const E = (s, o) => { try { return calc.evaluate(s, o) } catch (e) { return 'ERR:' + e.message } }
const DEG = { deg: true }
eq('D tan(180000090°) 精确检查', E('tan(180000090)', DEG), 'ERR:undefined')
ok('D tan(89.99999999995°) 有限', isFinite(E('tan(89.99999999995°)', DEG)))
ok('D tan(89.99999999999°) 有限', isFinite(E('tan(89.99999999999°)', DEG)))
eq('D tan(89.999999999999°) 模糊带判无意义（取舍锁定）', E('tan(89.999999999999°)', DEG), 'ERR:undefined')
eq('D tan(90°) 仍无意义', E('tan(90°)', DEG), 'ERR:undefined')
approx('D tan(45°)=1', E('tan(45°)', DEG), 1, 1e-12)

// ---------- E. simplifySqrt ----------
eq('E √12 = 2√3', JSON.stringify(calc.simplifySqrt(12)), JSON.stringify({ coef: 2, rad: 3, dec: Math.sqrt(12) }))
eq('E √99980001 = 9999', calc.simplifySqrt(99980001).coef + '/' + calc.simplifySqrt(99980001).rad, '9999/1')
eq('E √720720 = 12√5005', calc.simplifySqrt(720720).coef + '/' + calc.simplifySqrt(720720).rad, '12/5005')
eq('E 超安全整数报错', calc.simplifySqrt(9007199254740992).error, '数字太大，超出精确计算范围')
{
  let bad = 0
  for (let n = 1; n <= 3000; n++) {
    const r = calc.simplifySqrt(n)
    if (r.error || r.coef * r.coef * r.rad !== n) { bad++; continue }
    for (let k = 2; k * k <= r.rad; k++) if (r.rad % (k * k) === 0) { bad++; break }
  }
  eq('E 1..3000 全量校验（coef²·rad=n 且 rad 无平方因子）', bad, 0)
  eq('E 超 1e12 上限报错（与 sqrtRat 既有上限对齐）', calc.simplifySqrt(9999999999999).error, '数字太大，超出精确计算范围')
  const t0 = Date.now()
  const rp = calc.simplifySqrt(982451653)
  ok('E 上限内大素数 982451653 耗时 <1000ms（实测 ' + (Date.now() - t0) + 'ms）', Date.now() - t0 < 1000 && rp.coef === 1 && rp.rad === 982451653)
}

// ---------- F. evaluate 整数文字量 ----------
eq('F 9007199254740993 报 precision', E('9007199254740993'), 'ERR:precision')
eq('F 9007199254740993+1 同样拦', E('9007199254740993+1'), 'ERR:precision')
eq('F 21 位不精确整数拦', E('123456789012345678901'), 'ERR:precision')
eq('F 9007199254740994 精确偶数放行', E('9007199254740994'), 9007199254740994)
eq('F 1e16 放行', E('10000000000000000'), 10000000000000000)
eq('F 1e21 放行', E('1000000000000000000000'), 1e21)
eq('F 普通算式不受影响', E('2+3×4'), 14)
{
  const inst = makeInst(); inst.unlocked = true
  for (const dgt of '9007199254740993') inst.pressKey(dgt)
  eq('F 页面预览提示', inst.resDisp, '整数超出精确范围')
}

// ---------- G. 图象关键点结构保证 ----------
{
  const inst = makeInst(); inst.unlocked = true
  inst.plotType = 'sin'; inst.plotVals = { A: '1', k: '1', b: '0', a: '1', c: '0' }
  inst.drawPlot()
  eq('G sin 关键点 3 个齐全', inst.plotKeyPts.length, 3)
  const inst2 = makeInst(); inst2.unlocked = true
  inst2.buildPlot({ f: function (x) { return x }, x0: 0, x1: 1, title: 't', lines: [], back: 'plotcfg', keyPts: [{ x: 0.5, y: 5 }] })
  eq('G 采样外关键点纳入范围后保留', inst2.plotKeyPts.length, 1)
}

// ---------- H. 死代码清除 ----------
ok('H plotRangeChips 已清除', !ux.includes('plotRangeChips'))
ok('H setPlotRange 已清除', !ux.includes('setPlotRange'))

// ---------- I. 版本 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  ok('I manifest 版本锁 1.5.10/vc49', mf.versionName === '1.5.10' && mf.versionCode === 49)
}

console.log('regression-1.5.10: pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
