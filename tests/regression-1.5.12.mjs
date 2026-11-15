// 回归测试 1.5.12：ChatGPT 第八份报告（对 1.5.11 的独立复审，思考约 1 小时）逐项实跑核实后的修复
// 九项全部实跑复现、全部属实（第 5 项后半为例外，见 E 组说明）：
// A. 一次方程被浮点噪声误判二次（报告 1）：x=0.1 等五式旧版各造一个 1e16~1e17 级假根。
//    根因：采样二阶差分估出的 a 含相消噪声（|a|·16/S 约 1e-17 级），旧版不做显著性
//    判断直接进 solveQuad。修复：eqSolve 加 a 显著性门（|a|·16 ≤ 1e-15·S 判噪声、
//    按 a=0 走一次路径，随后拟合校验复核一次模型）；真小系数二次（1e8x+1e-7x²，
//    比值 3.2e-15）在门上，不受影响（守卫用例锁定）。
// B. 有限采样被构造多项式欺骗（报告 2）：九次多项式在全部整数探针点恰好为零、被判
//    恒等式；方程组探针 x 只取 {0,±1,2,−2} 同理被骗。修复：一元校验探针加半整数点
//    ±0.5/±1.5/±2.5/±3.5，方程组探针加 x=3、x=0.5 等 15 点——欺骗构造须在十几个点
//    同时为零，超出 38 字输入上限能构造的范围（理论极限如实记录：有限探针不能证明
//    多项式恒等，只能把构造门槛抬出输入长度）。
// C. 表头压缩把非零系数舍成 0 并省略（报告 3）：fmtPolyFit 的 r2/r1 取整把 0.004
//    舍成 0、二次项在「整理成」里凭空消失。修复：取整后为 0 而原值非 0 的系数保留
//    原值（keep），交给 fmtPoly 按 DP/科学计数显示。
// D. 近似分数被标精确等号（报告 4）：1.0000000002÷3 认作 1/3 后主界面与答案行都用
//    「=」。修复：calc 新增 fracIsExact（分数与原值都收到 12 位有效数字后逐位相等
//    才算精确，与 eqSign 回读同哲学）；ansStr/主界面/pvStr 对近似分数改用 ≈，
//    cplxStr 实部分数只认精确的。识别容差本身不动（1.5.4/1.5.6 既定口径）：
//    0.148148148148 在 12 位上与 4/27 完全一致、仍判精确「= 4/27」（守卫锁定）；
//    根式恢复（quadRadStrs）按 1.5.6 已复审锁定的容差口径不变，不在本项范围。
// E. cleanNum 把 1 ulp 级真小值清零（报告 5，前半属实）：1÷10^16×1.1 的乘积双精度值
//    与 12 位回读差 1 ulp（相对 1.1e-16），旧版严格相等判据误吞。修复：极小值保留
//    判据放宽到相对差 ≤1e-13（仍低于实测浮点尾巴 sin π 2.2e-12、cos(π/2) 5.3e-13、
//    0.1+0.2−0.3 7.6e-13，尾巴继续归零）。报告后半例 1e-16÷3（相对差 1.0e-12）与
//    浮点尾巴同带、按值无法区分，维持 1.5.6 既定边界归零——部分采纳，如实记录。
// F. 整数精度检查尾点绕过（报告 6）：9007199254740993. 与 .e0 两种写法因 intDigitsOf
//    正则要求小数点后至少一位数字而漏检。修复：小数部分允许为空（\d*）。
// G. 容差绝对地板吞极小非线性项（报告 7）：fitTol/coef 的固定 +1e-12 地板在方程
//    整体量级低于 1e-12 时把 1e-15xy、1e-15x³ 整个吞掉（一元例旧版给假解 x=8；
//    报告称双根形态，我方复现为一次假解，同源同病）。修复：绝对项改 7e-15·Sside
//    （两边式子自身量级，约 30 ulp 求值噪声额度）；合法极小一次方程组守卫锁定。
// H. 常数等式容差仍偏松（报告 8）：1=1.0000000000005（差 5e-13）被 1e-12 相对容差
//    判恒等式。修复：相对 1e-14＋绝对地板 6e-17（只吸收 0.1+0.2−0.3=5.55e-17 级
//    经典残差；0=1e-16 起判不相等）。
// I. 绘图固定 |y|≤1e6 过滤误杀（报告 9）：y=1e8x+1e8、y=123456789x 画不出、
//    y=1e7·sin(x) 只剩 5 点。修复：上限改自适应 max(1e6, 200×采样|y|中位数)，
//    普通函数（含 tan 渐近线尖峰过滤）行为不变。
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }
function throws(name, fn) { try { fn(); ok(name, false) } catch (e) { ok(name, true) } }
const E = (s, o) => calc.evaluate(s, o)

