// 回归测试 1.5.20：第十四轮复审（针对 1.5.19）核实成立项修复 + 工具箱新工具「三角形面积」
// N-01（P1）二次方程判别式相消：solveQuad(999999998, 999999999, 250000000)
//   精确 Δ=1，旧版双精度 Δ 算成 0＋相对容差判零、误报重根 −0.5000000005。
//   修复：整数系数走 BigInt 精确判别式（原始系数上算、分类只依据精确 Δ）；
//   非整数走双双精度（TwoProduct/TwoSum）补偿值＋既有相对容差 1e-14 判定；
//   无 BigInt 运行时整数未缩放路径用双双对精确判符号兜底（§1h）。
// N-02（P1）方程组行列式相消：solveSystem(999999999, 999999998, 1,
//   999999998, 999999997, 2) 精确 D=−1、唯一解 (999999999, −1000000000)，
//   旧版双精度 D 算成 0、误报无解。修复：D/Dx/Dy 与 N-01 同套可靠性方案
//   （行归一化后整数走 BigInt、判定不带容差；非整数走补偿值＋既有容差）。
// N-03（P2）绘图标签重叠：drawPlot('quad2', {a:1, b:999999999, c:0}) 旧版
//   X 轴 7 标签 6 组盒重叠。本版加碰撞消解：标签按「文本实际占用区间」
//   （宽 = min(盒宽, 字数×6px)，按对齐方式在盒内定位；Y 轴纵向行高 12px）
//   排序贪心保留、须留 ≥2px 间隙、后出现者丢弃，刻度记号不动。
//   口径说明：用占用区间而非盒（ll/lw）本身判定——盒是居中锚定的最大可用
//   宽，基线里原点 '0' 与相邻 '1' 的盒本就交叠而文本不交叠（§10 钉注），
//   按盒消解会误伤基线；新用例的占用区间交叠与盒交叠指向同一批标签。
// N-04（P2）abs 透传 dirty（1.5.19 B-01 的 taint 语义定版）：parseAtom
//   函数调用原统一返回 dirty:false，abs(0.1+0.2)−0.3 漏吸附显示尾数，与
//   0.1+0.2−0.3 显示 0 自相矛盾。定版：精确运算透传 dirty——abs 透传
//   arg.dirty；一元负号与括号路径本就透传（§4 一并钉注）；超越/近似函数
//   （sin/cos/tan/log/ln/√/立方根等）维持 false——其输出带自身舍入、误差
//   来源不可由 TwoSum 追踪，按新值处理。
// N-05/N-06（顺手修）归一化前移：solveQuad 先按 max|系数| 归一化再算判别
//   式、solveLinear 仅当原始差相减溢出时才归一化重算——归一化后仍真溢出
//   的才报错。被推翻的旧钉注已在 regression-1.5.6 D 组、regression-1.5.7
//   A3 逐条修订并披露（本文件 §5 钉新口径）。
// N-07 不改：tan 近 90° 模糊带（1e-13 奇点容差）是 1.5.10 已钉注取舍
//   （见 regression-1.5.10 的 tan 边界钉注），本版不动阈值与行为、此处
//   仅引用不新增断言。
// 三角形面积（本版新工具，用户定版口径：计算器不教学——不展示公式、
//   不做推导）：calc.triArea 数值走 Kahan 稳定海伦式（排序后四因子连乘）；
//   边长可无损还原为 ≤15 位十进制整数缩放时，构成/退化判定在整数上精确
//   做（0.1+0.2=0.3 这类十进制退化不被浮点尾巴误判），精确形由四因子
//   素因子分解合并平方因子给出（整数/分数/化简根式），因子超 1e12 或
//   结果不可精确表示时只给小数。页面双显口径与全应用一致。
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond, extra) { if (cond) { pass++ } else { fail++; console.log('FAIL', name, extra == null ? '' : extra) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want, 'want=' + JSON.stringify(want)) }
function approx(name, got, want, rel) { ok(name + '（got=' + got + '）', isFinite(got) && Math.abs(got / want - 1) <= (rel || 1e-9)) }
const E = (s, o) => calc.evaluate(s, o)
const FD = (v) => calc.formatDisplay(v)
const ERR = '数字太大，超出精确计算范围'

