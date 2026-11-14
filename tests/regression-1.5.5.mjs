// 回归测试 1.5.5：单位换算「带回计算」——带回主计算页的是换算过程式，不是光秃秃的结果
// 口径：纯比率类按 输入×比率 / 输入÷(1/比率) 组式（倒数干净才用 ÷，长尾回退 ×比率原值）；
// 温度按 convertUnit 同路组仿射式（先归摄氏再转目标，系数教材形 1.8=9/5）；
// 过程式经 calc.evaluate 求值必须与 calc.convertUnit 一致（相对容差 1e-9，比率按 formatPlain 12 位有效数字收尾的误差在内）。
// 带回组装：空式子直接放过程式；非空按 Ans 隐含乘法口径追加 + 整体加括号（unitCarryExpr）。
// 界面：交换行同行新增「带回计算」钮（if="{{unitRes}}" 才出现），swap-row 高度不变，单位页总高复审 = 478 ≤ 480。
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }

// ---------- 抽取显示层函数（与 1.5.2/1.5.4 同法） ----------
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
const valEndMatch = ux.match(/const VAL_END = '([^']*)'/)
if (!valEndMatch) throw new Error('找不到 VAL_END')
const FN = ['dispNum', 'unitNumStr', 'unitRatioClean', 'buildUnitProc', 'unitCarryExpr']
const F = new Function('calc', 'VAL_END', FN.map(extractFn).join('\n') + '\nreturn { ' + FN.join(', ') + ' }')(calc, valEndMatch[1])
const { buildUnitProc, unitCarryExpr, unitRatioClean } = F
const ev = function (s) { return calc.evaluate(s, { deg: true }) }
function close(name, got, want) {
  const tol = 1e-9 * Math.max(1, Math.abs(want))
  ok(name + '（got=' + got + ' want=' + want + '）', Math.abs(got - want) <= tol)
}

// 类别下标：长度 0、重量 1、面积 2、温度 3、时间 4、数据 5
// ---------- 1) 过程式字符串：纯比率 × 形 ----------
eq('长度× 英寸→厘米', buildUnitProc(0, 'in', 'cm', 5), '5×2.54')
eq('长度× 千米→米', buildUnitProc(0, 'km', 'm', 1.5), '1.5×1000')
eq('长度× 米→英尺（比率收 12 位）', buildUnitProc(0, 'm', 'ft', 10), '10×3.28083989501')
eq('重量× 千克→斤', buildUnitProc(1, 'kg', 'jin', 10), '10×2')
eq('面积× 公顷→亩', buildUnitProc(2, 'ha', 'mu', 2), '2×15')
eq('时间× 小时→分钟', buildUnitProc(4, 'h', 'min', 2), '2×60')
eq('数据× GB→MB', buildUnitProc(5, 'gb', 'mb', 3), '3×1024')
eq('数据× TB→B（大整数原样）', buildUnitProc(5, 'tb', 'b', 2), '2×1099511627776')

// ---------- 2) 过程式字符串：纯比率 ÷ 形（倒数干净） ----------
eq('长度÷ 厘米→英寸', buildUnitProc(0, 'cm', 'in', 12.7), '12.7÷2.54')
eq('长度÷ 米→千米', buildUnitProc(0, 'm', 'km', 500), '500÷1000')
eq('长度÷ 毫米→英寸', buildUnitProc(0, 'mm', 'in', 127), '127÷25.4')
eq('长度÷ 厘米→英尺（倒数 30.48）', buildUnitProc(0, 'cm', 'ft', 100), '100÷30.48')
eq('重量÷ 斤→千克', buildUnitProc(1, 'jin', 'kg', 10), '10÷2')
eq('面积÷ 亩→公顷', buildUnitProc(2, 'mu', 'ha', 30), '30÷15')
eq('时间÷ 分钟→小时', buildUnitProc(4, 'min', 'h', 90), '90÷60')
eq('时间÷ 天→周', buildUnitProc(4, 'day', 'wk', 14), '14÷7')
eq('数据÷ MB→GB', buildUnitProc(5, 'mb', 'gb', 2048), '2048÷1024')
eq('数据÷ B→TB', buildUnitProc(5, 'b', 'tb', 5), '5÷1099511627776')

// ---------- 3) 过程式字符串：倒数长尾回退 ×比率原值 ----------
eq('重量 磅→千克（倒数 2.2046… 长尾回退）', buildUnitProc(1, 'lb', 'kg', 10), '10×0.45359237')
eq('面积 平方米→亩（倒数 666.66… 回退）', buildUnitProc(2, 'm2', 'mu', 100), '100×0.0015')
eq('面积 平方英尺→平方米（倒数 10.7639… 回退）', buildUnitProc(2, 'ft2', 'm2', 100), '100×0.09290304')
ok('unitRatioClean 判 2.54 干净', unitRatioClean(2.54) === true)
ok('unitRatioClean 判 2.20462262185 不干净', unitRatioClean(2.20462262185) === false)

