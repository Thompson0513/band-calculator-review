// 1.5.0 回归测试：所有求解结果「小数 + 分数」同行并列（精确在前、近似在后）
// 覆盖：lin/quad/sys/eqin 答案行、复数根实部分数、主界面切换钮直显、单位换算纯小数（1.5.3 撤加注锁定）、分数页双向锁定
// 运行：node tests/regression-1.5.0.mjs
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

// ---------- 从 index.ux 抽取 1.5.0 新增的显示辅助函数实测 ----------
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
  ['fitResStr', 'hardFit', 'ansStr', 'cplxStr', 'fracChipText'].map(extractFn).join('\n') +
  '\nreturn { fitResStr, hardFit, ansStr, cplxStr, fracChipText }'
)(calc)
const { ansStr, cplxStr, fracChipText } = F

// ---------- 1) 用户现场例：54x-8=0 → x = 4/27（eqin 走 solveQuad 退化一次、lin 走 solveLinear） ----------
{ const r = calc.solveQuad(0, 54, -8); eq('现场例 type', r.type, 'linear'); eq('现场例答案行', ansStr('x', r.x, 28), 'x = 4/27 ≈ 0.148148148148') }
{ const r = calc.solveLinear(54, -8, 0, 0); eq('lin 现场例答案行', ansStr('x', r.x, 27), 'x = 4/27 ≈ 0.148148148148') }
eq('eqin 纯算式行', ansStr('', 4 / 27, 27), '= 4/27 ≈ 0.148148148148')

// ---------- 2) 无理根 / 整数根：不加分数，保持原格式 ----------
{ const r = calc.solveQuad(1, 0, -2)
  eq('无理根 x1', ansStr('x1', r.x1, 28), 'x1 ≈ 1.41421356237')
  ok('无理根 x2 无分数', ansStr('x2', r.x2, 28).indexOf('/') < 0, ansStr('x2', r.x2, 28)) }
{ const r = calc.solveQuad(1, -3, 2)
  eq('整数根 x1', ansStr('x1', r.x1, 28), 'x1 = 2')
  eq('整数根 x2', ansStr('x2', r.x2, 28), 'x2 = 1') }
eq('零根不加分数', ansStr('x', 0, 27), 'x = 0')

// ---------- 3) 二次方程有理根 ----------
{ const r = calc.solveQuad(2, -3, 1)
  eq('有理根整数 x1', ansStr('x1', r.x1, 28), 'x1 = 1')
  eq('有理根分数 x2', ansStr('x2', r.x2, 28), 'x2 = 1/2 = 0.5') }
{ const r = calc.solveQuad(1, 2, 1); eq('重根', ansStr('x', r.x, 28), 'x = -1') }

// ---------- 4) 方程组：x/y 各自并列 ----------
{ const r = calc.solveSystem(3, 2, 7, 1, -1, 1)
  eq('方程组 x 分数', ansStr('x', r.x, 27), 'x = 9/5 = 1.8')
  eq('方程组 y 分数', ansStr('y', r.y, 27), 'y = 4/5 = 0.8') }
{ const r = calc.solveSystem(1, 1, 3, 1, -1, 1)
  eq('方程组整数 x', ansStr('x', r.x, 27), 'x = 2')
  eq('方程组整数 y', ansStr('y', r.y, 27), 'y = 1') }
{ const r = calc.solveSystem(2, 1, 4, 1, 1, 2.5)  // x=1.5, y=1
  eq('方程组半分 x', ansStr('x', r.x, 27), 'x = 3/2 = 1.5')
  eq('方程组半分 y', ansStr('y', r.y, 27), 'y = 1') }

// ---------- 5) 复数根：实部分数并列、虚部只给小数、整行 ≤30 字 ----------
{ const r = calc.solveQuad(162, -3, 2)  // 用户照片同题：实部 1/108
  eq('复数根 x1 实部分数', cplxStr('x1', r, '+'), 'x1 ≈ 1/108 ≈ 0.00926 + 0.1107i')
  eq('复数根 x2 实部分数', cplxStr('x2', r, '−'), 'x2 ≈ 1/108 ≈ 0.00926 − 0.1107i')
  ok('复数根行不超 30 字', cplxStr('x1', r, '+').length <= 30 && cplxStr('x2', r, '−').length <= 30) }
{ const r = calc.solveQuad(1, 0, 1)  // 实部 0：无分数，与旧格式一致
  eq('复数根实部为 0', cplxStr('x1', r, '+'), 'x1 = 0 + 1i') }
{ const r = calc.solveQuad(2, 2, 1)  // 实部 -1/2
  eq('复数根负实部分数', cplxStr('x1', r, '+'), 'x1 = -1/2 = -0.5 + 0.5i') }
for (const [a, b, c] of [[3, 7, 5], [7, -3, 11], [123, -45, 678], [1, 0, 4], [5, 1, 9]]) {
  const r = calc.solveQuad(a, b, c)
  if (r.type === 'complex') ok(`复数根行宽 ${a}/${b}/${c}`, cplxStr('x1', r, '+').length <= 30, cplxStr('x1', r, '+'))
}

// ---------- 6) 答案行长度不变量（各页 maxLen 内必不溢出） ----------
for (const v of [4 / 27, Math.SQRT2, 2, 0.5, -13.75, 123456.789, 1 / 9999, 0.000001, -1 / 3, 3.141592653589793]) {
  ok('ansStr 不超长 ' + v, ansStr('x1', v, 28).length <= 28, ansStr('x1', v, 28))
  ok('ansStr(lin) 不超长 ' + v, ansStr('x', v, 27).length <= 27, ansStr('x', v, 27))
}