const uxPath = new URL('../src/pages/index/index.ux', import.meta.url).pathname
const ux = readFileSync(uxPath, 'utf8')
const calcSrc = readFileSync(new URL('../src/common/calc.js', import.meta.url), 'utf8')
const man = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
let buglog = null
try { buglog = readFileSync(new URL('../BUGLOG.md', import.meta.url), 'utf8') } catch (e) { /* [审查仓适配] BUGLOG.md 不入公开仓，缺失时 8d 断言按 SKIP 处理 */ }

function loadPage() {
  let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
  globalThis.__storage = { get(o) { o.success('') }, set() {} }
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__calc = calc
  globalThis.__paykey = { keyMatches: () => false, normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), shortCodeForDevice: () => 'AAAAAA' }
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  const tmp = join(tmpdir(), 'calc-page-1520-' + process.pid + '.cjs')
  execFileSync(process.execPath, ['-e', 'require("fs").writeFileSync(process.argv[1], process.argv[2])', tmp, script])
  const mod = { exports: {} }
  new Function('module', 'exports', script)(mod, mod.exports)
  return mod.exports
}
const def = loadPage()
function makeInst() {
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
  for (const k of Object.keys(def)) if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
  inst.onInit()
  inst.unlocked = true
  return inst
}
function drawPlot(type, vals) {
  const inst = makeInst()
  inst.plotType = type
  inst.plotVals = vals
  inst.drawPlot()
  return inst
}
function buildSynth(f, x0, x1) {
  const inst = makeInst()
  inst.buildPlot({ f: f, x0: x0, x1: x1, title: 't', keyPts: [], lines: [], back: 'plotcfg' })
  return inst
}
// 标签占用区间不重叠检查（与页面 sweepLabs 同口径：占用宽 min(lw, 字数×6)、
// 按 ta 在盒内定位；Y 轴用 [lt, lt+12]）；返回重叠对数
function occOverlapX(labs) {
  const iv = labs.map(t => {
    const ow = Math.min(t.lw, t.lab.length * 6)
    const off = t.ta === 'left' ? 0 : t.ta === 'right' ? t.lw - ow : (t.lw - ow) / 2
    return [t.ll + off, t.ll + off + ow]
  }).sort((p, q) => p[0] - q[0])
  let bad = 0
  for (let i = 1; i < iv.length; i++) if (iv[i][0] < iv[i - 1][1] + 2) bad++
  return bad
}
function occOverlapY(labs) {
  const iv = labs.map(t => [t.lt, t.lt + 12]).sort((p, q) => p[0] - q[0])
  let bad = 0
  for (let i = 1; i < iv.length; i++) if (iv[i][0] < iv[i - 1][1] + 2) bad++
  return bad
}

// ---------- §1 N-01 二次方程判别式相消 ----------
{
  const r = calc.solveQuad(999999998, 999999999, 250000000)
  eq('1a N-01 判两根（精确 Δ=1）', r.type, 'two')
  eq('1a N-01 disc 显示精确值 1', r.disc, 1)
  ok('1a N-01 x1 与精确 −0.5 差 ≤1 ulp', Math.abs(r.x1 - (-0.5)) <= 1.2e-16, 'x1=' + r.x1)
  eq('1a N-01 x1 显示 −0.5', FD(r.x1), '−0.5')
  eq('1a N-01 x2 精确 −0.500000001', r.x2, -0.500000001)
  // 页面级：Δ 行显示 1、x1 双显分数
  const inst = makeInst()
  inst.qa = '999999998'; inst.qb = '999999999'; inst.qc = '250000000'; inst.quadSolve()
  eq('1b N-01 页面结果行', JSON.stringify(inst.qLines), JSON.stringify(['判别式 Δ = 1 > 0', 'x1 = −1/2 = −0.5', 'x2 = −0.500000001']))
}
// 守卫：真重根与近重根口径不回退（整数精确判零、小数容差路径各一）
eq('1c 整数真重根仍判重根', calc.solveQuad(1, 2, 1).type, 'one')
eq('1c 整数真重根根值', calc.solveQuad(1, 2, 1).x, -1)
eq('1d 小数假重根仍判重根（容差路径）', calc.solveQuad(0.1, 0.7, 1.225).type, 'one')
approx('1d 小数假重根根值', calc.solveQuad(0.1, 0.7, 1.225).x, -3.5, 1e-12)
eq('1e 小数真重根 (0.3,0.6,0.3)', calc.solveQuad(0.3, 0.6, 0.3).type, 'one')
eq('1f 模糊带内侧仍判重根 (1,2,1+1e-15)', calc.solveQuad(1, 2, 1 + 1e-15).type, 'one')
eq('1f 模糊带外侧仍判两根 (1,2,1−1e-13)', calc.solveQuad(1, 2, 1 - 1e-13).type, 'two')
eq('1g 守卫 (1,−0.2,0.01) 重根', calc.solveQuad(1, -0.2, 0.01).type, 'one')
// §1h 无 BigInt 运行时兜底（双双对判符号）：分类仍正确
{
  const saved = globalThis.BigInt
  try {
    globalThis.BigInt = undefined
    eq('1h 无 BigInt 时 N-01 仍判两根', calc.solveQuad(999999998, 999999999, 250000000).type, 'two')
    eq('1h 无 BigInt 时整数真重根仍判重根', calc.solveQuad(1, 2, 1).type, 'one')
    eq('1h 无 BigInt 时 N-02 仍判唯一解', calc.solveSystem(999999999, 999999998, 1, 999999998, 999999997, 2).type, 'one')
    eq('1h 无 BigInt 时 triArea 精确形退纯小数', calc.triArea(2, 3, 4).exact, null)
  } finally { globalThis.BigInt = saved }
  eq('1h BigInt 恢复后 N-01 disc 复原', calc.solveQuad(999999998, 999999999, 250000000).disc, 1)
}