// ---------- 页面实例 harness（与 1.5.11 同法） ----------
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

// ---------- A. 一次方程不再误判二次 ----------
eq('A x=0.1 只给一个根', eqSolveLines('x=0.1')[1], 'x = 1/10 = 0.1')
eq('A x=0.1 无判别式行', eqSolveLines('x=0.1').length, 2)
eq('A x=0.2', eqSolveLines('x=0.2')[1], 'x = 1/5 = 0.2')
eq('A 0.1x=0.3', eqSolveLines('0.1x=0.3')[1], 'x = 3')
eq('A 0.1x+0.2=0.3', eqSolveLines('0.1x+0.2=0.3')[1], 'x = 1')
eq('A 7x=2.1', eqSolveLines('7x=2.1')[1], 'x = 3/10 = 0.3')
{ const L = eqSolveLines('100000000x+0.0000001x^2=100000000'); ok('A 守卫：真小系数二次仍判二次（' + JSON.stringify(L) + '）', L.length === 4 && L[1].indexOf('判别式') === 0) }
{ const L = eqSolveLines('x^2-3x+2=0'); ok('A 守卫：普通二次不变（' + JSON.stringify(L) + '）', L.length === 4) }

// ---------- B. 采样欺骗被半整数/加密探针识破 ----------
eq('B 九次多项式报不支持', eqSolveLines('x(x^2-1)(x^2-4)(x^2-9)(x^2-16)=0')[0], '只支持一元一次 / 二次方程')
eq('B 方程组欺骗报不支持', eqSolveLines('x(x-1)(x-2)(x+2)=0', 'y=0')[0], '方程组只支持二元一次')

// ---------- C. 表头不丢非零项 ----------
ok('C 表头含 0.004x²（got=' + eqSolveLines('0.004x^2+12345x+12345=0')[0] + '）', eqSolveLines('0.004x^2+12345x+12345=0')[0].indexOf('0.004x²') >= 0)

// ---------- D. 近似分数用 ≈、精确分数仍用 = ----------
eq('D 3x=1.0000000002 答案行', eqSolveLines('3x=1.0000000002')[1], 'x ≈ 1/3 = 0.3333333334')
eq('D 主界面 1.0000000002÷3 切分数', feedCalc('1.0000000002÷3', true).resDisp, '≈ 1/3')
eq('D 主界面 1÷3 切分数仍是 =', feedCalc('1÷3', true).resDisp, '= 1/3')
eq('D 守卫：0.148148148148 仍判精确 4/27', feedCalc('0.148148148148+0', true).resDisp, '= 4/27')
eq('D fracIsExact(1/6)', calc.fracIsExact(1 / 6, calc.toFraction(1 / 6)), true)
eq('D fracIsExact(0.3333333334→1/3)', calc.fracIsExact(0.3333333334, calc.toFraction(0.3333333334)), false)

// ---------- E. cleanNum 极小值判据 ----------
eq('E 1÷10^16×1.1 不再清零', calc.formatDisplay(E('1/10^16*1.1')), '1.1×10⁻¹⁶') // 1.5.17 修订：课本式
eq('E sin(π) 尾巴仍归零', calc.formatDisplay(Math.sin(Math.PI)), '0')
eq('E 0.1+0.2-0.3 尾巴仍归零', calc.cleanNum(0.1 + 0.2 - 0.3), 0)
eq('E 边界维持：(1/3)×1e-15 仍归零（与尾巴同带）', calc.cleanNum((1 / 3) * 1e-15), 0)
eq('E 1e-16 仍保留', calc.cleanNum(1e-16), 1e-16)