// ---------- 7) 主界面切换钮：短的另一形式直显 ----------
eq('钮直显分数 1/3', fracChipText(false, calc.toFraction(1 / 3), 1 / 3, false), '1/3')
eq('钮直显分数 4/27', fracChipText(false, calc.toFraction(4 / 27), 4 / 27, false), '4/27')
eq('钮长分数回落文字', fracChipText(false, { n: 123, d: 4567 }, 123 / 4567, false), '看分数')
eq('钮直显小数 1/3', fracChipText(true, calc.toFraction(1 / 3), 1 / 3, true), '0.333333333')
eq('钮直显小数 2.5', fracChipText(true, calc.toFraction(2.5), 2.5, true), '2.5')
eq('钮长小数回落文字(分数串守卫)', fracChipText(true, { n: 2469135781, d: 20 }, 123456789.05, true), '看小数')
eq('钮长小数回落文字(小数串守卫)', fracChipText(true, calc.toFraction(1234567891.5), 1234567891.5, true), '看小数')
eq('钮大数小数恰入限直显', fracChipText(true, calc.toFraction(123456789.5), 123456789.5, true), '123,456,790')
eq('钮主行非分数时回落', fracChipText(true, calc.toFraction(1 / 3), 1 / 3, false), '看小数')
eq('钮无分数', fracChipText(false, null, 2, false), '看分数')

// ---------- 8) 百分数走主界面：% 结果同样上钮 ----------
{ const v = calc.evaluate('50%'); eq('50% 钮显分数', fracChipText(false, calc.toFraction(v), v, false), '1/2') }
{ const v = calc.evaluate('12.5%'); eq('12.5% 钮显分数', fracChipText(false, calc.toFraction(v), v, false), '1/8') }

// ---------- 9) 单位换算（1.5.3 撤加注）：恒纯小数，走 1.4.19 的 formatDisplay 口径 ----------
eq('单位 in→cm 纯小数', calc.formatDisplay(calc.convertUnit(0, 'in', 'cm', 1)), '2.54')
eq('单位 °C→°F 纯小数', calc.formatDisplay(calc.convertUnit(3, 'c', 'f', 37)), '98.6')
eq('单位 斤→kg 纯小数', calc.formatDisplay(calc.convertUnit(1, 'jin', 'kg', 1)), '0.5')
eq('单位 lb→kg 纯小数', calc.formatDisplay(calc.convertUnit(1, 'lb', 'kg', 1)), '0.45359237')
eq('单位 km→m 纯小数', calc.formatDisplay(calc.convertUnit(0, 'km', 'm', 1)), '1,000')
eq('单位 km→ft 纯小数', calc.formatDisplay(calc.convertUnit(0, 'km', 'ft', 1)), '3,280.83989501')
ok('单位源码无 unitResStr', !ux.includes('unitResStr'), 'unitResStr 应已移除')
ok('单位走 formatDisplay 口径', ux.includes("this.unitRes = isNaN(r) ? '' : calc.formatDisplay(r)"), 'unitCompute 应恢复 1.4.19 写法')
ok('单位结果无加注括号', !calc.formatDisplay(calc.convertUnit(0, 'in', 'cm', 1)).includes('（'), '结果串不应带（n/d）加注')

// ---------- 10) 分数页双向锁定：有分数必有小数行（源码断言 + 计算层） ----------
{ const r = calc.fracCalc(1, 3, '+', 1, 3); eq('分数页结果 n', r.n, 2); eq('分数页结果 d', r.d, 3); ok('分数页有小数可显', Math.abs(r.dec - 2 / 3) < 1e-12) }
ok('分数页源码带小数行', ux.includes("lines.push('小数 ' + ("), 'fracSolve 应推「小数 =/≈」行（1.5.14 起按精确性选连接号）')

// ---------- 11) 1.5.1 连接号口径：分数与小数是同一个数用「=」，小数被截断/四舍五入才用「≈」 ----------
eq('连接号 1/2 精确用 =', ansStr('x', 1 / 2, 27), 'x = 1/2 = 0.5')
eq('连接号 9/5 精确用 =', ansStr('x', 9 / 5, 27), 'x = 9/5 = 1.8')
eq('连接号 4/5 精确用 =', ansStr('y', 4 / 5, 27), 'y = 4/5 = 0.8')
eq('连接号 1/32 完整显示用 =', ansStr('x', 1 / 32, 28), 'x = 1/32 = 0.03125')
eq('连接号 4/27 截断用 ≈', ansStr('x', 4 / 27, 27), 'x = 4/27 ≈ 0.148148148148')
eq('连接号 1/6 截断用 ≈', ansStr('x', 1 / 6, 27), 'x = 1/6 ≈ 0.166666666667')
{ const r = calc.solveQuad(162, -3, 2)
  ok('连接号 复数根实部 1/108 用 ≈', cplxStr('x1', r, '+').indexOf('1/108 ≈ 0.00926') >= 0, cplxStr('x1', r, '+')) }
{ const r = calc.solveQuad(2, 2, 1)
  ok('连接号 复数根实部 -1/2 用 =', cplxStr('x1', r, '+').indexOf('-1/2 = -0.5') >= 0, cplxStr('x1', r, '+')) }

console.log(`\n${pass} passed, ${fail} failed`)
if (bad.length) { console.log(bad.join('\n')); process.exit(1) }