// ---------- §2 N-02 方程组行列式相消 ----------
{
  const r = calc.solveSystem(999999999, 999999998, 1, 999999998, 999999997, 2)
  eq('2a N-02 判唯一解（精确 D=−1）', r.type, 'one')
  eq('2a N-02 x 精确', r.x, 999999999)
  eq('2a N-02 y 精确', r.y, -1000000000)
  eq('2a N-02 xFrac', r.xFrac && r.xFrac.n + '/' + r.xFrac.d, '999999999/1')
  const inst = makeInst()
  inst.s1a = '999999999'; inst.s1b = '999999998'; inst.s1c = '1'
  inst.s2a = '999999998'; inst.s2b = '999999997'; inst.s2c = '2'
  inst.sysSolve()
  eq('2b N-02 页面结果行', JSON.stringify(inst.sLines), JSON.stringify(['x = 999,999,999', 'y = −1,000,000,000']))
}
// 守卫：平行/重合/小数容差/近平行三分类不回退
eq('2c 真平行仍无解', calc.solveSystem(1, 1, 1, 2, 2, 3).type, 'none')
eq('2c 真重合仍无穷多解', calc.solveSystem(1, 1, 1, 2, 2, 2).type, 'infinite')
eq('2d 小数倍式仍无穷多解（容差路径）', calc.solveSystem(0.1, 0.7, 1, 0.3, 2.1, 3).type, 'infinite')
eq('2e 近平行真唯一解（1.5.8 同款）', calc.solveSystem(1, 1, 2, 1, 1 + 1e-13, 2 + 1e-13).type, 'one')
eq('2e 整数平行 Dx≠0 仍无解', calc.solveSystem(1, 1, 2, 2, 2, 5).type, 'none')
eq('2e 近平行相容仍无穷多解', calc.solveSystem(1, 1, 2, 1, 1 - 1e-16, 2).type, 'infinite')
{
  const r = calc.solveSystem(1e150, 0, 1e150, 0, 1e150, 2e150)
  eq('2f 大尺度整数方程组（行归一化后整数路径）', r.type, 'one')
  approx('2f x', r.x, 1); approx('2f y', r.y, 2)
}

