// 1.4.17 回归测试：外部检测报告 5 项修复 + 方程「假 0」排查 + UI 解析路径
// 运行：node tests/regression-1.4.17.mjs
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
function approx(name, got, want, relTol) {
  const t = (relTol || 1e-9) * Math.max(1, Math.abs(want))
  if (typeof got === 'number' && Math.abs(got - want) <= t) { pass++ } else { fail++; bad.push(`${name}: got ${got} want ≈${want}`) }
}

// ---------- 1) solveSystem 浮点容差 ----------
// 报告原例：第二式是第一式的 3 倍 → 无穷多解（旧版误报 x=16, y=2）
eq('方程组×3 比例', calc.solveSystem(0.1, 0.7, 1, 0.3, 2.1, 3).type, 'infinite')
eq('方程组×2 比例', calc.solveSystem(0.2, 1.4, 2, 0.3, 2.1, 3).type, 'infinite')
eq('方程组×0.5 比例', calc.solveSystem(0.05, 0.35, 0.5, 0.3, 2.1, 3).type, 'infinite')
eq('方程组负倍数比例', calc.solveSystem(0.1, 0.7, 1, -0.2, -1.4, -2).type, 'infinite')
eq('方程组比例但常数不对', calc.solveSystem(0.1, 0.7, 1, 0.3, 2.1, 4).type, 'none')
{ const r = calc.solveSystem(1, 1, 3, 1, -1, 1); eq('方程组整数解 type', r.type, 'one'); approx('方程组整数解 x', r.x, 2); approx('方程组整数解 y', r.y, 1) }
{ const r = calc.solveSystem(0.1, 0.2, 0.5, 0.3, 0.1, 0.7); eq('方程组小数解 type', r.type, 'one'); approx('方程组小数解 x', r.x, 1.8); approx('方程组小数解 y', r.y, 1.6) }
// 解出后必须能代回验算（旧版 x=16,y=2 代回得 3≠1）
{ const r = calc.solveSystem(2, 3, 8, 1, -1, 1); ok('方程组解代回验算', Math.abs(2 * r.x + 3 * r.y - 8) < 1e-9 && Math.abs(r.x - r.y - 1) < 1e-9) }
eq('方程组全零行守卫', calc.solveSystem(0, 0, 5, 1, 1, 2).type, 'none')

// ---------- 2) solveQuad 稳定求根 ----------
{ const r = calc.solveQuad(1, 999999999, 1)
  eq('大系数二次 type', r.type, 'two')
  approx('大系数小根', r.x1, -1.000000001e-9, 1e-6)
  approx('大系数大根', r.x2, -999999999, 1e-12)
  ok('大系数两根代回', Math.abs(r.x1 * r.x1 + 999999999 * r.x1 + 1) < 1e-6, '小根代回残差过大') }
{ const r = calc.solveQuad(1, -999999999, 1)
  approx('大系数正小根', r.x1, 999999999, 1e-12)
  approx('大系数正小根2', r.x2, 1.000000001e-9, 1e-6) }
{ const r = calc.solveQuad(1, -3, 2); approx('常规两根 x1 顺序', r.x1, 2); approx('常规两根 x2 顺序', r.x2, 1) }
{ const r = calc.solveQuad(1, 0, -4); eq('b=0 type', r.type, 'two'); approx('b=0 x1', r.x1, 2); approx('b=0 x2', r.x2, -2) }
{ const r = calc.solveQuad(1, 3, 0); ok('c=0 真零根在 x1', Math.abs(r.x1) === 0, 'x1=' + r.x1); approx('c=0 x2', r.x2, -3) }
{ const r = calc.solveQuad(1, -3, 0); approx('c=0 x1', r.x1, 3); ok('c=0 真零根在 x2', Math.abs(r.x2) === 0, 'x2=' + r.x2) }
eq('重根', calc.solveQuad(1, 2, 1).type, 'one')
eq('复数根', calc.solveQuad(1, 0, 4).type, 'complex')
eq('a=0 退化一次', calc.solveQuad(0, 2, -4).type, 'linear')
approx('a=0 退化根', calc.solveQuad(0, 2, -4).x, 2)