// ---------- 4) 过程式字符串：温度仿射（正反 + 开尔文） ----------
eq('温度 °C→°F', buildUnitProc(3, 'c', 'f', 37), '37×1.8+32')
eq('温度 °F→°C', buildUnitProc(3, 'f', 'c', 98.6), '(98.6−32)÷1.8')
eq('温度 °C→K', buildUnitProc(3, 'c', 'k', 25), '25+273.15')
eq('温度 K→°C', buildUnitProc(3, 'k', 'c', 300), '300−273.15')
eq('温度 K→°F（先减 273.15 须括号）', buildUnitProc(3, 'k', 'f', 300), '(300−273.15)×1.8+32')
eq('温度 °F→K', buildUnitProc(3, 'f', 'k', 32), '(32−32)÷1.8+273.15')
eq('温度 负温 °C→°F', buildUnitProc(3, 'c', 'f', -40), '−40×1.8+32')

// ---------- 5) 同单位与求值一致性全表扫（每对单位 × 过程式求值 vs convertUnit） ----------
eq('同单位只带数值', buildUnitProc(0, 'm', 'm', 7), '7')
const SAMPLES = [12.5, 37]
for (let ci = 0; ci < calc.UNIT_CATS.length; ci++) {
  const us = calc.UNIT_CATS[ci].units
  for (const a of us) for (const b of us) {
    if (a.id === b.id) continue
    for (const v of SAMPLES) {
      const proc = buildUnitProc(ci, a.id, b.id, v)
      ok('过程式非空 ' + ci + ' ' + a.id + '→' + b.id, proc.length > 0)
      close('求值一致 ' + ci + ' ' + a.id + '→' + b.id + ' v=' + v, ev(proc), calc.convertUnit(ci, a.id, b.id, v))
    }
  }
}

// ---------- 6) 带回组装：空式子 / 非空式子（Ans 隐含乘法口径 + 整体加括号） ----------
eq('空式子直接放过程式', unitCarryExpr('', '5×2.54'), '5×2.54')
eq('空式子温度式不外包括号', unitCarryExpr('', '37×1.8+32'), '37×1.8+32')
eq('非空尾随运算符直接续', unitCarryExpr('3+', '5×2.54'), '3+(5×2.54)')
eq('非空尾随乘号直接续', unitCarryExpr('3×', '5×2.54'), '3×(5×2.54)')
eq('非空以数值结尾隐含乘法', unitCarryExpr('3', '37×1.8+32'), '3×(37×1.8+32)')
eq('非空以右括号结尾隐含乘法', unitCarryExpr('(2+3)', '5×2.54'), '(2+3)×(5×2.54)')
close('组装后求值 3+(5×2.54)', ev(unitCarryExpr('3+', '5×2.54')), 15.7)
close('组装后求值 3×(37×1.8+32)', ev(unitCarryExpr('3', '37×1.8+32')), 295.8)
close('温度过程并入后求值', ev(unitCarryExpr('2×', buildUnitProc(3, 'f', 'c', 98.6))), 74)

// ---------- 7) 源码断言：按钮、共用核心、旧裸结果带回已撤 ----------
ok('模板含带回计算钮（unitRes 才出现）', ux.includes('<div class="swap-btn swap-btn2" if="{{unitRes}}" onclick="unitCarryBack">'))
const unitPadIdx = ux.indexOf('unitPad(v) {')
const okIdx = unitPadIdx >= 0 ? ux.indexOf("v === 'ok'", unitPadIdx) : -1
ok('键盘带回键走 carryUnitProc', okIdx >= 0 && ux.slice(okIdx, okIdx + 80).includes('this.carryUnitProc()'))
ok('unitCarryBack 方法存在', ux.includes('unitCarryBack() {'))
ok('carryUnitProc 用 unitCarryExpr 组装', ux.includes('this.expr = unitCarryExpr(this.expr, proc)'))
ok('carryUnitProc 切回 calc 并刷新', ux.includes("this.view = 'calc'"))
const swapRowCss = (ux.match(/\.swap-btn2 \{([^}]*)\}/) || [])[1] || ''
ok('swap-btn2 只加左边距不撑高', !/height/.test(swapRowCss) && /margin-left/.test(swapRowCss))

// ---------- 8) 单位页总高复审（按 1.4.19 同口径逐段实算） ----------
function cssNum(sel, prop) {
  const block = (ux.match(new RegExp(sel.replace(/\./g, '\\.') + ' \\{([^}]*)\\}')) || [])[1]
  if (!block) throw new Error('找不到 CSS ' + sel)
  const m = block.match(new RegExp(prop + ': (\\d+)px'))
  if (!m) throw new Error(sel + ' 无 ' + prop)
  return parseInt(m[1], 10)
}
const barH = cssNum('.bar', 'height')                                    // 52
const chipRowH = 2 + 4 + 2 * (cssNum('.chip', 'height') + 2 * cssNum('.chip', 'margin')) // 两行 = 82
const cardsH = 2 * (cssNum('.u-card', 'height') + cssNum('.u-card', 'margin-top'))       // 120
const swapH = cssNum('.swap-row', 'height')                              // 30，未因新钮变化
const padH = cssNum('.pad', 'padding-top') + 4 * (cssNum('.key-sm', 'height') + 2 * cssNum('.key', 'margin')) // 194
eq('交换行高度仍为 30', swapH, 30)
ok('交换钮高 26 ≤ 行高', cssNum('.swap-btn', 'height') <= swapH)
const totalH = barH + chipRowH + cardsH + swapH + padH
eq('单位页总高 = 478', totalH, 478)
ok('单位页总高 ≤ 480', totalH <= 480)

console.log('\nregression-1.5.5: ' + pass + ' passed, ' + fail + ' failed')
if (fail) process.exit(1)