// ---------- §3 N-03 绘图标签碰撞消解 ----------
{
  const inst = drawPlot('quad2', { a: '1', b: '999999999', c: '0', k: '1', A: '1' })
  eq('3a N-03 X 标签消解后集合', JSON.stringify(inst.plotLabX.map(t => [t.lab, t.ll, t.lw])),
    JSON.stringify([['−5.0000006×10⁸', 0, 92], ['−5×10⁸', 133, 44], ['−4.9999996×10⁸', 200, 92]]))
  eq('3a N-03 X 占用区间零重叠', occOverlapX(inst.plotLabX), 0)
  eq('3a N-03 刻度记号保留 7 个（只删标签不删记号）', inst.plotTickX.length, 7)
  eq('3b N-03 Y 标签消解后集合', JSON.stringify(inst.plotLabY.map(t => [t.lab, t.ll, t.lt, t.lw])),
    JSON.stringify([['−2.5×10¹⁷', 15, 25, 62]]))
  eq('3b N-03 Y 占用区间零重叠', occOverlapY(inst.plotLabY), 0)
}
// 硬约束：既有基线标签全项逐字保持（与 regression-1.5.19 §10d 同源数据
// 重钉：[lab, ll, lt, ta, lw] 全项）＋全部用例消解后占用区间零重叠
{
  const H = drawPlot('quad2', { a: '0.001', b: '999999999', c: '0', k: '1', A: '1' })
  eq('3c H 例 X 标签项保持', JSON.stringify(H.plotLabX.map(t => [t.lab, t.ll, t.lw, t.ta])), JSON.stringify([['−5×10¹¹', 129, 50, 'center']]))
  eq('3c H 例 Y 标签项保持', JSON.stringify(H.plotLabY.map(t => [t.lab, t.ll, t.lw, t.ta])), JSON.stringify([['−2.5×10²⁰', 15, 62, 'left']]))
  const q = drawPlot('quad2', { a: '1', b: '2', c: '1', k: '1', A: '1' })
  const l = drawPlot('lin2', { a: '1', b: '1', c: '0', k: '2', A: '1' })
  const s = drawPlot('sin', { a: '1', b: '0', c: '0', k: '1', A: '1' })
  const proj = (arr) => arr.map((t) => [t.lab, t.ll, t.lt, t.ta, t.lw])
  eq('3d 正常二次 labX 全项保持', JSON.stringify(proj(q.plotLabX)), JSON.stringify([['−4', 35, 273, 'center', 24], ['−3', 71, 273, 'center', 24], ['−2', 108, 273, 'center', 24], ['−1', 144, 273, 'center', 24], ['1', 217, 273, 'center', 24], ['2', 254, 273, 'center', 24], ['0', 197, 273, 'left', 24]]))
  eq('3d 正常二次 labY 全项保持', JSON.stringify(proj(q.plotLabY)), JSON.stringify([['2', 162, 233, 'right', 26], ['4', 162, 202, 'right', 26], ['6', 162, 172, 'right', 26], ['8', 162, 142, 'right', 26], ['10', 162, 112, 'right', 26], ['12', 162, 82, 'right', 26], ['14', 162, 51, 'right', 26], ['16', 162, 21, 'right', 26]]))
  eq('3d 正常一次 labX 全项保持', JSON.stringify(proj(l.plotLabX)), JSON.stringify([['−3', 35, 167, 'center', 24], ['−2', 71, 167, 'center', 24], ['−1', 108, 167, 'center', 24], ['1', 181, 167, 'center', 24], ['2', 217, 167, 'center', 24], ['3', 254, 167, 'center', 24], ['0', 160, 167, 'left', 24]]))
  eq('3d 正常一次 labY 全项保持', JSON.stringify(proj(l.plotLabY)), JSON.stringify([['−6', 125, 248, 'right', 26], ['−4', 125, 217, 'right', 26], ['−2', 125, 187, 'right', 26], ['2', 125, 127, 'right', 26], ['4', 125, 97, 'right', 26], ['6', 125, 67, 'right', 26], ['8', 125, 36, 'right', 26], ['10', 125, 6, 'right', 26]]))
  eq('3d 正常正弦 labX 全项保持', JSON.stringify(proj(s.plotLabX)), JSON.stringify([['−300', 22, 152, 'center', 24], ['−200', 63, 152, 'center', 24], ['−100', 103, 152, 'center', 24], ['100', 185, 152, 'center', 24], ['200', 225, 152, 'center', 24], ['300', 266, 152, 'center', 24], ['0', 160, 152, 'left', 24]]))
  eq('3d 正常正弦 labY 全项保持', JSON.stringify(proj(s.plotLabY)), JSON.stringify([['−1', 125, 263, 'right', 26], ['−0.8', 125, 238, 'right', 26], ['−0.6', 125, 214, 'right', 26], ['−0.4', 125, 190, 'right', 26], ['−0.2', 125, 166, 'right', 26], ['0.2', 125, 118, 'right', 26], ['0.4', 125, 94, 'right', 26], ['0.6', 125, 70, 'right', 26], ['0.8', 125, 46, 'right', 26], ['1', 125, 21, 'right', 26]]))
  const cases = [['H', H], ['二次', q], ['一次', l], ['正弦', s],
    ['合成右支 §10f', buildSynth((x) => x * 1e19, -8, 8)],
    ['合成右支钳制 §10g', buildSynth((x) => x * 1e19, -1.2, 8)],
    ['合成量程 §10h', buildSynth((x) => x, 999999999999997, 1000000000000007)]]
  for (const [nm, p] of cases) {
    eq('3e ' + nm + ' 消解后 X 占用零重叠', occOverlapX(p.plotLabX), 0)
    eq('3e ' + nm + ' 消解后 Y 占用零重叠', occOverlapY(p.plotLabY), 0)
  }
}

