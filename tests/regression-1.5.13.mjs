// 回归测试 1.5.13：ChatGPT 第九份报告（对 1.5.12 的独立复审）逐项实跑核实后的修复
// 九项全部实跑复现（报告 1~8 为缺陷、9 为条件性兼容风险）：
// A. 小系数二次/三次项＋大常数被误判一次（报告 1、2）：0.0000000001x²+x=1000000000
//    旧版给假解 x=1e9（真根 916079783.0996… 与 −10916079783.0996…）；三次例同理。
//    根因：识别只在 |x|≤4 采样、显著性门与拟合容差又随函数尺度 S 放大，小项在小
//    探针上的贡献低于大常数带来的 ulp 级求值噪声。修复：多尺度识别——加大尺度
//    梯子点（±16…±2^24，抛错/非有限跳过），小/大尺度各估一份 (a, b)，显著性按
//    各自尺度的噪声额度（8·EPSILON·两边量级）判，两尺度估值不一致报不支持；
//    大尺度显著的二次项用大尺度估值求解，一次方程 b 也优先大尺度估值。
// B. 方程组交叉项漏检（报告 3）：x+0.0000000001xy=0 与 x=1 旧版误判一次给出
//    「无解」（真解 x=1, y=−1e10）。修复：coef 加大幅值探针 (512,512) 等，容差改
//    逐点噪声额度（随两边量级与探针坐标走），不再用 1e-8·S 尺度项；该组现正确
//    报「只支持二元一次」（它本来就不是一次方程组）。
// C. 常数等式误判（报告 4、5）：相对容差在大数（差 10）与极小数（差 1e-22）两头
//    都吞真实差异。修复：判据改按 ulp——两边非零时差 ≤3·EPSILON·较大边，一边
//    为零时只吸收 ≤6e-17 相消尾巴；判「不相等」但两边显示串相同时改全位展示。
// D. 运算结果超安全整数静默舍入（报告 6）：9007199254740992+1 旧版吞掉 +1。
//    修复：解析器给 +/−（TwoSum）、×/÷/²（Dekker TwoProduct）、整数 ^（BigInt
//    核对）加精确性守卫，结果装不下精确值且仍在全位显示量级（<1e21）时报
//    「整数超出精确范围」；≥1e21 科学计数法量级按浮点惯例不拦（10^30 不误伤）。
// E. 阶乘精度（报告 7）：23! 起双精度装不下精确值（与真值差 1572864）旧版静默
//    给错整数。修复：fact 逐步用 TwoProduct 误差核对，23! 起报精确范围错误；
//    22! 及以下每步可精确表示、不受影响（阶乘是精确整数功能，与 gcdLcm 同口径）。
// F. 精确整数被标近似（报告 8）：fracIsExact 对分母 1 的整数分数也走 12 位比对，
//    而 cleanNum 对整数保留全位——1234567890123 在分数模式被标 ≈。修复：
//    fr.d===1 时逐位比 fr.n===v。
// G. 无 BigInt 回退盲区（报告 9，条件性风险）：9007199254740993e5 在无 BigInt
//    运行时被 String 回读放行（真实差 31072）。修复：回退改 toFixed(0) 精确展开
//    比对，盲区关闭（本组在隐藏全局 BigInt 的环境里实测）；手环真机 BigInt 是否
//    存在仍建议装机时顺手验一次（输 9007199254740993 应报精确范围错误）。
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


// ---------- A. 多尺度识别：小系数高次项＋大常数 ----------
{ const L = eqSolveLines('0.0000000001x^2+x=1000000000'); ok('A1 二次不再误判一次（' + JSON.stringify(L) + '）', L.length === 4 && L[1].indexOf('判别式') === 0 && L[2].indexOf('916,079,783') >= 0 && L[3].indexOf('-10,916,079,783') >= 0) }
{ const L = eqSolveLines('0.0000000001x^2=1000000000'); ok('A2 无一次项的小系数二次（' + JSON.stringify(L) + '）', L.length === 4 && L[2].indexOf('3,162,277,660') >= 0) }
eq('A3 三次报不支持（不再给假解 1e9）', eqSolveLines('x+0.0000000001x^3=1000000000')[0], '只支持一元一次 / 二次方程')
eq('A4 守卫：x=0.1 仍只给一个根', eqSolveLines('x=0.1')[1], 'x = 1/10 = 0.1')
eq('A5 守卫：大常数一次方程根不偏（旧 b1 误差下根偏出约 60）', eqSolveLines('0.1x=1000000000')[1], 'x ≈ 10,000,000,000')
{ const L = eqSolveLines('100000000x+0.0000001x^2=100000000'); ok('A6 守卫：小尺度显著的二次照旧（' + JSON.stringify(L) + '）', L.length === 4 && L[1].indexOf('判别式') === 0) }
eq('A7 守卫：普通二次不变', eqSolveLines('x^2-3x+2=0')[1], '判别式 Δ = 1 > 0')