// ---------- F. 整数检查尾点形式 ----------
throws('F 9007199254740993. 抛 precision', () => E('9007199254740993.'))
throws('F 9007199254740993.e0 抛 precision', () => E('9007199254740993.e0'))
eq('F 123. 正常求值', E('123.'), 123)
eq('F 9007199254740992. 合法不误伤', E('9007199254740992.'), 9007199254740992)

// ---------- G. 容差地板不再吞极小非线性项 ----------
eq('G 系统 1e-15xy 报不支持', eqSolveLines('0.000000000000001xy=0', 'x=1')[0], '方程组只支持二元一次')
eq('G 1e-15x³ 报不支持（不再给假解 x=8）', eqSolveLines('0.000000000000001x^3=0.000000000000008')[0], '只支持一元一次 / 二次方程')
eq('G 守卫：1e-7xy 仍被识破（1.5.10 用例）', eqSolveLines('0.0000001xy=0', 'x=1')[0], '方程组只支持二元一次')
{ const L = eqSolveLines('0.000000000000001x+0.000000000000001y=0.000000000000002', 'x-y=0'); ok('G 守卫：合法极小一次方程组照常解（' + JSON.stringify(L) + '）', L.length === 2 && L[0].indexOf('x = 1') === 0 && L[1].indexOf('y = 1') === 0) }

// ---------- H. 常数等式收紧 ----------
eq('H 1=1.0000000000005 不相等', eqSolveLines('1=1.0000000000005')[0], '两边不相等')
eq('H 1=1.0000000000001 不相等', eqSolveLines('1=1.0000000000001')[0], '两边不相等')
eq('H 0=1e-16 不相等', eqSolveLines('0=0.0000000000000001')[0], '两边不相等')
eq('H 守卫：0.1+0.2=0.3 仍恒等', eqSolveLines('0.1+0.2=0.3')[0], '两边相等：恒等式')
eq('H 守卫：0.1+0.2-0.3=0 仍恒等', eqSolveLines('0.1+0.2-0.3=0')[0], '两边相等：恒等式')
eq('H 守卫：1=1.0000000005 仍不相等（1.5.11 用例）', eqSolveLines('1=1.0000000005')[0], '两边不相等')

// ---------- I. 绘图自适应上限 ----------
function plotTry(cfg) {
  const inst = makeInst()
  const r = inst.buildPlot(Object.assign({ keyPts: [], title: 't', lines: [], back: 'plotset' }, cfg))
  return { r: r, n: inst.plotPts ? inst.plotPts.length : 0 }
}
{ const p = plotTry({ x0: -4, x1: 4, f: (x) => 1e8 * x + 1e8 }); ok('I y=1e8x+1e8 画得出（pts=' + p.n + '）', p.r === true && p.n >= 90) }
{ const p = plotTry({ x0: -4, x1: 4, f: (x) => 123456789 * x }); ok('I y=123456789x 画得出（pts=' + p.n + '）', p.r === true && p.n >= 90) }
{ const p = plotTry({ x0: -8, x1: 8, f: (x) => 1e7 * Math.sin(x) }); ok('I y=1e7·sin(x) 点数恢复（pts=' + p.n + '）', p.r === true && p.n >= 90) }
{ const p = plotTry({ x0: -8, x1: 8, f: (x) => Math.tan(x) }); ok('I 守卫：tan 行为不变（pts=' + p.n + '）', p.r === true && p.n >= 85) }

// ---------- J. 版本锁 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  ok('J manifest 版本锁 1.5.12/vc51', mf.versionName === '1.5.12' && mf.versionCode === 51)
}

console.log('regression-1.5.12: pass=' + pass + ' fail=' + fail)