// ---------- §4 N-04 abs 透传 dirty ----------
eq('4a abs(0.1+0.2)−0.3 吸附归零', E('abs(0.1+0.2)−0.3'), 0)
eq('4a 显示 0', FD(E('abs(0.1+0.2)−0.3')), '0')
eq('4b (abs(0.1+0.2)−0.3)×10^10 仍 0', E('(abs(0.1+0.2)−0.3)×10^10'), 0)
eq('4c abs((0.1+0.2)−0.3) 归零', E('abs((0.1+0.2)−0.3)'), 0)
eq('4d abs 内作差 abs(0.3−(0.1+0.2)) 归零', E('abs(0.3−(0.1+0.2))'), 0)
eq('4e 嵌套 abs(abs(0.1+0.2))−0.3 归零', E('abs(abs(0.1+0.2))−0.3'), 0)
eq('4f 一元负号透传 −(0.1+0.2)+0.3 归零', E('−(0.1+0.2)+0.3'), 0)
eq('4f 括号透传 (0.1+0.2)−0.3 归零', E('(0.1+0.2)−0.3'), 0)
// B-01 守卫不回退（与 regression-1.5.19 §1/§4 同源钉注）
eq('4g 守卫 0.1+0.2−0.3 仍 0', E('0.1+0.2−0.3'), 0)
ok('4g 守卫 手打精确差不被吸附', E('1.0000000000000002−1') !== 0)
eq('4g 守卫 手打精确差显示救援', FD(E('1.0000000000000002−1')), '2.22044604925×10⁻¹⁶')
eq('4g 守卫 sin(180°) 显示仍 0（超越函数口径不变）', FD(E('sin(180°)')), '0')
ok('4h 落点：abs 透传 dirty 在位', calcSrc.includes("tk.v === 'abs' ? arg.dirty : false"))