// ---------- B. 方程组交叉项 ----------
eq('B1 xy 小系数报只支持二元一次（不再误判无解）', eqSolveLines('x+0.0000000001xy=0', 'x=1')[0], '方程组只支持二元一次')
eq('B2 负号变体同样识破', eqSolveLines('x-0.0000000001xy=0', 'x=1')[0], '方程组只支持二元一次')
{ const L = eqSolveLines('2x+3y=8', 'x-y=1'); ok('B3 守卫：普通方程组照常（' + JSON.stringify(L) + '）', L.length === 2 && L[0].indexOf('2.2') >= 0 && L[1].indexOf('1.2') >= 0) }
{ const L = eqSolveLines('0.1x+0.1y=1000000000', 'x-y=0'); ok('B4 守卫：大常数一次方程组照常（旧单位尺度系数下根偏出约 1192）', L.length === 2 && L[0].indexOf('4,999,999,999.98') >= 0) }

// ---------- C. 常数等式 ulp 判据 ----------
eq('C1 1e16 与 +10 不相等', eqSolveLines('10000000000000000=10000000000000010')[0], '两边不相等')
eq('C2 不相等时全位展示差在哪', eqSolveLines('10000000000000000=10000000000000010')[2], '右边 = 10000000000000010')
eq('C3 1e15 与 +1 不相等', eqSolveLines('1000000000000000=1000000000000001')[0], '两边不相等')
eq('C4 极小数差 1e-22 不相等', eqSolveLines('0.0000000001=0.0000000001000000000001')[0], '两边不相等')
eq('C5 守卫：0.1+0.2=0.3 仍恒等', eqSolveLines('0.1+0.2=0.3')[0], '两边相等：恒等式')
eq('C6 守卫：0.1+0.2-0.3=0 仍恒等', eqSolveLines('0.1+0.2-0.3=0')[0], '两边相等：恒等式')
eq('C7 守卫：√(2)×√(2)=2 仍恒等', eqSolveLines('√(2)×√(2)=2')[0], '两边相等：恒等式')
eq('C8 守卫：1=1.0000000000005 仍不相等', eqSolveLines('1=1.0000000000005')[0], '两边不相等')

// ---------- D. 运算整数精确性守卫 ----------
throws('D1 9007199254740992+1 报错', () => E('9007199254740992+1'))
throws('D2 (9007199254740992+1)-9007199254740992 报错', () => E('(9007199254740992+1)-9007199254740992'))
throws('D3 2^53+1 报错', () => E('2^53+1'))
throws('D4 3^40 报错（幂本身已舍入）', () => E('3^40'))
throws('D5 大整数乘积报错', () => E('123456789×987654321'))
throws('D6 整数平方报错', () => E('123456789²'))
eq('D7 守卫：2^53 精确放行', E('2^53'), 9007199254740992)
eq('D8 守卫：2^54 精确放行', E('2^54'), 18014398509481984)
eq('D9 守卫：10^20 精确放行', E('10^20'), 1e20)
eq('D10 守卫：10^30 科学计数法量级不拦', E('10^30'), 1e30)
eq('D11 守卫：普通乘积照常', E('1000000×1000000'), 1000000000000)
eq('D12 守卫：整除照常', E('18014398509481984÷2'), 9007199254740992)
eq('D13 主界面乘积报错文案', feedCalc('123456789×123456789').resDisp.indexOf('整数超出精确范围') >= 0, true)

// ---------- E. 阶乘精确性 ----------
eq('E1 22! 精确值', E('22!'), 1124000727777607680000)
eq('E2 20! 精确值', E('20!'), 2432902008176640000)
throws('E3 23! 报错（双精度装不下精确值）', () => E('23!'))
throws('E4 25! 报错', () => E('25!'))

// ---------- F. 精确整数不再误标 ≈ ----------
eq('F1 13 位整数分数模式是 =', feedCalc('1234567890123+0', true).resDisp, '= 1234567890123')
eq('F2 2^53 分数模式是 =', feedCalc('9007199254740992+0', true).resDisp, '= 9007199254740992')
eq('F3 守卫：近似分数仍是 ≈', feedCalc('1.0000000002÷3', true).resDisp, '≈ 1/3')

// ---------- G. 无 BigInt 回退（隐藏全局 BigInt 实测） ----------
{
  const saved = globalThis.BigInt
  globalThis.BigInt = undefined
  let threw = false
  try { E('9007199254740993e5') } catch (e) { threw = e.message === 'precision' }
  ok('G1 无 BigInt 时 e5 盲区已关（报错）', threw)
  eq('G2 无 BigInt 时合法整数照常', E('9007199254740992'), 9007199254740992)
  eq('G3 无 BigInt 时 21 位整数照常', E('100000000000000000000'), 1e20)
  globalThis.BigInt = saved
}

// ---------- H. 版本锁 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  ok('H manifest 版本锁 1.5.13/vc52', mf.versionName === '1.5.13' && mf.versionCode === 52)
}

console.log('regression-1.5.13: pass=' + pass + ' fail=' + fail)
