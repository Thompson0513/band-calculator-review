// 1.4.16 彻查新增场景测试：按小学/初中/高中教材用法 + 边界异常
// 运行：node tests/audit-scenarios.mjs
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
const bad = []
function eq(name, got, want) {
  if (got === want) { pass++ } else { fail++; bad.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
}
function approx(name, got, want, tol = 1e-9) {
  if (typeof got === 'number' && Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))) { pass++ } else { fail++; bad.push(`${name}: got ${got} want ≈${want}`) }
}
function throws(name, fn) {
  try { fn(); fail++; bad.push(`${name}: 没有抛错`) } catch (e) { pass++ }
}
const E = (s, o) => calc.evaluate(s, o)

// ---------- 小学：四则混合、括号、小数、分数启蒙 ----------
eq('混合运算先乘除', E('2+3×4'), 14)
eq('括号优先', E('(2+3)×4'), 20)
eq('连续除', E('100÷10÷2'), 5)
eq('小数乘法', calc.formatPlain(E('1.25×8')), '10')
eq('小数除法', calc.formatPlain(E('7.2÷0.9')), '8')
eq('余数式链算 10÷3 再乘3 回不来', calc.formatDisplay(E('10÷3')), '3.33333333333')
eq('百分数应用 80 的 25%', calc.formatPlain(E('80×25%')), '20')
eq('折扣 300 打八折', calc.formatPlain(E('300×80%')), '240')
eq('负数启蒙 3-8', E('3−8'), -5)
eq('0 除以 5', E('0÷5'), 0)
throws('0 除以 0', () => E('0÷0'))
eq('大数乘法', calc.formatPlain(E('999×999')), '998001')
eq('一亿', calc.formatDisplay(E('100000000')), '100,000,000')
eq('分数化小数 3/4', calc.formatPlain(E('3÷4')), '0.75')
eq('toFraction 0.375', JSON.stringify(calc.toFraction(0.375)), JSON.stringify({ n: 3, d: 8 }))
eq('toFraction 2.5', JSON.stringify(calc.toFraction(2.5)), JSON.stringify({ n: 5, d: 2 }))
eq('gcdLcm 12 18', JSON.stringify(calc.gcdLcm(12, 18)), JSON.stringify({ gcd: 6, lcm: 36 }))
eq('gcdLcm 互质 7 13 lcm', calc.gcdLcm(7, 13).lcm, 91)
eq('gcdLcm 含 1', calc.gcdLcm(1, 9).gcd, 1)
eq('分数加法 1/2+1/3', JSON.stringify([calc.fracCalc(1, 2, '+', 1, 3).n, calc.fracCalc(1, 2, '+', 1, 3).d]), JSON.stringify([5, 6]))
eq('分数减法负结果', JSON.stringify([calc.fracCalc(1, 2, '-', 3, 4).n, calc.fracCalc(1, 2, '-', 3, 4).d]), JSON.stringify([-1, 4]))
eq('分数乘法约分', JSON.stringify([calc.fracCalc(2, 3, '*', 3, 4).n, calc.fracCalc(2, 3, '*', 3, 4).d]), JSON.stringify([1, 2]))
eq('分数除法', JSON.stringify([calc.fracCalc(1, 2, '/', 1, 4).n, calc.fracCalc(1, 2, '/', 1, 4).d]), JSON.stringify([2, 1]))
eq('假分数约分 6/4', JSON.stringify([calc.fracCalc(6, 4, '*', 1, 1).n, calc.fracCalc(6, 4, '*', 1, 1).d]), JSON.stringify([3, 2]))

// ---------- 单位换算（小学~初中） ----------
eq('1千米=1000米', calc.convertUnit(0, 'km', 'm', 1), 1000)
eq('250厘米=2.5米', calc.convertUnit(0, 'cm', 'm', 250), 2.5)
eq('1英尺=12英寸', Math.round(calc.convertUnit(0, 'ft', 'in', 1) * 1e9) / 1e9, 12)
eq('1千克=2斤', calc.convertUnit(1, 'kg', 'jin', 1), 2)
eq('1吨=1000千克', calc.convertUnit(1, 't', 'kg', 1), 1000)
eq('37°C=98.6°F', Math.round(calc.convertUnit(3, 'c', 'f', 37) * 10) / 10, 98.6)
eq('0°C=273.15K', calc.convertUnit(3, 'c', 'k', 0), 273.15)
eq('-40°C=-40°F', calc.convertUnit(3, 'c', 'f', -40), -40)
eq('1公顷=15亩', Math.round(calc.convertUnit(2, 'ha', 'mu', 1) * 1e9) / 1e9, 15)
eq('2小时=120分钟', calc.convertUnit(4, 'h', 'min', 2), 120)
eq('1GB=1024MB', calc.convertUnit(5, 'gb', 'mb', 1), 1024)

// ---------- 进制（初中信息/高中） ----------
eq('FF 十六进制', JSON.stringify(calc.baseConvert('FF', 16)), JSON.stringify({ bin: '11111111', oct: '377', dec: '255', hex: 'FF' }))
eq('1010 二进制', calc.baseConvert('1010', 2).dec, '10')
eq('0 值', calc.baseConvert('0', 10).dec, '0')
eq('大数 777 八进制', calc.baseConvert('777', 8).dec, '511')