// ---------- §5 N-05/N-06 归一化前移 ----------
{
  const r = calc.solveQuad(1e200, -3e200, 2e200)
  eq('5a N-05 (1e200,−3e200,2e200) 判两根', r.type, 'two')
  eq('5a N-05 大根 2', r.x1, 2)
  eq('5a N-05 小根 1', r.x2, 1)
  const r2 = calc.solveQuad(1, 1e308, 1)
  eq('5b (1,1e308,1) 判两根', r2.type, 'two')
  approx('5b 小根量级 1e-308', Math.abs(r2.x1), 1e-308, 1e-12)
  approx('5b 大根量级 1e308', Math.abs(r2.x2), 1e308, 1e-12)
  const r3 = calc.solveQuad(1e200, 1e200, 1e200)
  eq('5c (1e200,1e200,1e200) 判复数根', r3.type, 'complex')
  eq('5c 复根 disc 精确 −3', r3.disc, -3)
  approx('5c 复根实部', r3.re, -0.5); approx('5c 复根虚部', r3.im, Math.sqrt(3) / 2)
  const r4 = calc.solveQuad(1e308, 1, 1)
  eq('5d (1e308,1,1) 判复数根', r4.type, 'complex')
  approx('5d 复根虚部 1e-154', r4.im, 1e-154, 1e-9)
  // 页面级翻转（原 1.5.6 D 组页面钉注已同步修订）
  const inst = makeInst()
  inst.qa = '1'; inst.qb = '1' + '0'.repeat(200); inst.qc = '1'; inst.quadSolve()
  eq('5e 页面 (1,1e200,1) 显示两根', JSON.stringify(inst.qLines), JSON.stringify(['判别式 Δ = 1 > 0', 'x1 = −1×10⁻²⁰⁰', 'x2 = −1×10²⁰⁰']))
  eq('5e 页面可看图象', inst.qCanPlot, true)
}
// 归一化后仍真溢出的照旧报错（口径不变）
eq('5f a 极小稳定求根溢出仍报错', calc.solveQuad(1e-300, 1e154, 1).error, ERR)
eq('5f 复数虚部溢出仍报错', calc.solveQuad(1e-320, 0, 1e308).error, ERR)
eq('5f 线性退化根溢出仍报错', calc.solveQuad(0, 1e-320, 1e308).error, ERR)
eq('5f NaN 输入仍报错', calc.solveQuad(1, NaN, 1).error, ERR)
eq('5g 守卫 b=1e154 合法大根仍在', calc.solveQuad(1, 1e154, 1).type, 'two')
{
  const r = calc.solveLinear(1e308, 0, -1e308, 0)
  eq('5h N-06 solveLinear(1e308,0,−1e308,0) 判有解', r.type, 'one')
  eq('5h N-06 x = 0', r.x, 0)
  eq('5h N-06 frac 0/1', r.frac && r.frac.n + '/' + r.frac.d, '0/1')
}
eq('5i solveLinear 真溢出仍报错 (1e-320,0,0,1e300)', calc.solveLinear(1e-320, 0, 0, 1e300).error, ERR)
eq('5i solveLinear Inf 输入仍报错', calc.solveLinear(Infinity, 0, Infinity, 5).error, ERR)
eq('5i solveLinear NaN 输入仍报错', calc.solveLinear(NaN, 0, 1, 1).error, ERR)
eq('5j 守卫 普通一次方程不变', calc.solveLinear(2, 0, 1, 3).x, 3)