// ---------- 3) 安全整数守卫 ----------
{ const r = calc.gcdLcm(999999937, 999999929); ok('LCM 超限报错', !!r.error, JSON.stringify(r)) }
{ const r = calc.gcdLcm(12, 18); eq('LCM 常规 gcd', r.gcd, 6); eq('LCM 常规 lcm', r.lcm, 36) }
{ const r = calc.gcdLcm(999999937, 3); eq('LCM 安全区大数', r.lcm, 2999999811) }
{ const r = calc.fracCalc(999999937, 999999929, '+', 999999929, 999999937); ok('分数超限报错', !!r.error, JSON.stringify(r)) }
{ const r = calc.fracCalc(1, 2, '+', 1, 3); eq('分数常规 n', r.n, 5); eq('分数常规 d', r.d, 6) }
{ const r = calc.fracCalc(123456, 789, '*', 987, 654); ok('分数安全区乘法不报错', !r.error, JSON.stringify(r)); approx('分数安全区乘法值', r.dec, (123456 / 789) * (987 / 654), 1e-12) }

// ---------- 4) cleanNum 显示阈值 ----------
eq('极小值 1e-13 显示', calc.formatDisplay(1e-13), '1e-13')
eq('极小值 1e-13 纯文本', calc.formatPlain(1e-13), '1e-13')
eq('乘积 1e-14 显示', calc.formatDisplay(calc.evaluate('0.0000001×0.0000001')), '1e-14')
eq('sin 尾巴仍归零', calc.formatDisplay(calc.evaluate('sin(180)')), '0')
eq('cos 尾巴仍归零', calc.formatDisplay(calc.evaluate('cos(90)')), '0')
eq('普通小数不受影响', calc.formatDisplay(1 / 3), '0.333333333333')

// ---------- 5) 方程「假 0」全入口排查 ----------
{ const r = calc.solveLinear(1, 5, 0, 5); eq('一次真零根 type', r.type, 'one'); ok('一次真零根报 0', r.x === 0) }
approx('一次非零根', calc.solveLinear(2, 3, 0, 7).x, 2)
approx('一次小根不吞', calc.solveLinear(1000000, 0, 0, 1).x, 0.000001)
{ const r = calc.solveQuad(2, -6, 0); ok('二次真零根', Math.abs(r.x1) === 0 || Math.abs(r.x2) === 0) }

// ---------- 6) UI 层：从 index.ux 抽取 parseCoeff/parseCoeff0/autoRange 实测 ----------
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
function extractFn(name) {
  const start = ux.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('找不到函数 ' + name)
  let depth = 0, i = ux.indexOf('{', start)
  const from = i
  for (; i < ux.length; i++) {
    if (ux[i] === '{') depth++
    else if (ux[i] === '}') { depth--; if (depth === 0) return ux.slice(start, i + 1) }
  }
  throw new Error('函数未配平 ' + name)
}
const uiFns = new Function(
  extractFn('parseCoeff') + '\n' + extractFn('parseCoeff0') + '\n' + extractFn('autoRange') +
  '\nreturn { parseCoeff, parseCoeff0, autoRange }'
)()
eq('留空系数按 0', uiFns.parseCoeff0(''), 0)
ok('半截负号仍算未填', isNaN(uiFns.parseCoeff0('-')))
approx('分数系数 1/2', uiFns.parseCoeff('1/2'), 0.5)
approx('分数系数 -3/4', uiFns.parseCoeff('-3/4'), -0.75)
ok('分母 0 系数非法', isNaN(uiFns.parseCoeff('1/0')))
eq('autoRange lin2 远根', uiFns.autoRange('lin2', { k: 0.01, b: -1 }), 64)
eq('autoRange lin2 原点根', uiFns.autoRange('lin2', { k: 1, b: 0 }), 3)
eq('autoRange lin2 水平线', uiFns.autoRange('lin2', { k: 0, b: 5 }), 8)

console.log(`\n${pass} passed, ${fail} failed`)
if (bad.length) { console.log(bad.join('\n')); process.exit(1) }
