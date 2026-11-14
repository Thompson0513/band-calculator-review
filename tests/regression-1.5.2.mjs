// 1.5.2 回归测试：函数图象页信息行「小数 + 分数」双显（顶点/交点/截距/振幅）
// 口径与 1.5.0/1.5.1 一致：toFraction 精确门（1e-10、分母 ≤10000 且 ≠1）、连接号走 eqSign 回读；
// 整数不加注、无理数不硬凑；整行行宽 linePx ≤300 不被省略号截断；两条入口（openPlot/drawPlot）共用同一套生成函数
// 运行：node tests/regression-1.5.2.mjs
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
const bad = []
function eq(name, got, want) {
  if (got === want) { pass++ } else { fail++; bad.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
}
function ok(name, cond, extra) {
  if (cond) { pass++ } else { fail++; bad.push(`${name}: ${extra || '条件不成立'}`) }
}

// ---------- 从 index.ux 抽取图象信息行显示函数实测 ----------
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
const F = new Function('calc',
  ['dm', 'trimSci', 'FD', 'fitResStr', 'hardFit', 'DA', 'DP', 'linePx', 'pvStr', 'vertexLine', 'rootsLine', 'linRootLine', 'trigInfoLines'].map(extractFn).join('\n') +
  '\nreturn { DP, DA, linePx, pvStr, vertexLine, rootsLine, linRootLine, trigInfoLines }'
)(calc)
const { DP, DA, linePx, pvStr, vertexLine, rootsLine, linRootLine, trigInfoLines } = F

// ---------- 1) pvStr 单值：分数并列 / 连接号 = 与 ≈ / 整数与无理不加注 ----------
eq('pv 1/2 精确用 =', pvStr(0.5, 13), '1/2 = 0.5')
eq('pv 3/4 精确用 =', pvStr(0.75, 11), '3/4 = 0.75')
eq('pv 4/27 截断用 ≈', pvStr(4 / 27, 13), '4/27 ≈ 0.1481')
eq('pv 负分数', pvStr(-0.5, 13), '−1/2 = −0.5')
eq('pv 无理数不加注', pvStr(Math.SQRT2, 13), '1.4142')
ok('pv 无理数无分数符号', pvStr(Math.SQRT2, 13).indexOf('/') < 0)
eq('pv 整数不加注', pvStr(3, 13), '3')
eq('pv 零不加注', pvStr(0, 13), '0')

// ---------- 2) 顶点行：横坐标 3/4、纵坐标 −1/8（= 与 ≈ 各一例）；整数顶点不加注 ----------
eq('顶点 2x²−3x+1', vertexLine(0.75, -0.125), '顶点 (3/4 = 0.75, −1/8 ≈ −0.13)')
eq('顶点 双分数', vertexLine(-0.5, -0.25), '顶点 (−1/2 = −0.5, −1/4 = −0.25)')
eq('顶点 整数不加注', vertexLine(0, -4), '顶点 (0, −4)')
ok('顶点行宽', linePx(vertexLine(0.75, -0.125)) <= 300, vertexLine(0.75, -0.125))

// ---------- 3) 抛物线交点行（解方程入口）：交点 1/2；无理根不加注；整数根不变 ----------
eq('交点 含 1/2', rootsLine(1, 0.5), '与 x 轴交点 x = 1、1/2 = 0.5')
eq('交点 双分数让位一侧', rootsLine(0.5, 0.25), '与 x 轴交点 x = 1/2 = 0.5、0.25')
eq('交点 无理根不加注', rootsLine(Math.SQRT2, -Math.SQRT2), '与 x 轴交点 x = 1.4142、−1.4142')
eq('交点 整数根不变', rootsLine(2, -2), '与 x 轴交点 x = 2、−2')

// ---------- 4) 一次方程图象根行：分数并列（去后缀防截断）；整数保持原行 ----------
eq('一次根 分数', linRootLine(4 / 27), '与 x 轴交点 x = 4/27 ≈ 0.148148')
eq('一次根 负分数', linRootLine(-0.5), '与 x 轴交点 x = −1/2 = −0.5')
eq('一次根 整数保持原行', linRootLine(2), '与 x 轴交点 x = 2（就是方程的解）')

// ---------- 5) 截距行（drawPlot lin2/quad2 与 openPlot lin 共用 pvStr 口径） ----------
eq('y 轴交点 分数', '与 y 轴交点 (0, ' + pvStr(0.5, 13) + ')', '与 y 轴交点 (0, 1/2 = 0.5)')
eq('y 轴交点 整数', '与 y 轴交点 (0, ' + pvStr(-3, 13) + ')', '与 y 轴交点 (0, −3)')
eq('x 轴交点 分数(lin2)', '与 x 轴交点 (' + pvStr(2 / 3, 14) + ', 0)', '与 x 轴交点 (2/3 ≈ 0.666667, 0)')

// ---------- 6) 三角信息行：振幅分数（|A| 口径不变，负 A 同正 A）；整数不加注；DA 分支并列 ----------
eq('三角 A=1/2', JSON.stringify(trigInfoLines(0.5)), JSON.stringify(['周期 360°（一个完整波形）', '振幅 1/2，最高 0.5、最低 −0.5']))
eq('三角 A=−1/2 同 |A|', JSON.stringify(trigInfoLines(-0.5)), JSON.stringify(trigInfoLines(0.5)))
eq('三角 A=3/2', trigInfoLines(1.5)[1], '振幅 3/2，最高 1.5、最低 −1.5')
eq('三角 A=整数不加注', trigInfoLines(2)[1], '振幅 2，最高 2、最低 −2')
eq('三角 A=15/4 分数与原行等宽', trigInfoLines(3.75)[1], '振幅 15/4，最高 3.75、最低 −3.75')
eq('三角 A=25/2 分数与原行等宽', trigInfoLines(12.5)[1], '振幅 25/2，最高 12.5、最低 −12.5')
{ const ls = trigInfoLines(2 / 3)
  ok('三角 A=2/3 带分数且不超宽', ls[1].indexOf('2/3') >= 0 && linePx(ls[1]) <= 300, ls[1]) }
eq('三角 DA 分支', JSON.stringify(trigInfoLines(10000.5)), JSON.stringify(['周期 360°（一个完整波形）', '振幅 20001/2 ≈ 1.00e+4', '最高 1.00e+4、最低 −1.00e+4']))
ok('三角行数不增', trigInfoLines(0.5).length === 2 && trigInfoLines(10000.5).length === 3)

// ---------- 7) inv/exp/log/abs：信息行没有可标注的计算值（恒过点/顶点都是整数、inv 全是文字行），保持原样 ----------
ok('inv 信息行原文案', ux.includes("'双曲线，关于原点对称'") && ux.includes("'永远不碰到两条坐标轴'"))
ok('exp 恒过点整数行', ux.includes("lines: ['恒过点 (0, 1)'"))
ok('log 恒过点整数行', ux.includes("lines: ['恒过点 (1, 0)'"))
ok('abs 顶点整数行', ux.includes("lines: ['顶点 (0, 0)'"))

// ---------- 8) 两条入口共用同一套生成函数（源码断言） ----------
for (const sig of ['vertexLine(xv, yv)', 'rootsLine(', 'linRootLine(root)', "pvStr(B, 13)", "pvStr(c, 13)", "pvStr(b, 13)", "pvStr(-b / k, 14)", 'trigInfoLines(A)']) {
  ok('源码共用 ' + sig, ux.includes(sig), 'index.ux 应调用 ' + sig)
}

// ---------- 9) 行宽不变量扫：新行永不宽于同值的 DP 原行；DP 原行 ≤300 时新行也必须 ≤300 ----------
for (const [a, b, c] of [[2, -3, 1], [1, 1, 0], [1, 0, -2], [1, 0, -4], [3, -7, 2], [27, -13, 1], [8, -6, 1], [5, 3, -7], [123, -45, 6], [1, -1, -1]]) {
  const xv = -b / (2 * a), yv = a * xv * xv + b * xv + c
  const vOld = '顶点 (' + DP(xv) + ', ' + DP(yv) + ')'
  ok(`顶点行宽 ${a}/${b}/${c}`, linePx(vertexLine(xv, yv)) <= Math.max(300, linePx(vOld)), vertexLine(xv, yv))
  const disc = b * b - 4 * a * c
  if (disc > 0) {
    const s = Math.sqrt(disc)
    const rOld = '与 x 轴交点 x = ' + DP((-b + s) / (2 * a)) + '、' + DP((-b - s) / (2 * a))
    ok(`交点行宽 ${a}/${b}/${c}`, linePx(rootsLine((-b + s) / (2 * a), (-b - s) / (2 * a))) <= Math.max(300, linePx(rOld)), rootsLine((-b + s) / (2 * a), (-b - s) / (2 * a)))
  }
}
for (const [k, b] of [[54, -8], [3, 1], [-2, 0.5], [7, -22], [0.5, 0.25], [123, -456]]) {
  ok(`lin y 交点行宽 ${k}/${b}`, linePx('与 y 轴交点 (0, ' + pvStr(b, 13) + ')') <= 300)
  ok(`lin x 交点行宽 ${k}/${b}`, linePx('与 x 轴交点 (' + pvStr(-b / k, 14) + ', 0)') <= 300, pvStr(-b / k, 14))
  ok(`lin 根行宽 ${k}/${b}`, linePx(linRootLine(-b / k)) <= 300, linRootLine(-b / k))
}
for (const A of [0.5, 1.5, 0.25, 2 / 3, 0.1, 3.75, 12.5, 9999.5, 10000.5, 123456.25]) {
  const aA = Math.abs(A)
  const old = aA >= 10000
    ? ['周期 360°（一个完整波形）', '振幅 ' + DA(aA), '最高 ' + DA(aA) + '、最低 ' + DA(-aA)]
    : ['周期 360°（一个完整波形）', '振幅 ' + DP(aA) + '，最高 ' + DP(aA) + '、最低 ' + DP(-aA)]
  const now = trigInfoLines(A)
  eq(`三角行数同原 ${A}`, now.length, old.length)
  for (let i = 0; i < now.length; i++) ok(`三角行宽 A=${A} 行${i}`, linePx(now[i]) <= Math.max(300, linePx(old[i])), now[i])
}

console.log(`\n${pass} passed, ${fail} failed`)
if (bad.length) { console.log(bad.join('\n')); process.exit(1) }