// ---------- §6 三角形面积 ----------
{
  const r = calc.triArea(3, 4, 5)
  eq('6a 3,4,5 面积 6', r.area, 6)
  eq('6a 3,4,5 精确形', JSON.stringify(r.exact), JSON.stringify({ cn: 6, cd: 1, rad: 1 }))
  eq('6b 5,5,6 面积 12', calc.triArea(5, 5, 6).area, 12)
  const r2 = calc.triArea(2, 3, 4)
  eq('6c 2,3,4 精确形 3√15/4', JSON.stringify(r2.exact), JSON.stringify({ cn: 3, cd: 4, rad: 15 }))
  eq('6c 2,3,4 小数 12 位口径', FD(r2.area), '2.90473750966')
  const r3 = calc.triArea(1, 1, 1)
  eq('6d 等边 1,1,1 精确形 √3/4', JSON.stringify(r3.exact), JSON.stringify({ cn: 1, cd: 4, rad: 3 }))
  eq('6d 等边小数', FD(r3.area), '0.433012701892')
  eq('6e 小数边 1.5,2,2.5 精确形 3/2', JSON.stringify(calc.triArea(1.5, 2, 2.5).exact), JSON.stringify({ cn: 3, cd: 2, rad: 1 }))
  // 细长三角形：Kahan 式 vs 勾股高线法参照，相对误差 < 1e-12
  const rn = calc.triArea(500000, 500000, 1)
  const ref = 0.5 * Math.sqrt(500000 * 500000 - 0.25)
  ok('6f 细长三角形相对误差 <1e-12（got=' + rn.area + '）', Math.abs(rn.area / ref - 1) < 1e-12)
  eq('6f 细长精确形', JSON.stringify(rn.exact), JSON.stringify({ cn: 3, cd: 4, rad: 111111111111 }))
  // 校验分支
  eq('6g 边长 0 报错', calc.triArea(0, 1, 1).error, '请输入有效边长')
  eq('6g 负边长报错', calc.triArea(-1, 2, 2).error, '请输入有效边长')
  eq('6g NaN 报错', calc.triArea(NaN, 1, 1).error, '请输入有效边长')
  eq('6g 两边和小于第三边报错', calc.triArea(1, 2, 4).error, '不能构成三角形')
  eq('6h 两边和等于第三边退化', calc.triArea(1, 2, 3).type, 'degenerate')
  eq('6h 退化面积 0', calc.triArea(1, 2, 3).area, 0)
  eq('6h 十进制退化 0.1,0.2,0.3 精确判定', calc.triArea(0.1, 0.2, 0.3).type, 'degenerate')
  eq('6i 无精确形时 exact 为 null 且面积有限', calc.triArea(1 / 3, 1, 1).exact, null)
  ok('6i 面积有限非 NaN', isFinite(calc.triArea(1 / 3, 1, 1).area))
}
// 页面级
{
  const inst = makeInst()
  eq('6j 默认 3,4,5 结果行', JSON.stringify(inst.tLines), JSON.stringify(['面积 = 6']))
  inst.ta = '2'; inst.tb = '3'; inst.tc = '4'; inst.triSolve()
  eq('6j 2,3,4 双显行', JSON.stringify(inst.tLines), JSON.stringify(['面积 = 3√15/4', '≈ 2.90473750966']))
  inst.ta = '1'; inst.tb = '1'; inst.tc = '1'; inst.triSolve()
  eq('6j 等边双显行', JSON.stringify(inst.tLines), JSON.stringify(['面积 = √3/4', '≈ 0.433012701892']))
  inst.ta = '1.5'; inst.tb = '2'; inst.tc = '2.5'; inst.triSolve()
  eq('6j 分数精确形双显行', JSON.stringify(inst.tLines), JSON.stringify(['面积 = 3/2', '≈ 1.5']))
  inst.ta = '1'; inst.tb = '2'; inst.tc = '3'; inst.triSolve()
  eq('6k 退化提示行', JSON.stringify(inst.tLines), JSON.stringify(['退化成一条直线，面积 = 0']))
  inst.ta = '1'; inst.tb = '2'; inst.tc = '4'; inst.triSolve()
  eq('6k 不能构成提示行', JSON.stringify(inst.tLines), JSON.stringify(['不能构成三角形']))
  inst.ta = ''; inst.tb = '2'; inst.tc = '4'; inst.triSolve()
  eq('6k 空边提示行', JSON.stringify(inst.tLines), JSON.stringify(['三条边都填好就能算']))
  inst.ta = '-3'; inst.tb = '4'; inst.tc = '5'; inst.triSolve()
  eq('6k 负边长提示行', JSON.stringify(inst.tLines), JSON.stringify(['请输入有效边长']))
  inst.ta = '0'; inst.tb = '4'; inst.tc = '5'; inst.triSolve()
  eq('6k 零边长提示行', JSON.stringify(inst.tLines), JSON.stringify(['请输入有效边长']))
  const inst2 = makeInst()
  inst2.openTool('tri')
  eq('6l openTool 落点 view=tri', inst2.view, 'tri')
  eq('6l openTool 默认结果行', JSON.stringify(inst2.tLines), JSON.stringify(['面积 = 6']))
  ok('6m 工具箱列表含 tri 条目', inst2.tools.some(t => t.id === 'tri' && t.name === '三角形面积'))
}
// 落点审计：模板/样式（无裸 div 是全文件铁规）、calc 导出
ok('6n 模板含 tri 视图且无裸 div', ux.includes("view === 'tri'") && !ux.includes('<div>'))
ok('6n calc 导出 triArea', typeof calc.triArea === 'function' && calcSrc.includes('function triArea'))

// ---------- §7 N-07（不改，仅引用） ----------
// tan 近 90° 模糊带钉注见 regression-1.5.10（1e-13 奇点容差取舍锁定），
// 本版未动其阈值与行为，此处不新增断言。

// ---------- §8 落点与版本锁 ----------
ok('8a 落点：BigInt 精确判别式/行列式在位', calcSrc.includes('function bigDisc') && calcSrc.includes('function bigDets'))
ok('8b 落点：双双精度补偿在位', calcSrc.includes('function det2ddPair') && calcSrc.includes('function ddPairSign'))
ok('8c 落点：标签碰撞消解在位', ux.includes('sweepLabs') && ux.includes('labOccX') && ux.includes('labOccY'))
if (buglog === null) console.log('SKIP 8d BUGLOG 含 1.5.20 条目（[审查仓适配] BUGLOG.md 不在公开仓）')
else ok('8d BUGLOG 含 1.5.20 条目', buglog.includes('1.5.20'))
eq('8e manifest 版本锁 1.5.20/59', man.versionName + '/' + man.versionCode, '1.5.20/59')

console.log('regression-1.5.20: pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