// ---------- 初中：一次/二次方程、方程组、根式 ----------
let r = calc.solveLinear(2, 3, 0, 7); eq('2x+3=7', r.x, 2)
r = calc.solveLinear(3, 0, 1, -5); eq('3x=x-5', r.x, -2.5)
r = calc.solveLinear(1, 1, 1, 1); eq('恒等式', r.type, 'infinite')
r = calc.solveLinear(1, 1, 1, 2); eq('无解', r.type, 'none')
r = calc.solveLinear(0.5, 0, 0, 2.5); eq('小数系数 0.5x=2.5', r.x, 5)
r = calc.solveQuad(1, -5, 6); eq('x²-5x+6 两根', `${r.type}:${r.x1},${r.x2}`, 'two:2,3')
r = calc.solveQuad(1, 2, 1); eq('完全平方', `${r.type}:${r.x}`, 'one:-1')
r = calc.solveQuad(1, 0, 1); eq('无实根', r.type, 'complex')
r = calc.solveQuad(1, -3, 0); eq('缺常数项', `${r.x1},${r.x2}`, '0,3')
r = calc.solveQuad(-1, 5, -6); eq('负 a', `${r.x1},${r.x2}`, '2,3')
r = calc.solveQuad(0, 2, -4); eq('a=0 退化一次', `${r.type}:${r.x}`, 'linear:2')
r = calc.solveQuad(0.5, 1, -1.5); approx('小数二次', r.x1, -3); approx('小数二次根2', r.x2, 1)
r = calc.solveQuad(2, -7, 3); approx('判别式49 两根', r.x1, 0.5); approx('根2', r.x2, 3)
r = calc.solveSystem(1, 1, 5, 1, -1, 1); eq('方程组 x+y=5 x-y=1', `${r.x},${r.y}`, '3,2')
r = calc.solveSystem(2, 3, 12, 1, -1, 1); approx('方程组2', r.x, 3); approx('方程组2 y', r.y, 2)
r = calc.solveSystem(1, 1, 1, 2, 2, 3); eq('平行无解', r.type, 'none')
r = calc.solveSystem(1, 1, 1, 2, 2, 2); eq('等价无穷', r.type, 'infinite')
r = calc.solveSystem(0, 0, 5, 1, 1, 1); eq('零行矛盾', r.type, 'none')
r = calc.solveSystem(3, -2, 4, 1, 1, 1); approx('分数解 x', r.x, 1.2); approx('分数解 y', r.y, -0.2)
eq('化简 √12', [calc.simplifySqrt(12).coef, calc.simplifySqrt(12).rad].join('/'), '2/3')
eq('化简 √18', [calc.simplifySqrt(18).coef, calc.simplifySqrt(18).rad].join('/'), '3/2')
eq('化简 √16', [calc.simplifySqrt(16).coef, calc.simplifySqrt(16).rad].join('/'), '4/1')
eq('化简 √7', [calc.simplifySqrt(7).coef, calc.simplifySqrt(7).rad].join('/'), '1/7')
eq('化简 √72', [calc.simplifySqrt(72).coef, calc.simplifySqrt(72).rad].join('/'), '6/2')

// ---------- 高中：三角（弧度制切换）、指数对数、阶乘 ----------
approx('rad 模式 sin(π/2)', E('sin(1.57079632679)', { deg: false }), 1)
approx('deg 模式 sin(90)', E('sin(90)', { deg: true }), 1)
approx('tan(60)', E('tan(60)'), Math.sqrt(3))
approx('cos(180)', E('cos(180)'), -1)
approx('2^0.5', E('2^0.5'), Math.SQRT2)
eq('ln(e)', Math.round(E('ln(2.71828182846)') * 1e9) / 1e9, 1)
approx('log2(8) 用换底', E('log(8)÷log(2)'), 3)
eq('10! ', calc.formatPlain(E('10!')), '3628800')
throws('负数开方链', () => E('√(3−5)'))
throws('ln 负数', () => E('ln(−2)'))
eq('绝对值嵌套', E('abs(3−10)'), 7)
eq('幂的幂', E('(2^3)^2'), 64)
approx('sin²+cos²=1', E('sin(25)^2+cos(25)^2'), 1)

// ---------- 键入方程采样法（复刻 eqSolve 抽系数逻辑的关键路径） ----------
function eqSideSrc(side, t) {
  let s = side.replace(/×/g, '*').replace(/·/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  s = s.replace(/([0-9.)²xy])(?=[xy(])/g, '$1*')
  s = s.replace(/([)²xy])(?=[0-9])/g, '$1*')
  if (t !== null && t !== undefined) s = s.replace(/x/g, '(' + t + ')')
  return s
}
function typedSolve(raw) {
  const parts = raw.indexOf('=') >= 0 ? raw.split('=') : [raw, '0']
  const g = (t) => calc.evaluate(eqSideSrc(parts[0], t)) - calc.evaluate(eqSideSrc(parts[1], t))
  const g0 = g(0), g1 = g(1), gm = g(-1)
  const a = (g1 + gm - 2 * g0) / 2, b = (g1 - gm) / 2, c = g0
  const chk = (t) => Math.abs(g(t) - (a * t * t + b * t + c)) <= 1e-6 * Math.max(1, Math.abs(g(t)))
  if (!chk(2) || !chk(-2)) return { type: 'unsupported' }
  return calc.solveQuad(a, b, c)
}
r = typedSolve('2x+3=7'); eq('键入 2x+3=7（隐乘）', r.type, 'linear')
r = typedSolve('x^2−5x+6=0'); eq('键入二次', `${r.type}:${r.x1},${r.x2}`, 'two:2,3')
r = typedSolve('x^2+1=0'); eq('键入无实根', r.type, 'complex')
r = typedSolve('2^x=8'); eq('键入指数方程应拒', r.type, 'unsupported')

console.log(`${pass} passed, ${fail} failed`)
if (bad.length) { console.log(bad.join('\n')); process.exit(1) }
