// 回归测试 1.6.0：系数输入全面升级（√、π、e、括号）+ 单项式符号层 + 新工具「圆」
// 背景（用户 2026-11-15 定版）：「根号以及 π 等的那些可能需要输入的那些你都
// 看看，比如 π 输出的结果也可以带它，这样的话就不用精确计算」，并拍板与既有
// 工作融成一版 1.6.0；又问「根据考题以及那些实际要求，有必要再加些别的吗」。
// 本版内容：
//  ① 系数键盘改 5 列（QUAD_KEYS 首版 20 键）：加 √、π、e、) ——系数格（一次/
//     二次/方程组/图象设置/三角形/圆）从纯数字分数升级为可输单项式式子。首
//     版只有右括号没左括号（左括号唯一来源是 √ 键自带的 '√('，右括号负责关
//     它，√3/2 的 / 必须落在根号外）；未关的括号解析时自动补齐（coeffSrc）。
//     【2026-11-15 扩键修订】用户拍板按外部复审建议补 +、−、×、( 四键（24
//     键、末行 » 加宽占两格），和式系数 (1+√5)/2 可直接输入，§8a 已翻转、
//     §16 钉死新行为；引擎（coeffSrc/parseCoeff）零改动。
//  ② parseCoeff 升级：纯数字/分数走旧快路径（逐字旧口径、regression-1.4.17
//     的抽取直测守恒）；带符号式子走 calc.evaluate（coeffSrc 补隐含乘号与括号）。
//  ③ 单项式符号层（parseMono/monoMul/monoDiv/monoSub/monoSqrt/monoStr）：
//     系数是「有理数 × π^p × √m」形态时，结果也给符号形——一次方程符号解
//     （πx = 2 → x = 2/π）、三角形同签名单项式边提公共因子（等边 π → √3π²/4）、
//     圆的周长/面积天然带 π。推不出符号形（带 e、和式、根套根）回落数值，
//     数值路径永远先行、符号层只管显示与判定，符号形必经数值自检才显示。
//  ④ 新工具「圆」：输半径出周长＋面积（半径可输 √、π），符号形＋小数双显。
//  ⑤ 输入方程键盘改 5 列（30 键）：加 √(、π、e、^、%、°（求值层本来就认，
//     旧版只是没键可敲）；符号键补隐含乘号、后缀键带守卫。
//  ⑥ 科学键盘恢复常数 e 并补 π、%、Ans（24 键）：e 在 1.5.17 随 ×10ˣ 让位
//     下岗（怕与 e 记法混淆），而 1.5.17 的课本式 ×10 显示已让 e 记法从全部
//     结果中消失、混淆源头消除，高中考题又离不开 e——regression-1.5.17 的
//     §6b 旧断言已按定版翻转并在原文件标注披露（同 1.5.20 修订旧断言先例）。
//  不动：整数键盘（分数/公约数/根号化简页）、单位换算页、进制页、paykey、
//  既有精确形口径（分数/根式/eqSign）。
//  发布前追加修复（2026-11-15）：① 黑屏——calc.js 里 1.5.20 引入的 16 处
//  BigInt 字面量被手环 QuickJS 拒绝解析，全部改 BigInt() 构造（见 §9i-k）；
//  ② triArea 精确形补无 BigInt 的纯 Number 兜底（见 §10）。求值/求解核心的
//  语义口径不变，两处均为运行时兼容修复、Node 行为逐字守恒。
import { readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import calc from '../src/common/calc.js'
import calc2 from '../src/common/calc2.js'

let pass = 0, fail = 0, skip = 0
function ok(name, cond, extra) { if (cond) { pass++ } else { fail++; console.log('FAIL', name, extra == null ? '' : extra) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want, 'want=' + JSON.stringify(want)) }
function approx(name, got, want, rel) { ok(name + '（got=' + got + '）', isFinite(got) && Math.abs(got / want - 1) <= (rel || 1e-9)) }
const FD = (v) => calc.formatDisplay(v)

const uxPath = new URL('../src/pages/index/index.ux', import.meta.url).pathname
const ux = readFileSync(uxPath, 'utf8')
const ux2 = readFileSync(new URL('../src/pages/tools2/index.ux', import.meta.url), 'utf8')
const man = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
let buglog = null
try { buglog = readFileSync(new URL('../BUGLOG.md', import.meta.url), 'utf8') } catch (e) { /* 审查仓不含 BUGLOG.md：相关断言记 SKIP */ }

function loadPage(keyOk) {
  let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
  globalThis.__storage = { get(o) { o.success('') }, set() {} }
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__router = { push() {}, back() {}, replace() {} }
  globalThis.__calc = calc
  globalThis.__paykey = { keyMatches: keyOk ? () => true : () => false, normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), shortCodeForDevice: () => 'AAAAAA' }
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import router from '@system.router'", 'const router = globalThis.__router')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  const tmp = join(tmpdir(), 'calc-page-160-' + process.pid + '.cjs')
  // 页面脚本已 >128KB（1.6.0 增长），不能再走命令行参数传递（E2BIG），直接落盘
  writeFileSync(tmp, script)
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
// 第二页（pages/tools2）加载器：四个新工具因手环 QuickJS 堆上限拆到独立页
// （见 §9 注释与 BUGLOG 1.6.0），页面级断言改走这里。
function loadPage2() {
  let script = ux2.slice(ux2.indexOf('<script>') + 8, ux2.indexOf('</script>'))
  globalThis.__storage = { get(o) { o.success('') }, set() {} }
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__router = { push() {}, back() {}, replace() {} }
  globalThis.__calc = calc
  globalThis.__calc2 = calc2
  globalThis.__paykey = { keyMatches: () => false, normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), shortCodeForDevice: () => 'AAAAAA' }
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import router from '@system.router'", 'const router = globalThis.__router')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import calc2 from '../../common/calc2'", 'const calc2 = globalThis.__calc2')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  const mod = { exports: {} }
  new Function('module', 'exports', script)(mod, mod.exports)
  return mod.exports
}
const def2 = loadPage2()
function makeInst2() {
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(def2.data)))
  for (const k of Object.keys(def2)) if (typeof def2[k] === 'function') inst[k] = def2[k].bind(inst)
  inst.onInit()
  inst.unlocked = true
  return inst
}
// 页面独立函数抽取（parseCoeff 的旧快路径须在无 calc 依赖下与 1.4.17 同口径，
// 这里带 calc 抽取测全量表达式路径）
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
const FN = ['coeffSrc', 'parseCoeff', 'parseCoeff0', 'editCoeff', 'gcd2', 'monoRed', 'monoMul', 'monoInv', 'monoDiv', 'monoSub', 'monoSqrt', 'parseMono', 'monoOf', 'monoStr']
const F = new Function('calc', FN.map(extractFn).join('\n') + '\nreturn { ' + FN.join(', ') + ' }')(calc)
const monoVal = (m) => (m.qn / m.qd) * Math.pow(Math.PI, m.pi) * Math.sqrt(m.rad)

// ---------- §1 parseCoeff：旧口径守恒 + 表达式路径 ----------
{
  ok('1a 空串 NaN', isNaN(F.parseCoeff('')))
  ok('1a 半截负号 NaN', isNaN(F.parseCoeff('-')))
  eq('1b 分数 1/2', F.parseCoeff('1/2'), 0.5)
  eq('1b 分数 -3/4', F.parseCoeff('-3/4'), -0.75)
  ok('1b 分母 0 NaN', isNaN(F.parseCoeff('1/0')))
  eq('1b 小数 2.5', F.parseCoeff('2.5'), 2.5)
  ok('1b 半截分数 3/ NaN', isNaN(F.parseCoeff('3/')))
  eq('1c 留空按 0', F.parseCoeff0(''), 0)
  approx('1d √(4) = 2', F.parseCoeff('√(4)'), 2)
  approx('1d 光秃秃 √2 自动补括号', F.parseCoeff('√2'), Math.sqrt(2))
  approx('1d 2√(3)', F.parseCoeff('2√(3)'), 2 * Math.sqrt(3))
  approx('1d π', F.parseCoeff('π'), Math.PI)
  approx('1d 2π', F.parseCoeff('2π'), 2 * Math.PI)
  approx('1d π/2', F.parseCoeff('π/2'), Math.PI / 2)
  approx('1d √(2/3)', F.parseCoeff('√(2/3)'), Math.sqrt(2 / 3))
  approx('1d √(3)/2（根号外的除法）', F.parseCoeff('√(3)/2'), Math.sqrt(3) / 2)
  approx('1d 常数 e', F.parseCoeff('e'), Math.E)
  approx('1d 2e 是 2×e（隐含乘号）', F.parseCoeff('2e'), 2 * Math.E)
  approx('1d e2 是 e×2', F.parseCoeff('e2'), 2 * Math.E)
  approx('1d 未闭合 √(3 自动补齐', F.parseCoeff('√(3'), Math.sqrt(3))
  ok('1e 半截 √(', isNaN(F.parseCoeff('√(')))
  ok('1e 空根号 √()', isNaN(F.parseCoeff('√()')))
  ok('1e 根号后悬空除号 √(3)/', isNaN(F.parseCoeff('√(3)/')))
  ok('1e 负数开方 √(0-4)... 系数格无减号键，用 √(-4) 直测', isNaN(F.parseCoeff('√(-4)')))
}

// ---------- §2 editCoeff：按键序列 ----------
{
  const seq = (keys, from) => { let s = from || ''; for (const k of keys) { const r = F.editCoeff(s, k); if (r !== 'NEXT') s = r } return s }
  eq('2a 敲 √(3)/2', seq(['sqrt', '3', ')', '/', '2']), '√(3)/2')
  eq('2a 敲 √(2/3)', seq(['sqrt', '2', '/', '3', ')']), '√(2/3)')
  eq('2a 敲 2√3（不关根号也合法）', seq(['2', 'sqrt', '3']), '2√(3')
  eq('2a 敲 π/2', seq(['pi', '/', '2']), 'π/2')
  eq('2b ± 切换', seq(['neg'], 'π'), '-π')
  eq('2b ± 切回', seq(['neg', 'neg'], ''), '')
  eq('2c 空格按 . 给 0.', seq(['.']), '0.')
  eq('2c 根号后禁 /', seq(['sqrt', '/']), '√(')
  eq('2c 开头禁 /', seq(['/']), '')
  eq('2c 右括号后禁 .', seq(['sqrt', '2', ')', '.']), '√(2)')
  eq('2d C 清空', seq(['sqrt', '3', 'C']), '')
  eq('2d 退格逐字删', seq(['sqrt', 'back']), '√')
  eq('2e 20 字上限', seq(Array(25).fill('9')).length, 20)
  eq('2f 前导零替换', seq(['0', '5']), '5')
  // 纯数字模式守恒 1.4.1 旧口径（run-tests 钉住的三条，editCoeff 必须同行为）
  eq('2g 纯分数第二个 / 被拒', seq(['1', '/', '2', '/']), '1/2')
  eq('2g 分数里不许再打小数点', seq(['1', '/', '2', '.']), '1/2')
  eq('2g 分母前导零被替换', seq(['1', '/', '0', '5']), '1/5')
  eq('2h 带根号才放行第二层 /', seq(['sqrt', '2', '/', '3', ')', '/', '2']), '√(2/3)/2')
  eq('2h 根号内可打小数', seq(['sqrt', '2', '.', '5']), '√(2.5')
}

// ---------- §3 parseMono / monoStr：符号层代数 ----------
{
  const M = (s) => F.parseMono(s)
  eq('3a π', JSON.stringify(M('π')), JSON.stringify({ qn: 1, qd: 1, pi: 1, rad: 1 }))
  eq('3a 2√(3)', JSON.stringify(M('2√(3)')), JSON.stringify({ qn: 2, qd: 1, pi: 0, rad: 3 }))
  eq('3a √(2/3) = √6/3', JSON.stringify(M('√(2/3)')), JSON.stringify({ qn: 1, qd: 3, pi: 0, rad: 6 }))
  eq('3a √(3)/2', JSON.stringify(M('√(3)/2')), JSON.stringify({ qn: 1, qd: 2, pi: 0, rad: 3 }))
  eq('3a √(12) 化简 2√3', JSON.stringify(M('√(12)')), JSON.stringify({ qn: 2, qd: 1, pi: 0, rad: 3 }))
  eq('3a √(4) = 2', JSON.stringify(M('√(4)')), JSON.stringify({ qn: 2, qd: 1, pi: 0, rad: 1 }))
  eq('3a 2√(3)π', JSON.stringify(M('2√(3)π')), JSON.stringify({ qn: 2, qd: 1, pi: 1, rad: 3 }))
  eq('3a -√(2)', JSON.stringify(M('-√(2)')), JSON.stringify({ qn: -1, qd: 1, pi: 0, rad: 2 }))
  ok('3b 带 e 推不出', M('e') === null)
  ok('3b √(π) 推不出（π 奇数幂开方）', M('√(π)') === null)
  ok('3b 根套根推不出', M('√(√(2))') === null)
  ok('3b 未闭合推不出', M('√(3') === null)
  eq('3c monoStr 2/π', F.monoStr(M('2/π')), '2/π')
  eq('3c monoStr π/2', F.monoStr(M('π/2')), 'π/2')
  eq('3c monoStr √3/2', F.monoStr(M('√(3)/2')), '√3/2')
  eq('3c monoStr 2√3π', F.monoStr(M('2√(3)π')), '2√3π')
  eq('3c monoStr −√2', F.monoStr(M('-√(2)')), '−√2')
  eq('3c monoStr 纯整数', F.monoStr(M('5')), '5')
  eq('3c monoStr 分母两项加括号', F.monoStr({ qn: 3, qd: 2, pi: -1, rad: 1 }), '3/(2π)')
  // 符号值与数值解析交叉核对（符号层只许在与数值一致时出现）
  for (const s of ['π', '2π', 'π/2', '2√(3)', '√(2/3)', '√(3)/2', '√(12)', '3/4', '2√(3)π', '√(5)/5', '10/π']) {
    approx('3d 符号值=数值 ' + s, monoVal(M(s)), F.parseCoeff(s))
  }
  eq('3e monoSub 同签名相减', JSON.stringify(F.monoSub(M('2π'), M('π'))), JSON.stringify({ qn: 1, qd: 1, pi: 1, rad: 1 }))
  ok('3e monoSub 异签名推不出', F.monoSub(M('π'), M('1')) === null)
  eq('3e monoDiv 2/π', JSON.stringify(F.monoDiv(M('2'), M('π'))), JSON.stringify({ qn: 2, qd: 1, pi: -1, rad: 1 }))
  eq('3e monoOf 空串为零单项式', JSON.stringify(F.monoOf('')), JSON.stringify({ qn: 0, qd: 1, pi: 0, rad: 1 }))
}

// ---------- §4 一次方程：符号解 ----------
{
  const inst = makeInst()
  inst.la = 'π'; inst.lb = '0'; inst.lc = '0'; inst.ld = '2'; inst.linSolve()
  ok('4a πx = 2 → x = 2/π 带符号形', inst.lLines[0].indexOf('x = 2/π') === 0 && inst.lLines[0].indexOf('≈') > 0, inst.lLines[0])
  inst.la = '√(2)'; inst.ld = '2'; inst.linSolve()
  ok('4b √2x = 2 → x = √2', inst.lLines[0].indexOf('x = √2') === 0, inst.lLines[0])
  inst.la = '2'; inst.ld = 'π'; inst.linSolve()
  ok('4c 2x = π → x = π/2', inst.lLines[0].indexOf('x = π/2') === 0, inst.lLines[0])
  inst.la = 'e'; inst.ld = '2'; inst.linSolve()
  ok('4d ex = 2 只给数值（e 推不出符号形）', inst.lLines[0].indexOf('π') < 0 && inst.lLines[0].indexOf('√') < 0 && inst.lLines[0].indexOf('0.735758882343') >= 0, inst.lLines[0])
  inst.la = '2'; inst.lb = '3'; inst.lc = '0'; inst.ld = '7'; inst.linSolve()
  eq('4e 有理基线逐字不变', inst.lLines[0], 'x = 2')
}

// ---------- §5 二次方程：符号系数数值解 + 基线 ----------
{
  const inst = makeInst()
  inst.qa = '√(2)'; inst.qb = '0'; inst.qc = '-2'; inst.quadSolve()
  ok('5a √2x²−2=0 给数值根', inst.qLines.length === 3 && inst.qLines[1].indexOf('1.18920711') >= 0, JSON.stringify(inst.qLines))
  inst.qa = 'π'; inst.qb = '0'; inst.qc = '-π'; inst.quadSolve()
  ok('5b πx²−π=0 根为 ±1', inst.qLines.length === 3 && inst.qLines[1].indexOf('x1') === 0 && inst.qLines[1].indexOf('1') >= 0, JSON.stringify(inst.qLines))
  inst.qa = '1'; inst.qb = '-3'; inst.qc = '2'; inst.quadSolve()
  eq('5c 基线判别式行', inst.qLines[0], '判别式 Δ = 1 > 0')
  eq('5c 基线 x1（1.6.0 自查 B4 修订：x1<x2）', inst.qLines[1], 'x1 = 1')
  eq('5c 基线 x2（1.6.0 自查 B4 修订：x1<x2）', inst.qLines[2], 'x2 = 2')
}

// ---------- §6 三角形面积：符号边 ----------
{
  const inst = makeInst()
  eq('6a 基线 3/4/5', JSON.stringify(inst.tLines), JSON.stringify(['面积 = 6']))
  inst.ta = 'π'; inst.tb = 'π'; inst.tc = 'π'; inst.triSolve()
  eq('6b 等边 π → √3π²/4', inst.tLines[0], '面积 = √3π²/4')
  eq('6b 等边 π 小数行', inst.tLines[1], '≈ ' + FD(calc.triArea(Math.PI, Math.PI, Math.PI).area))
  inst.ta = '2π'; inst.tb = '2π'; inst.tc = '2π'; inst.triSolve()
  eq('6c 等边 2π → √3π²', inst.tLines[0], '面积 = √3π²')
  inst.ta = '√(2)'; inst.tb = '2√(2)'; inst.tc = '2√(2)'; inst.triSolve()
  eq('6d √2 系等腰 → √15/2', inst.tLines[0], '面积 = √15/2')
  eq('6d 小数行与数值路径一致', inst.tLines[1], '≈ ' + FD(calc.triArea(Math.sqrt(2), 2 * Math.sqrt(2), 2 * Math.sqrt(2)).area))
  inst.ta = 'π'; inst.tb = 'π'; inst.tc = '1'; inst.triSolve()
  ok('6e 异签名（π,π,1）回落数值', inst.tLines[0].indexOf('面积 ≈ ') === 0, inst.tLines[0])
  inst.ta = 'π'; inst.tb = 'π'; inst.tc = '2π'; inst.triSolve()
  eq('6f π 系退化精确判定', inst.tLines[0], '退化成一条直线，面积 = 0')
  inst.ta = 'π'; inst.tb = '2π'; inst.tc = '10π'; inst.triSolve()
  eq('6g π 系构不成精确判定', inst.tLines[0], '不能构成三角形')
  inst.ta = 'π'; inst.tb = '1'; inst.tc = '10'; inst.triSolve()
  eq('6h 普通构不成不变', inst.tLines[0], '不能构成三角形')
}

// ---------- §7 圆（新工具） ----------
{
  const inst = makeInst()
  eq('7a r=1 周长', inst.cLines[0], '周长 = 2π')
  eq('7a r=1 周长小数', inst.cLines[1], '≈ 6.28318530718')
  eq('7a r=1 面积', inst.cLines[2], '面积 = π')
  eq('7a r=1 面积小数', inst.cLines[3], '≈ 3.14159265359')
  inst.cr = '3'; inst.circSolve()
  eq('7b r=3 周长', inst.cLines[0], '周长 = 6π')
  eq('7b r=3 面积', inst.cLines[2], '面积 = 9π')
  eq('7b r=3 面积小数', inst.cLines[3], '≈ ' + FD(9 * Math.PI))
  inst.cr = '√(2)'; inst.circSolve()
  eq('7c r=√2 周长', inst.cLines[0], '周长 = 2√2π')
  eq('7c r=√2 面积', inst.cLines[2], '面积 = 2π')
  inst.cr = 'π'; inst.circSolve()
  eq('7d r=π 周长', inst.cLines[0], '周长 = 2π²')
  eq('7d r=π 面积', inst.cLines[2], '面积 = π³')
  inst.cr = '0'; inst.circSolve()
  eq('7e 半径 0 报错', inst.cLines[0], '半径要大于 0')
  inst.cr = ''; inst.circSolve()
  eq('7e 半径空提示', inst.cLines[0], '把半径填好就能算')
  inst.cr = 'e'; inst.circSolve()
  ok('7f r=e 只给数值', inst.cLines.length === 2 && inst.cLines[0].indexOf('周长 ≈ ') === 0, JSON.stringify(inst.cLines))
  const inst2 = makeInst()
  inst2.cr = ''; inst2.circSolve()
  inst2.circPad('sqrt'); inst2.circPad('2'); inst2.circPad(')')
  eq('7g circPad 敲出 √(2)', inst2.cr, '√(2)')
  eq('7g 敲完即出符号面积', inst2.cLines[2], '面积 = 2π')
}

// ---------- §8 键盘与输入链 ----------
{
  const inst = makeInst()
  // 【2026-11-15 扩键修订】首版 20 键、无左括号的断言就地翻转（见 §16）。
  eq('8a 系数键盘 24 键', inst.quadKeys.length, 24)
  ok('8a 系数键盘含 √/π/e/)///±', ['sqrt', 'pi', 'e', ')', '/', 'neg'].every((v) => inst.quadKeys.some((k) => k.v === v)))
  ok('8a 系数键盘含 +、−、×、(（扩键四键）', ['+', '−', '×', '('].every((v) => inst.quadKeys.some((k) => k.v === v)))
  ok('8a 系数键盘仍无 00', !inst.quadKeys.some((k) => k.v === '00'))
  ok('8a 末键 » 带加宽类 key-c5w', inst.quadKeys[23].v === 'ok' && inst.quadKeys[23].kcls === 'key-c5w')
  eq('8b 方程键盘 30 键', inst.eqKeys.length, 30)
  ok('8b 方程键盘含 √(、π、e、^、%、°', ['√(', 'π', 'e', '^', '%', '°'].every((v) => inst.eqKeys.some((k) => k.v === v)))
  const k2 = inst.eqKeys.find((k) => k.v === '²')
  ok('8b ² 键旧属性不变（run-tests 同口径）', k2.label === '²' && k2.kcls === 'eqsup-k')
  eq('8c 科学键盘 24 键', inst.sciKeys.length, 24)
  ok('8c 科学键盘含 e、π、%、Ans、×10', ['e', 'π', '%', 'ans', 'x10'].every((v) => inst.sciKeys.some((k) => k.v === v)))
  // 系数页敲键链：quadPad 把 √(3) 敲进 a 格并实时求解（不报错）
  inst.qa = ''; inst.qField = 'a'
  inst.quadPad('sqrt'); inst.quadPad('3'); inst.quadPad(')')
  eq('8d quadPad 敲出 √(3)', inst.qa, '√(3)')
  ok('8d 带根号系数实时出判别式行', inst.qLines[0].indexOf('判别式') === 0, JSON.stringify(inst.qLines))
  // 输入方程敲符号：√(2)x=4、πx+1=0
  const ie = makeInst()
  for (const v of ['√(', '2', ')', 'x', '=', '4']) ie.eqPad(v)
  eq('8e eqPad 敲出 √(2)x=4', ie.eqExpr, '√(2)x=4')
  ie.eqSolve()
  ok('8e √(2)x=4 解出 2√2 的小数', ie.eqLines.join(' ').indexOf('2.8284271247') >= 0, JSON.stringify(ie.eqLines))
  const ie2 = makeInst()
  for (const v of ['π', 'x', '+', '1', '=', '0']) ie2.eqPad(v)
  eq('8f eqPad 敲出 πx+1=0', ie2.eqExpr, 'πx+1=0')
  ie2.eqSolve()
  ok('8f πx+1=0 解出 −1/π 的小数', ie2.eqLines.join(' ').indexOf('0.318309886184') >= 0, JSON.stringify(ie2.eqLines))
  const ie3 = makeInst()
  ie3.eqPad('^')
  eq('8g 空式子按 ^ 忽略', ie3.eqExpr, '')
  ie3.eqPad('π'); ie3.eqPad('²')
  eq('8g π² 可敲', ie3.eqExpr, 'π²')
  // 主计算器科学键盘常数链
  const ic = makeInst()
  ic.padPage = 'sci'
  ic.pressKey('π')
  approx('8h 科学键盘 π 预览', ic.previewVal, Math.PI)
  ic.pressKey('C'); ic.pressKey('e')
  approx('8h 科学键盘 e 预览', ic.previewVal, Math.E)
  ic.pressKey('C'); ic.pressKey('2'); ic.pressKey('π')
  eq('8h 数字后 π 补隐含乘号', ic.expr, '2×π')
}

// ---------- §9 未动面守卫 + 落点审计 ----------
{
  const inst = makeInst()
  eq('9a 公约数基线不变', JSON.stringify(inst.gLines), JSON.stringify(['最大公约数 = 6', '最小公倍数 = 36']))
  eq('9b 根号化简基线不变', inst.sqrtLines[0], '√12 = 2√3')
  // 2026-11-15 修订：新增「数据统计」工具后工具箱 14 → 15 个（§20），按先例翻转并披露。
  // 2026-11-15 再修订：用户点名「那些都做」，新增分布列 / 向量 / 复数 / 韦达弦长
  // 四个工具后 15 → 19 个（§21），按先例翻转并披露。
  eq('9c 工具箱 19 个工具（圆 + 微信定案四工具 + 统计 + 分布列/向量/复数/韦达）', inst.tools.length, 19)
  ok('9c 工具列表含圆', inst.tools.some((t) => t.id === 'circ'))
  ok('9c 工具列表含四个新工具', ['rtri', 'law', 'perm', 'seq'].every((id) => inst.tools.some((t) => t.id === id)))
  ok('9d 模板含圆视图', ux.indexOf("view === 'circ'") >= 0)
  const tpl = ux.split('<script>')[0]
  const divs = tpl.match(/<div[^>]*>/g) || []
  eq('9e 模板无裸 div（1.5.20 钉注守恒）', divs.filter((d) => !/class=/.test(d)).length, 0)
  ok('9f 五个系数页 + 圆页都走 editCoeff', (ux.match(/editCoeff\(/g) || []).length >= 7)
  if (buglog !== null) { ok('9g BUGLOG 含 1.6.0 条目', buglog.indexOf('1.6.0') >= 0) } else { skip++ }
  eq('9h manifest 版本锁 1.6.0/60', man.versionName + '/' + man.versionCode, '1.6.0/60')
  // 黑屏真因守卫（2026-11-15 二分实测定案）：1.5.20 的黑屏与「体积」无关——
  // 同体积的 1.5.16 源码在模拟器正常、1.5.20 失败，真因是手环 Vela 的
  // QuickJS 构建不带 BigInt，BigInt 字面量（4n、0n、10n 等）是解析期语法，
  // typeof 守卫挡不住——模块解析失败（日志 TypeError: bytecode function
  // expected + Failed to load page）整页黑屏。1.5.20 第十四轮 N-01/N-02 修复
  // 引入 16 处字面量，Node/V8 能解析所以全套测试全过、测不出来。修复口径：
  // 字面量一律改 BigInt() 构造（运行时调用、有守卫兜底）。本守卫逐字扫描
  // 源文件，字面量零容忍，防复发。（注：堆上限是另一个真问题——带四工具的
  // 整包在设备上编译驻留会撞约 7.6MB 的 QuickJS 堆上限，靠拆页＋JSC 预编译
  // 打包解决，见下面拆页守卫与 BUGLOG 1.6.0 发布前追加节。）
  const litRe = /(?<![\w$.])\d+n(?![\w$])/g
  const calcSrc = readFileSync(new URL('../src/common/calc.js', import.meta.url), 'utf8')
  let paySrc = null
try { paySrc = readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8') } catch (e) { /* 审查仓不含 paykey.js：相关断言记 SKIP */ }
  eq('9i 黑屏守卫：calc.js 无 BigInt 字面量', (calcSrc.match(litRe) || []).length, 0)
  eq('9j 黑屏守卫：index.ux 无 BigInt 字面量', (ux.match(litRe) || []).length, 0)
  if (paySrc !== null) { eq('9k 黑屏守卫：paykey.js 无 BigInt 字面量', (paySrc.match(litRe) || []).length, 0) } else { skip++ }
  // 拆页守卫（2026-11-15 实测定案第二幕）：BigInt 修复后，带四个新工具的整包
  // 在模拟器加载/初始化时撞 QuickJS 堆上限（日志 __out_of_memory_tracker +
  // bytecode 约 6.8MB），四个新工具（视图+方法+引擎）拆到第二页 pages/tools2、
  // 引擎独立为 common/calc2.js（只被第二页引用），主页堆占用回落。守卫：
  // 第二页与 calc2.js 同样零 BigInt 字面量、模板无裸 div、manifest 路由齐全。
  const calc2Src = readFileSync(new URL('../src/common/calc2.js', import.meta.url), 'utf8')
  eq('9l 黑屏守卫：calc2.js 无 BigInt 字面量', (calc2Src.match(litRe) || []).length, 0)
  eq('9m 黑屏守卫：tools2 无 BigInt 字面量', (ux2.match(litRe) || []).length, 0)
  const tpl2 = ux2.split('<script>')[0]
  const divs2 = tpl2.match(/<div[^>]*>/g) || []
  eq('9n 第二页模板无裸 div', divs2.filter((d) => !/class=/.test(d)).length, 0)
  ok('9o manifest 含第二页路由与 router 声明', !!(man.router && man.router.pages && man.router.pages['pages/tools2']) && JSON.stringify(man.features).indexOf('system.router') >= 0)
  ok('9p 主页不再含四个新工具视图（已拆页）', ['rtri', 'law', 'perm', 'seq'].every((v) => ux.indexOf("view === '" + v + "'") < 0))
  ok('9q 跨页导航必须 replace（push 会双页驻留 OOM）', ux.indexOf("router.replace({ uri: '/pages/tools2', params: { tool: id } })") >= 0 && ux.indexOf('router.push') < 0)
}

// §10 无 BigInt 运行时模拟（手环 QuickJS 无 BigInt、只有 typeof 守卫兜底）：
// 屏蔽全局 BigInt 后以新模块实例重跑关键路径，断言降级行为与有 BigInt 时一致。
// triArea 的精确形原先全靠 BigInt 路径，无 BigInt 时只剩 ≈ 小数（模拟器实测
// 3/4/5 只显示「≈ 6」）——已补纯 Number 兜底（中间量超安全整数才放弃）。
{
  const savedBigInt = globalThis.BigInt
  globalThis.BigInt = undefined
  try {
    const nb = (await import('../src/common/calc.js?nobigint=1')).default
    eq('10a 无 BigInt triArea(3,4,5) 精确形', JSON.stringify(nb.triArea(3, 4, 5).exact), JSON.stringify({ cn: 6, cd: 1, rad: 1 }))
    eq('10b 无 BigInt triArea(2,3,4) 精确形', JSON.stringify(nb.triArea(2, 3, 4).exact), JSON.stringify({ cn: 3, cd: 4, rad: 15 }))
    eq('10c 无 BigInt triArea(1,1,1) 精确形', JSON.stringify(nb.triArea(1, 1, 1).exact), JSON.stringify({ cn: 1, cd: 4, rad: 3 }))
    eq('10d 无 BigInt triArea(0.3,0.4,0.5) 精确形', JSON.stringify(nb.triArea(0.3, 0.4, 0.5).exact), JSON.stringify({ cn: 3, cd: 50, rad: 1 }))
    eq('10e 无 BigInt triArea 退化判定', nb.triArea(1, 2, 3).type, 'degenerate')
    eq('10f 无 BigInt triArea 构不成判定', nb.triArea(1, 2, 4).error, '不能构成三角形')
    const q = nb.solveQuad(1, -3, 2)
    ok('10g 无 BigInt 二次方程根 2/1', q.type === 'two' && ((q.x1 === 2 && q.x2 === 1) || (q.x1 === 1 && q.x2 === 2)), JSON.stringify(q))
    const s = nb.solveSystem(1, 1, 3, 1, -1, 1)
    ok('10h 无 BigInt 方程组解 2/1', Math.abs(s.x - 2) < 1e-9 && Math.abs(s.y - 1) < 1e-9, JSON.stringify(s))
    eq('10i 无 BigInt 求值 2+3', nb.evaluate('2+3'), 5)
    eq('10j 有/无 BigInt triArea 一致', JSON.stringify(calc.triArea(2, 3, 4).exact), JSON.stringify(nb.triArea(2, 3, 4).exact))
  } finally {
    globalThis.BigInt = savedBigInt
  }
}

// §11 微信定案四个新工具（2026-11-15 用户经微信拍板、主聊天执行）：解直角
// 三角形（初中清单第 4）、正弦/余弦定理、排列组合、等差/等比数列（高中）。
// 引擎在 calc2.js（solveRightTri / solveTriangle / permComb / seqSolve；
// 只被第二页引用、主页不加载，见 §9 拆页守卫），页面在 pages/tools2。
// 全程普通 Number、无 BigInt 依赖；页面只显示「解出来的量」，已知量在格子里。
{
  const rt = calc2.solveRightTri({ a: 3, b: 4, c: null, A: null, B: null })
  ok('11a 直角 3/4 → c=5', rt.type === 'ok' && rt.c === 5)
  ok('11b 直角 3/4 → 角 36.87/53.13', Math.abs(rt.A - 36.86989764584402) < 1e-9 && Math.abs(rt.B - 53.13010235415598) < 1e-9)
  const rt2 = calc2.solveRightTri({ a: null, b: null, c: 5, A: 30, B: null })
  ok('11c 直角 c=5 A=30 → a=2.5 b≈4.3301', Math.abs(rt2.a - 2.5) < 1e-9 && Math.abs(rt2.b - 4.330127018922194) < 1e-9)
  eq('11d 直角斜边不长于直角边报错', calc2.solveRightTri({ a: 5, b: null, c: 4, A: null, B: null }).error, '斜边 c 要比直角边长')
  eq('11e 直角只有角报错', calc2.solveRightTri({ a: null, b: null, c: null, A: 30, B: 60 }).error, '至少要填一条边')
  eq('11f 直角量对不上报错', calc2.solveRightTri({ a: 3, b: 4, c: null, A: 50, B: null }).error, '填的量对不上')
  eq('11g 直角不符合勾股报错', calc2.solveRightTri({ a: 3, b: 4, c: 6, A: null, B: null }).error, '三边不符合勾股定理')

  const pc = calc2.permComb(5, 2)
  ok('11h 排列组合 5,2 → 20/10 精确', pc.A === 20 && pc.C === 10 && pc.aExact && pc.cExact)
  ok('11i 排列组合 r=0 → 1/1', calc2.permComb(10, 0).A === 1 && calc2.permComb(10, 0).C === 1)
  eq('11j 排列组合 r>n 报错', calc2.permComb(3, 5).error, 'r 不能大于 n')
  ok('11k 排列组合 C(60,30) 超安全整数标约数', calc2.permComb(60, 30).cExact === false)

  const ap = calc2.seqSolve('ap', 1, 2, 10)
  ok('11l 等差 1,2,10 → 19/100', ap.an === 19 && ap.Sn === 100)
  const gp = calc2.seqSolve('gp', 1, 2, 10)
  ok('11m 等比 1,2,10 → 512/1023', gp.an === 512 && gp.Sn === 1023)
  ok('11n 等比 q=1 → Sn=n·a1', calc2.seqSolve('gp', 3, 1, 5).Sn === 15)
  ok('11o 等比分数 1,1/2,10 → an=1/512', Math.abs(calc2.seqSolve('gp', 1, 0.5, 10).an - 0.001953125) < 1e-15)

  const sss = calc2.solveTriangle({ a: 3, b: 4, c: 5, A: null, B: null, C: null })
  ok('11p 正余弦 SSS → C=90 面积 6', sss.solutions.length === 1 && Math.abs(sss.solutions[0].C - 90) < 1e-9 && Math.abs(sss.solutions[0].area - 6) < 1e-9)
  const sas = calc2.solveTriangle({ a: 3, b: null, c: 4, A: null, B: 90, C: null })
  ok('11q 正余弦 SAS → b=5', Math.abs(sas.solutions[0].b - 5) < 1e-9)
  const asa = calc2.solveTriangle({ a: null, b: null, c: 5, A: 45, B: 45, C: null })
  ok('11r 正余弦 ASA → C=90 a=b', Math.abs(asa.solutions[0].C - 90) < 1e-9 && Math.abs(asa.solutions[0].a - asa.solutions[0].b) < 1e-9)
  eq('11s 正余弦 SSA 两解', calc2.solveTriangle({ a: 6, b: 10, c: null, A: 30, B: null, C: null }).solutions.length, 2)
  eq('11t 正余弦 SSA 无解报错', calc2.solveTriangle({ a: 4, b: 10, c: null, A: 30, B: null, C: null }).error, '这样的三角形不存在')
  eq('11u 正余弦 SSA 直角唯一解（防浮点裂双解）', calc2.solveTriangle({ a: 5, b: 10, c: null, A: 30, B: null, C: null }).solutions.length, 1)
  eq('11v 正余弦多填对不上报错', calc2.solveTriangle({ a: 3, b: 4, c: 5, A: null, B: null, C: 80 }).error, '填的量对不上')
  eq('11w 正余弦三边构不成报错', calc2.solveTriangle({ a: 1, b: 2, c: 4, A: null, B: null, C: null }).error, '三边不能构成三角形')

  const inst = makeInst2()
  eq('11x 页面默认直角结果', JSON.stringify(inst.rtLines), JSON.stringify(['c = 5', 'A ≈ 36.87° · B ≈ 53.13°']))
  eq('11y 页面默认正余弦结果', JSON.stringify(inst.lwLines), JSON.stringify(['A ≈ 36.87° · B ≈ 53.13° · C = 90°', '面积 = 6']))
  eq('11z 页面默认排列组合结果', JSON.stringify(inst.pmLines), JSON.stringify(['A(5,2) = 20', 'C(5,2) = 10']))
  eq('11aa 页面默认等差结果', JSON.stringify(inst.sqLines), JSON.stringify(['第 10 项 = 19', '前 10 项和 = 100']))
  inst.sqKind = 'gp'; inst.sqSolve()
  eq('11ab 页面等比结果', JSON.stringify(inst.sqLines), JSON.stringify(['第 10 项 = 512', '前 10 项和 = 1023']))
  inst.rta = '1'; inst.rtb = '1'; inst.rtSolve()
  ok('11ac 直角 1/1 → c 根式行', inst.rtLines[0].indexOf('c = √2') === 0, JSON.stringify(inst.rtLines))
  ok('11ad 第二页模板含四个新视图', ['rtri', 'law', 'perm', 'seq'].every((v) => ux2.indexOf("view === '" + v + "'") >= 0))
}

// ---------- §12 1.6.0 发布前全量自查修复（2026-11-15 用户令：跟 DeepSeek 一样
// 仔细、一次性找完所有 bug，输出/输入/界面全查） ----------
// 审查方法：独立审查员只读通读 calc.js（876 行）与 calc2.js（163 行）后用 node
// 直接 import 运行验证，报 16 条 B1–B16（中高 2、中 5、低中 1、低 8），每条带
// 复现命令；我用探针逐项复跑，16 条全部属实。另纠正审查员两处错误：B3a 的真
// 判别式是 3.9968e-15（他写 4.44e-16）；B9 中他写的 2^50% 期望值是他自己的
// 算术笔误，正确口径是先算幂再取 % 即 /100 → 1.125899906842624e13。
// 其中 B3/B12 定案不改（见 12c/12l 守恒断言与 BUGLOG），B10 只修 0^-1 的
// div0、溢出返回 Infinity 为既定口径（见 12j 注记）。
{
  const EV = (s) => { try { return calc.evaluate(s) } catch (e) { return 'ERR:' + e.message } }
  // B1：三个角全给时校验内角和
  eq('12a 三角和 190° 报错', calc2.solveTriangle({ a: 5, A: 30, B: 60, C: 100 }).error, '三个角加起来要等于 180°')
  eq('12a 三角和 179° 报错', calc2.solveTriangle({ a: 5, A: 30, B: 60, C: 89 }).error, '三个角加起来要等于 180°')
  eq('12a 三角和 180° 给解', calc2.solveTriangle({ a: 5, A: 30, B: 60, C: 90 }).type, 'ok')
  eq('12a 两角和 ≥180° 旧报错不变', calc2.solveTriangle({ a: 5, A: 100, B: 90 }).error, '两个角加起来要小于 180°')
  // B2：小数边退化（0.1+0.2=0.3）
  eq('12b 0.1/0.2/0.3 退化', calc2.solveTriangle({ a: 0.1, b: 0.2, c: 0.3 }).error, '三边退化成一条直线')
  eq('12b 整数 1/2/3 退化不变', calc2.solveTriangle({ a: 1, b: 2, c: 3 }).error, '三边退化成一条直线')
  eq('12b 3/4/5 正常', calc2.solveTriangle({ a: 3, b: 4, c: 5 }).type, 'ok')
  // B3：1e-14 模糊带是 1.5.20 N-01 定版政策，不收紧（15 位小数构造的边界例在
  // 初高中不存在；容差是为短小数输入的二进制表示噪声服务的）。守恒：
  eq('12c 模糊带内侧仍判重根', calc.solveQuad(1, 2, 1 + 1e-15).type, 'one')
  eq('12c 模糊带外侧仍判两根', calc.solveQuad(1, 2, 1 - 1e-13).type, 'two')
  eq('12c 课本题假重根仍判重根', calc.solveQuad(0.1, 0.7, 1.225).type, 'one')
  eq('12c 方程组近平行仍判无解', calc.solveSystem(1, 1, 2, 1, 1 + 1e-15, 3).type, 'none')
  // B4：两根恒按 x1<x2 升序（教材惯例）
  eq('12d x²−5x+6 两根升序', JSON.stringify([calc.solveQuad(1, -5, 6).x1, calc.solveQuad(1, -5, 6).x2]), JSON.stringify([2, 3]))
  eq('12d x²+5x+6 两根升序', JSON.stringify([calc.solveQuad(1, 5, 6).x1, calc.solveQuad(1, 5, 6).x2]), JSON.stringify([-3, -2]))
  {
    const inst = makeInst()
    inst.qa = '1'; inst.qb = '-5'; inst.qc = '6'; inst.quadSolve()
    eq('12d 二次页两根升序', JSON.stringify(inst.qLines), JSON.stringify(['判别式 Δ = 1 > 0', 'x1 = 2', 'x2 = 3']))
  }
  // B5：阶乘 ≥1e21 给约数，不再报错
  approx('12e 23! 给约数', EV('23!'), 2.585201673888498e22, 1e-12)
  approx('12e 25! 给约数', EV('25!'), 1.5511210043330986e25, 1e-12)
  eq('12e 22! 仍精确', EV('22!'), 1.1240007277776077e21)
  eq('12e 171! 仍溢出', EV('171!'), 'ERR:overflow')
  approx('12e 100! 给约数', EV('100!'), 9.33262154439441e157, 1e-12)
  // B6：超大边三角形面积（自查前已修：Heron 中间量缩放路径；只钉行为）
  approx('12f 1e100 等边面积', calc.triArea(1e100, 1e100, 1e100).area, 4.330127018922193e199, 1e-12)
  approx('12f 1e90 等边面积', calc.triArea(1e90, 1e90, 1e90).area, 4.330127018922193e179, 1e-12)
  eq('12f 3/4/5 面积仍 6', calc.triArea(3, 4, 5).area, 6)
  // B7：超大边 SSS 不再返回 NaN 解
  ok('12g 1e200 等边出解、面积 Infinity（§26 改判：旧断言把面积溢出连坐整解当预期）', (() => { const r = calc2.solveTriangle({ a: 1e200, b: 1e200, c: 1e200 }); return !r.error && Math.abs(r.solutions[0].A - 60) < 1e-9 && r.solutions[0].area === Infinity })())
  // 【1.6.0 第十七轮复审修订】原断言钉死旧半角形的具体双精度值
  // 60.00000000000001；fromSSS 改稳定差形后同角为 60.00000000000002
  // （差 1 ulp），改按容差断言——钉的是「等边给 60°」不是舍入位。
  ok('12g 1e150 等边给 60°', Math.abs(calc2.solveTriangle({ a: 1e150, b: 1e150, c: 1e150 }).solutions[0].A - 60) < 1e-9)
  // B8：负底分数指数取实根
  eq('12h (-8)^(1/3) = −2', EV('(-8)^(1/3)'), -2)
  eq('12h (-27)^(1/3) = −3', EV('(-27)^(1/3)'), -3)
  approx('12h (-8)^(2/3) = 4', EV('(-8)^(2/3)'), 4, 1e-12)
  eq('12h (-8)^(1/2) 仍定义域错', EV('(-8)^(1/2)'), 'ERR:domain')
  // B9：% 不绑进指数
  eq('12i 10^2% = 1', EV('10^2%'), 1)
  approx('12i 2^50% = 2^50/100', EV('2^50%'), 1.125899906842624e13, 1e-12)
  eq('12i 200+10% 不变', EV('200+10%'), 220)
  eq('12i 200−10% 不变', EV('200-10%'), 180)
  eq('12i 50%+50% 不变', EV('50%+50%'), 0.75)
  // B10：溢出返回 Infinity、页面显示「溢出」为既定口径（L1 钉死 1e999999999
  // → Infinity；1.5.18 7d/7e 钉死 FD(E('10^309'))='溢出'），不改抛错；
  // 只修 0^-1：它是 1/0 的另一种写法，应抛 div0、页面显示「不能 ÷ 0」。
  eq('12j 0^-1 抛 div0', EV('0^-1'), 'ERR:div0')
  eq('12j 10^400 返回 Infinity', EV('10^400'), Infinity)
  eq('12j 1e400 返回 Infinity', EV('1e400'), Infinity)
  eq('12j 1e999999999 返回 Infinity', EV('1e999999999'), Infinity)
  eq('12j 1e308×10 返回 Infinity', EV('1e308×10'), Infinity)
  eq('12j Infinity 显示「溢出」', FD(Infinity), '溢出')
  {
    const i = makeInst()
    i.expr = '0^-1'; i.refreshCalc()
    eq('12j 页面 0^-1 显示「不能 ÷ 0」', i.resDisp, '不能 ÷ 0')
    ok('12j 页面 0^-1 previewOk=false', i.previewOk === false)
    i.expr = '10^400'; i.refreshCalc()
    eq('12j 页面 10^400 显示「溢出」', i.resDisp, '溢出')
  }
  // B11：排列组合/数列溢出返回 error，不再给 Infinity
  // 【1.6.0 第十六轮复审修订】A 溢出不再连坐 C：permComb(200,200) 现返回
  // ok（C = 1、aOf = true），旧「整单报错」断言就地翻转（详见 §15b）。
  ok('12k A(200,200) A 溢出不连坐 C=1', calc2.permComb(200, 200).type === 'ok' && calc2.permComb(200, 200).C === 1 && calc2.permComb(200, 200).aOf === true)
  eq('12k A(170,170) 正常', calc2.permComb(170, 170).type, 'ok')
  ok('12k 等比 400 项真溢出改逐行返回（§25 契约：不再整体报错）', calc2.seqSolve('gp', 1, 10, 400).type === 'ok' && calc2.seqSolve('gp', 1, 10, 400).an === Infinity && calc2.seqSolve('gp', 1, 10, 400).Sn === Infinity)
  eq('12k A(5,2)=20/C(5,2)=10 不变', JSON.stringify([calc2.permComb(5, 2).A, calc2.permComb(5, 2).C]), JSON.stringify([20, 10]))
  // B12：引擎层不支持隐含乘法是已知限制，不改——全部用户输入路径都自动补 ×
  // （主键盘 appendTok、方程键盘 eqin、系数 coeffSrc），无用户可达路径。
  eq('12l 引擎 2π 仍报错（已知限制）', EV('2π'), 'ERR:trailing')
  eq('12l 引擎 2(3) 仍报错（已知限制）', EV('2(3)'), 'ERR:trailing')
  // B13：sqrt 单词
  eq('12m sqrt(4) = 2', EV('sqrt(4)'), 2)
  // B14：进制转换支持负数
  eq('12n -101 二进制转十进制', calc.baseConvert('-101', 2).dec, '-5')
  eq('12n -101 二进制转八进制', calc.baseConvert('-101', 2).oct, '-5')
  eq('12n 101 二进制不变', calc.baseConvert('101', 2).dec, '5')
  // B15：cleanNum 不再改写 15 位内精确值
  eq('12o 1234567890123.5 显示完整', FD(1234567890123.5), '1,234,567,890,123.5')
  eq('12o 9999999999999.5 显示完整', FD(9999999999999.5), '9,999,999,999,999.5')
  eq('12o 1/3 仍截 12 位', FD(1 / 3), '0.333333333333')
  // B16：非法温度 id 返回 NaN
  ok('12p 非法 fromId 返回 NaN', Number.isNaN(calc.convertUnit(3, 'x', 'c', 100)))
  ok('12p 非法 toId 返回 NaN', Number.isNaN(calc.convertUnit(3, 'c', 'x', 100)))
  eq('12p 100°C→°F 不变', calc.convertUnit(3, 'c', 'f', 100), 212)
  // E1：主页结果行 8 位数截断（模拟器实测：12345678 只显示「= 12,345,」，678 被截）
  // 根因 fitResPx 的 50px 档给了 12 字符；50px 下每字符约 25~26px，12 字约 304px 超过可用宽。
  {
    const i = makeInst()
    i.expr = '12345678'; i.refreshCalc()
    eq('12s 8 位数结果完整', i.resDisp, '= 12,345,678')
    eq('12s 8 位数结果降到 38px', i.resPx, 38)
    i.expr = '1234567'; i.refreshCalc()
    eq('12s 7 位数结果完整', i.resDisp, '= 1,234,567')
    eq('12s 7 位数结果仍 50px', i.resPx, 50)
    i.expr = '123456'; i.refreshCalc()
    eq('12s 6 位数结果完整', i.resDisp, '= 123,456')
    eq('12s 6 位数结果仍 50px', i.resPx, 50)
    i.expr = '123456789012'; i.refreshCalc()
    eq('12s 12 位数结果完整', i.resDisp, '= 123,456,789,012')
    eq('12s 12 位数结果 30px', i.resPx, 30)
  }
  if (buglog !== null) { ok('12r BUGLOG 含自查节', buglog.indexOf('发布前全量自查') >= 0) } else { skip++ }
}

// ---------- §13 C/D 轮自查修复（2026-11-15；接 §12 的 B 轮之后，两路只读审计
// C 输入层 7 条、D 输出显示 11 条，我用探针逐项复跑全部属实后修；修复验证探针
// tests/cd-verify.mjs 69 条全过。另纠正 D 报告一处：F7 的第二个例子
// 1e-16×1.2345678901234567 与 sin 尾巴无法区分（相对误差同为 2.x e-12 量级），
// 按 1.4.17 定版仍归零、不救；修的是商 1e-15÷8.1（见 13n 注记）。
// F4 的 9999999999999.5：toPrecision(13) 是进位到 1e13 而非截断，
// 「9,999,999,999,999」不可达，定案留精确串（见 13k 注记）。 ----------
{
  // C1：小数点后按 π/e/函数键自动补 ×（2.π 不再卡死局）
  {
    const i = makeInst()
    i.pressKey('2'); i.pressKey('.'); i.pressKey('π')
    eq('13a 2.π → 2.×π', i.expr, '2.×π')
    eq('13a 2.×π 可算', i.resDisp, '≈ 6.28318530718')
    const j = makeInst()
    j.pressKey('2'); j.pressKey('.'); j.pressKey('sin(')
    eq('13a 2.sin( → 2.×sin(', j.expr, '2.×sin(')
    const k = makeInst()
    k.pressKey('2'); k.pressKey('.'); k.pressKey('√(')
    eq('13a 2.√( → 2.×√(', k.expr, '2.×√(')
    const e = makeInst()
    e.eqFocus = 1; e.eqPad('2'); e.eqPad('.'); e.eqPad('π')
    eq('13a 方程页 2.π → 2.×π', e.eqExpr, '2.×π')
    const e2 = makeInst()
    e2.eqFocus = 1; e2.eqPad('2'); e2.eqPad('.'); e2.eqPad('(')
    eq('13a 方程页 2.( → 2.×(', e2.eqExpr, '2.×(')
  }
  // C2：方程页 . 在 %/° 后补 ×0.，与主键盘一致
  {
    const e = makeInst()
    e.eqFocus = 1
    for (const v of ['5', '0', '%', '.', '5']) e.eqPad(v)
    eq('13b 方程页 50%.5 → 50%×0.5', e.eqExpr, '50%×0.5')
    const e2 = makeInst()
    e2.eqFocus = 1
    for (const v of ['9', '0', '°', '.']) e2.eqPad(v)
    eq('13b 方程页 90°. → 90°×0.', e2.eqExpr, '90°×0.')
  }
  // C3：方程页 % 可连按，与主键盘一致
  {
    const e = makeInst()
    e.eqFocus = 1
    for (const v of ['5', '0', '%', '%']) e.eqPad(v)
    eq('13c 方程页 50%%', e.eqExpr, '50%%')
  }
  // C4：各键盘长度上限按追加后总长查
  {
    const L20 = '12345678901234567890'
    eq('13d editCoeff 20 字 + . 拦', F.editCoeff(L20, '.'), L20)
    eq('13d editCoeff 20 字 + / 拦', F.editCoeff(L20, '/'), L20)
    eq('13d editCoeff 20 字 + ± 拦', F.editCoeff(L20, 'neg'), L20)
    eq('13d editCoeff 20 字 − ± 解', F.editCoeff('-' + L20.slice(0, 19), 'neg'), L20.slice(0, 19))
    eq('13d editCoeff 19 字 + √ 拦（一次加 2 字）', F.editCoeff('1234567890123456789', 'sqrt'), '1234567890123456789')
    eq('13d editCoeff 18 字 + √ 放', F.editCoeff('123456789012345678', 'sqrt'), '123456789012345678√(')
    const i = makeInst()
    i.ga = '12345678'; i.gField = 'a'; i.gcdPad('00')
    eq('13d 公约数格 8 位 + 00 拦', i.ga, '12345678')
    i.ga = '1234567'; i.gcdPad('00')
    eq('13d 公约数格 7 位 + 00 放', i.ga, '123456700')
    const u = makeInst()
    u.unitVal = '123456789012'; u.unitPad('.')
    eq('13d 单位格 12 字 + . 拦', u.unitVal, '123456789012')
    u.unitVal = '12345678901'; u.unitPad('00')
    eq('13d 单位格 11 字 + 00 拦', u.unitVal, '12345678901')
  }
  // C5：主键盘 60 字上限，Ans 与 ± 也拦不住（解包变短不拦，C 仍可用）
  {
    const i = makeInst()
    i.expr = '1'.repeat(60); i.lastAns = '7'; i.ansFull = '7'; i.pressKey('ans')
    eq('13e 60 字 + Ans 拦', i.expr, '1'.repeat(60))
    const j = makeInst()
    j.expr = '1'.repeat(60); j.pressKey('neg')
    eq('13e 60 字 + ± 拦', j.expr, '1'.repeat(60))
    const k = makeInst()
    k.expr = '−(' + '1'.repeat(58) + ')'; k.pressKey('neg')
    eq('13e 60 字包裹 + ± 解包放', k.expr, '1'.repeat(58))
    const m = makeInst()
    m.expr = '1'.repeat(60); m.pressKey('C')
    eq('13e 60 字 + C 仍可用', m.expr, '')
  }
  // C6：° 连按不追加（90°° 不再默默算两次角度换算）；²² 与 %% 口径不动
  {
    const i = makeInst()
    i.pressKey('9'); i.pressKey('0'); i.pressKey('°'); i.pressKey('°')
    eq('13f 90°° 只留一个 °', i.expr, '90°')
    const j = makeInst()
    j.pressKey('2'); j.pressKey('²'); j.pressKey('²')
    eq('13f 2²² 不动', j.expr, '2²²')
    const k = makeInst()
    k.pressKey('5'); k.pressKey('0'); k.pressKey('%'); k.pressKey('%')
    eq('13f 50%% 不动', k.expr, '50%%')
  }
  // C7：解锁成功直达被拦的目标；无目标时停在解锁页；输错可重试、目标保留
  {
    const defK = loadPage(true)
    const mkK = () => {
      const inst = {}
      Object.assign(inst, JSON.parse(JSON.stringify(defK.data)))
      for (const k of Object.keys(defK)) if (typeof defK[k] === 'function') inst[k] = defK[k].bind(inst)
      inst.onInit()
      return inst
    }
    const i = mkK()
    i.unlocked = false; i.deviceId = '0123456789abcdeffedcba9876543210'
    i.openSolver('quad')
    eq('13g 未解锁点解方程进解锁页', i.view, 'unlock')
    eq('13g gatePaid 记下目标', i.unlockTarget, 'solver:quad')
    i.keyInput = '1234567890'; i.confirmUnlock()
    eq('13g 解锁后直达 quad', i.view, 'quad')
    const j = mkK()
    j.unlocked = false; j.deviceId = '0123456789abcdeffedcba9876543210'
    j.goTools()
    j.keyInput = '1234567890'; j.confirmUnlock()
    eq('13g 解锁后直达 tools', j.view, 'tools')
    const m = mkK()
    m.unlocked = false; m.deviceId = '0123456789abcdeffedcba9876543210'
    m.goUnlock()
    eq('13g 手动进解锁页无目标', m.unlockTarget, null)
    m.keyInput = '1234567890'; m.confirmUnlock()
    eq('13g 无目标解锁停在解锁页', m.view, 'unlock')
    const n = makeInst()
    n.unlocked = false; n.deviceId = '0123456789abcdeffedcba9876543210'
    n.openSolver('sys')
    n.keyInput = '0000000000'; n.confirmUnlock()
    eq('13g 输错密钥仍在解锁页', n.view, 'unlock')
    eq('13g 输错后目标保留可重试', n.unlockTarget, 'solver:sys')
  }
  // F1：绘图交点行按 x1<x2 升序，与二次方程页一致
  {
    const i = makeInst()
    i.qa = '1'; i.qb = '0'; i.qc = '-2'; i.openPlot('quad')
    ok('13h 图象交点行升序', i.plotLines.join('|').indexOf('与 x 轴交点 x = −√2、√2 ≈ 1.41') >= 0)
  }
  // F2：系数不精确时根式本身带 ≈，两根都没有小数就回落纯小数行；
  // 精确系数的裸根式行（1.5.4 钉死）不受影响。
  {
    const i = makeInst()
    i.qa = '0.3333333333'; i.qb = '0'; i.qc = '-2'; i.openPlot('quad')
    ok('13i 不精确系数交点行回落纯小数', i.plotLines.join('|').indexOf('与 x 轴交点 x = −2.4495、2.4495') >= 0)
    ok('13i 不精确系数行无裸 ≈√6', i.plotLines.join('|').indexOf('≈√6') < 0)
  }
  // F3：精确分数在大数时不再误标 ≈（fracIsExact 先做精确双精度比较）
  eq('13j fracIsExact(1234567890123.5 → 2469135780247/2)', calc.fracIsExact(1234567890123.5, calc.toFraction(1234567890123.5)), true)
  eq('13j fracIsExact(0.3333333334 → 1/3) 仍 false（1.5.12 钉死）', calc.fracIsExact(0.3333333334, calc.toFraction(0.3333333334)), false)
  {
    const i = makeInst()
    i.expr = '1234567890123.5'; i.refreshCalc()
    i.fracOn = true; i.refreshCalc()
    eq('13j 大数分数用 =', i.resDisp, '= 2469135780247/2')
  }
  // F4：fitResStr 降 p 不再缩短就停，保住最精确形。
  // 注记：9999999999999.5 的 toPrecision(13) 是进位到 1e13 而非截断，
  // 「9,999,999,999,999」不可达；进位形只比精确串短 1 字且看着像整数，
  // 定案留精确串（= 号诚实）。
  {
    const i = makeInst()
    i.expr = '1234567890123.5'; i.refreshCalc()
    eq('13k 大数主行 13 位近似', i.resDisp, '≈ 1,234,567,890,124')
    const j = makeInst()
    j.expr = '9999999999999.5'; j.refreshCalc()
    eq('13k 大数 2 主行留精确串', j.resDisp, '= 9,999,999,999,999.5')
    const k = makeInst()
    k.expr = '1÷3'; k.refreshCalc()
    eq('13k 1/3 仍 9 位小数', k.resDisp, '≈ 0.333333333')
  }
  // F5：tools2 分数与小数之间的连接号按是否精确选 = / ≈
  {
    const s = makeInst2()
    s.sqa = '1'; s.sqx = '1/2'; s.sqn = '10'; s.sqKind = 'gp'; s.sqSolve()
    eq('13l 数列等比行用 =', JSON.stringify(s.sqLines), JSON.stringify(['第 10 项 = 1/512 = 0.001953125', '前 10 项和 = 1023/512 = 1.998046875']))
    const r = makeInst2()
    r.rta = ''; r.rtb = ''; r.rtc = '5'; r.rtA = '30'; r.rtB = ''; r.rtSolve()
    ok('13l 直角三角形 a = 5/2 = 2.5', r.rtLines.join('|').indexOf('a = 5/2 = 2.5') >= 0)
  }
  // F6：tools2 大整数不再漏原始 e 记法，≥1e21 走 12 位课本式 ×10 上标
  {
    const s = makeInst2()
    s.sqa = '1'; s.sqx = '3'; s.sqn = '100'; s.sqKind = 'gp'; s.sqSolve()
    eq('13m 等比 100 项无 e 记法', JSON.stringify(s.sqLines), JSON.stringify(['第 100 项 = 1.71792506911×10⁴⁷', '前 100 项和 = 2.57688760366×10⁴⁷']))
    const l = makeInst2()
    l.lwa = '1e100'; l.lwb = '1e100'; l.lwc = '1e100'; l.lwSolve()
    ok('13m SSS 1e100 面积无 e 记法', l.lwLines.join('|').indexOf('面积 = 4.33012701892×10¹⁹⁹') >= 0)
  }
  // F7：极小真商不再显示「≈ 0」——isTinyQuotient 判别放宽到 4 ulp。
  // 注记：1e-15÷8.1 的 v×81 与 1e-14 只差约 1 ulp，可与尾巴严格区分；
  // 1e-16×1.2345678901234567 这类真积与 1e-14/81 在第 9 位就不同
  //（相对差 9e-9），与 sin 尾巴（2.2e-12）无法区分，按 1.4.17 定版仍归零。
  // cleanNum 一行不动；尾巴守卫（1.5.18 3a/3b/3c/3d、1.5.19 3d）全过。
  {
    const i = makeInst()
    i.expr = '1e-15÷8.1'; i.refreshCalc()
    eq('13n 1e-15÷8.1 显示科学计数', i.resDisp, '≈ 1.234567901×10⁻¹⁶')
    eq('13n sin(180°) 尾巴仍 0', FD(calc.evaluate('sin(180)')), '0')
    eq('13n cos(90°) 尾巴仍 0', FD(calc.evaluate('cos(90)')), '0')
    eq('13n 裸 sin(π) 尾巴仍 0', FD(Math.sin(Math.PI)), '0')
    eq('13n √2×1e-17 仍 0', FD(Math.SQRT2 * 1e-17), '0')
    eq('13n (1/3)×1e-15 仍救援', FD((1 / 3) * 1e-15), '3.33333333333×10⁻¹⁶')
    eq('13n 1e-16÷8.1 不变', FD(1e-16 / 8.1), '1.23456790123×10⁻¹⁷')
  }
  // F8：公约数页 lcm 被截断时连接号用 ≈（与主页同口径）
  {
    const i = makeInst()
    i.ga = '94000000'; i.gb = '93999999'; i.gcdSolve()
    eq('13o lcm 截断用 ≈', JSON.stringify(i.gLines), JSON.stringify(['最大公约数 = 1', '最小公倍数 ≈ 8.83599991×10¹⁵']))
    const j = makeInst()
    j.ga = '12'; j.gb = '18'; j.gcdSolve()
    eq('13o 小 lcm 仍用 =', JSON.stringify(j.gLines), JSON.stringify(['最大公约数 = 6', '最小公倍数 = 36']))
  }
  // F9：排列组合行超宽改 10 位 ×10 上标，不再被省略号截掉末尾数字
  {
    const p = makeInst2()
    p.pmn = '30'; p.pmr = '15'; p.pmSolve()
    eq('13p A(30,15) 缩短', p.pmLines[0], 'A(30,15) ≈ 2.028432049×10²⁰')
    ok('13p A 行 ≤30 字', p.pmLines[0].length <= 30)
    eq('13p C(30,15) 不动', p.pmLines[1], 'C(30,15) = 155117520')
    const q = makeInst2()
    q.pmn = '5'; q.pmr = '2'; q.pmSolve()
    eq('13p A(5,2) 不动', JSON.stringify(q.pmLines), JSON.stringify(['A(5,2) = 20', 'C(5,2) = 10']))
  }
  // F10：根号化简页小数 6 位 → 12 位，与全应用口径一致
  {
    const i = makeInst()
    i.sqrtN = '72'; i.sqrtSolve()
    eq('13q √72 12 位', JSON.stringify(i.sqrtLines), JSON.stringify(['√72 = 6√2', '≈ 8.48528137424']))
    const j = makeInst()
    j.sqrtN = '2000000'; j.sqrtSolve()
    eq('13q √2000000 12 位', JSON.stringify(j.sqrtLines), JSON.stringify(['√2000000 = 1000√2', '≈ 1,414.21356237']))
  }
  // F11：系数栏整串科学计数法按科学计数法读（1e21 → 10²¹）；
  // '2e'（2×e）、'e2'（e×2）的欧拉读法有 §1d 钉死，原样不动。
  eq('13r parseCoeff 1e21', F.parseCoeff('1e21'), 1e21)
  eq('13r parseCoeff 1.5e3', F.parseCoeff('1.5e3'), 1500)
  approx('13r parseCoeff 2e 仍 2×e', F.parseCoeff('2e'), 2 * Math.E)
  approx('13r parseCoeff e2 仍 e×2', F.parseCoeff('e2'), 2 * Math.E)
  {
    const i = makeInst()
    i.cr = '1e21'; i.circSolve()
    ok('13r 圆半径 1e21 周长走 ×10', i.cLines.join('|').indexOf('×10²¹') >= 0)
  }
  if (buglog !== null) { ok('13z BUGLOG 含 C/D 轮自查节', buglog.indexOf('C/D 轮') >= 0) } else { skip++ }
}

// §14 跨页导航闪屏修复（2026-11-15 真机反馈）：第二页四工具点开先闪一遍
// 第二页菜单、返回先闪一遍计算器主页。根因：落地视图靠 storage.get 异步
// 回调决定，首帧先渲染默认视图（tools2 的 menu / 主页的 calc）。改走路由
// 参数：参数在页面创建时同步注入、onInit 首帧即直达；存储键保留作兜底。
// 框架语义模拟：参数在 onInit 之前合并进页面实例，故下列实例先赋值再 onInit。
{
  function makeInstP(props) {
    const inst = {}
    Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
    for (const k of Object.keys(def)) if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
    Object.assign(inst, props || {})
    inst.onInit()
    return inst
  }
  function makeInst2P(props) {
    const inst = {}
    Object.assign(inst, JSON.parse(JSON.stringify(def2.data)))
    for (const k of Object.keys(def2)) if (typeof def2[k] === 'function') inst[k] = def2[k].bind(inst)
    Object.assign(inst, props || {})
    inst.onInit()
    return inst
  }
  eq('14a 回程参数 backto=tools 首帧直达工具箱', makeInstP({ backto: 'tools' }).view, 'tools')
  eq('14b 无回程参数仍默认计算器主页', makeInstP({}).view, 'calc')
  eq('14c 去程参数 tool=law 首帧直达正余弦', makeInst2P({ tool: 'law' }).view, 'law')
  eq('14d 去程参数 tool=seq 首帧直达数列', makeInst2P({ tool: 'seq' }).view, 'seq')
  eq('14e 去程参数 tool=rtri 首帧直达解直角三角形', makeInst2P({ tool: 'rtri' }).view, 'rtri')
  eq('14f 去程参数 tool=perm 首帧直达排列组合', makeInst2P({ tool: 'perm' }).view, 'perm')
  eq('14g 无去程参数仍默认第二页菜单（兜底）', makeInst2P({}).view, 'menu')
  ok('14h 回程 replace 带 backto 参数', ux2.indexOf("router.replace({ uri: '/pages/index', params: { backto: 'tools' } })") >= 0)
  ok('14i 存储兜底仍在（calc_tool_nav / calc_back_to 读写保留）', ux.indexOf("key: 'calc_back_to'") >= 0 && ux2.indexOf("key: 'calc_tool_nav'") >= 0)
  if (buglog !== null) { ok('14z BUGLOG 含导航闪屏条目', buglog.indexOf('导航闪屏') >= 0) } else { skip++ }
}

// ===== §15 第十六轮外部复审（ChatGPT，2026-11-15）逐项核实后修复 =====
// 报告 13 点：10 点属实已修（本节钉死）、1 点代码属实但真实触发路径不
// 存在（onInit 存储竞态，防御性修复，15i）、1 点系定版设计但 README
// 举例写过头（系数键盘无 + 与独立左括号，改 README 不改键盘，无断言）、
// 1 点现象属实但真值超出双精度可表示范围（等边 1e-200 面积 4.33e-401
// 小于最小次正规数，任何双精度实现都只能返回 0，不修、无断言）。
// 报告数字经独立复跑全对上：组合数扫描 17945/6729/45 与原文一字不差。
{
  // 15a parseCoeff 精度守卫（两份拷贝同测：抽取函数原文直测）
  const grabPc = function (uxText) {
    const seg = uxText.slice(uxText.indexOf('function coeffSrc'), uxText.indexOf('function parseCoeff0'))
    return new Function('calc', seg + '; return parseCoeff')(calc)
  }
  for (const [tag, pcX] of [['主页', grabPc(ux)], ['第二页', grabPc(ux2)]]) {
    ok('15a ' + tag + ' parseCoeff 超安全整数 → NaN（不静默舍入）', isNaN(pcX('9007199254740993')))
    ok('15a ' + tag + ' parseCoeff 科学计数法尾数超限 → NaN', isNaN(pcX('9007199254740993e0')))
    ok('15a ' + tag + ' parseCoeff 分子超限 → NaN', isNaN(pcX('9007199254740993/3')))
    eq('15a ' + tag + ' parseCoeff 1e20（精确可表示）照常', pcX('100000000000000000000'), 1e20)
    eq('15a ' + tag + ' parseCoeff 15 位整数照常', pcX('123456789012345'), 123456789012345)
    eq('15a ' + tag + ' parseCoeff 1/3 不变', pcX('1/3'), 1 / 3)
    approx('15a ' + tag + ' parseCoeff 2√3 不变', pcX('2√3'), 3.4641016151377544, 1e-12)
  }
  // 15b permComb：四个错值点 + 全扫描（n≤150，BigInt 真值；此范围 A 不溢出）
  eq('15b C(56,27) 精确值', calc2.permComb(56, 27).C, 7384942649010080)
  ok('15b C(56,27) cExact', calc2.permComb(56, 27).cExact === true)
  eq('15b C(56,31) 精确值', calc2.permComb(56, 31).C, 5574440580220512)
  eq('15b C(58,23) 精确值', calc2.permComb(58, 23).C, 8799226775309880)
  eq('15b C(59,22) 精确值', calc2.permComb(59, 22).C, 8964377427999630)
  {
    let bad = 0, tot = 0
    const bigC = function (n, r) { const q = Math.min(r, n - r); let c = BigInt(1); for (let i = 1; i <= q; i++) c = c * BigInt(n - q + i) / BigInt(i); return c }
    for (let n = 0; n <= 150; n++) for (let r = 0; r <= n; r++) {
      const t = bigC(n, r)
      if (t > BigInt(9007199254740991)) continue
      tot++
      const res = calc2.permComb(n, r)
      if (res.error || !Number.isInteger(res.C) || BigInt(res.C) !== t || !res.cExact) bad++
    }
    ok('15b 组合数扫描 n≤150：' + tot + ' 组可精确表示、零错误零错标', bad === 0 && tot > 1000)
  }
  ok('15b C(180,171) A 溢出仍给 C', calc2.permComb(180, 171).type === 'ok' && calc2.permComb(180, 171).aOf === true && calc2.permComb(180, 171).C === 446098010817800)
  // 15c solveRightTri 尺度归一化
  approx('15c 直角 1e-200/1e-200 → c = √2×10⁻²⁰⁰', calc2.solveRightTri({ a: 1e-200, b: 1e-200, c: null, A: null, B: null }).c, 1.4142135623730951e-200, 1e-12)
  eq('15c 直角 (3,4,1e200) 拒假勾股', calc2.solveRightTri({ a: 3, b: 4, c: 1e200, A: null, B: null }).error, '三边不符合勾股定理')
  eq('15c 直角 (1e200,1e200,1e200) 拒假勾股', calc2.solveRightTri({ a: 1e200, b: 1e200, c: 1e200, A: null, B: null }).error, '三边不符合勾股定理')
  approx('15c 直角 1e200/1e200 → c 有限', calc2.solveRightTri({ a: 1e200, b: 1e200, c: null, A: null, B: null }).c, 1.4142135623730951e200, 1e-12)
  ok('15c 直角 5/12/13 对照不变', calc2.solveRightTri({ a: 5, b: 12, c: null, A: null, B: null }).c === 13)
  approx('15c 直角已知斜边反求 (13,5) → 12', calc2.solveRightTri({ a: 5, b: null, c: 13, A: null, B: null }).b, 12, 1e-12)
  // 15d solveTriangle 近退化稳定形
  const sas1 = calc2.solveTriangle({ a: 1, b: 1, c: null, A: null, B: null, C: 0.000001 })
  approx('15d SAS C=1e-6° 第三边', sas1.solutions && sas1.solutions[0].c, 1.7453292519943295e-8, 1e-9)
  const sas2 = calc2.solveTriangle({ a: 1, b: 1, c: null, A: null, B: null, C: 0.0000001 })
  approx('15d SAS C=1e-7° 不再误拒、第三边对', sas2.solutions && sas2.solutions[0].c, 1.7453292519943295e-9, 1e-9)
  const sss1 = calc2.solveTriangle({ a: 1, b: 1, c: 1e-8, A: null, B: null, C: null })
  approx('15d SSS (1,1,1e-8) 小角保住', sss1.solutions && sss1.solutions[0].C, 5.729577916486889e-7, 1e-6)
  approx('15d SSS (1,1,1e-8) 面积', sss1.solutions && sss1.solutions[0].area, 5e-9, 1e-6)
  ok('15d SSS 3/4/5 面积对照不变', Math.abs(calc2.solveTriangle({ a: 3, b: 4, c: 5, A: null, B: null, C: null }).solutions[0].area - 6) < 1e-9)
  // 15e seqSolve 等比求和相消
  approx('15e 等比 q=1+1e-12 n=9999 和', calc2.seqSolve('gp', 1, 1.000000000001, 9999).Sn, 9999.000049989445, 1e-9)
  ok('15e 等比 1,2,10 对照不变', calc2.seqSolve('gp', 1, 2, 10).Sn === 1023)
  approx('15e 等比 q=√2 n=3 和', calc2.seqSolve('gp', 1, Math.SQRT2, 3).Sn, 4.414213562373095, 1e-12)
  // 15f fmtVal / fmtSide 精确性（第二页加载器变体，导出直测）
  const loadPage2X = function () {
    let script = ux2.slice(ux2.indexOf('<script>') + 8, ux2.indexOf('</script>'))
    globalThis.__storage = { get(o) { o.success('') }, set() {} }
    globalThis.__calc2 = calc2
    script = script
      .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
      .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
      .replace("import device from '@system.device'", 'const device = globalThis.__device')
      .replace("import router from '@system.router'", 'const router = globalThis.__router')
      .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
      .replace("import calc2 from '../../common/calc2'", 'const calc2 = globalThis.__calc2')
      .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
      .replace('export default', 'module.exports =')
    script += '\nmodule.exports.__x = { fmtVal: fmtVal, fmtSide: fmtSide }'
    const mod = { exports: {} }
    new Function('module', 'exports', script)(mod, mod.exports)
    return mod.exports
  }
  const dx = loadPage2X()
  ok('15f fmtVal(2.00000000001) 不冒充整数', dx.__x.fmtVal(2.00000000001).exact === false && dx.__x.fmtVal(2.00000000001).t === '2.00000000001')
  ok('15f fmtVal(3.000000000015) 不冒充整数', dx.__x.fmtVal(3.000000000015).exact === false)
  ok('15f fmtVal(4.414213562373095) 标近似', dx.__x.fmtVal(4.414213562373095).exact === false)
  ok('15f fmtVal(1023) 仍精确', dx.__x.fmtVal(1023).exact === true && dx.__x.fmtVal(1023).t === '1023')
  ok('15f fmtSide(近似 √2) 不冒充根式', dx.__x.fmtSide(1.4142135623872373).exact === false)
  ok('15f fmtSide(√2) 根式保留', dx.__x.fmtSide(Math.SQRT2).exact === true && dx.__x.fmtSide(Math.SQRT2).t.indexOf('√2') === 0)
  // 数列页整机：近似和带 ≈、精确和带 =
  const sq1 = makeInst2(); sq1.sqKind = 'gp'; sq1.sqa = '1'; sq1.sqx = '1.4142135623730951'; sq1.sqn = '3'; sq1.sqSolve()
  eq('15f 数列页 q=√2 前 3 项和带 ≈', sq1.sqLines[1], '前 3 项和 ≈ 4.41421356237')
  const sq2 = makeInst2(); sq2.sqKind = 'ap'; sq2.sqa = '1'; sq2.sqx = '1.00000000001'; sq2.sqn = '2'; sq2.sqSolve()
  eq('15f 数列页等差近似项带 ≈', sq2.sqLines[0], '第 2 项 ≈ 2.00000000001')
  const sq3 = makeInst2(); sq3.sqKind = 'gp'; sq3.sqa = '1'; sq3.sqx = '2'; sq3.sqn = '10'; sq3.sqSolve()
  eq('15f 数列页精确和仍带 =', sq3.sqLines[1], '前 10 项和 = 1023')
  // 排列组合页整机：A 溢出行与 C 行分开
  const pm1 = makeInst2(); pm1.pmn = '200'; pm1.pmr = '200'; pm1.pmSolve()
  ok('15f 排列组合页 A 溢出只标 A 行、C=1 照常', pm1.pmLines[0].indexOf('A(200,200) 太大了') === 0 && pm1.pmLines[1] === 'C(200,200) = 1')
  // 15g 圆工具分开判（主页整机）
  const ci1 = makeInst(); ci1.cr = '1e200'; ci1.circSolve()
  ok('15g 圆 r=1e200 周长照常、面积单独标超范围', ci1.cLines[0].indexOf('周长 ≈ ') === 0 && ci1.cLines[1] === '面积太大了，超出精确计算范围')
  const ci2 = makeInst(); ci2.cr = '1e-200'; ci2.circSolve()
  eq('15g 圆 r=1e-200 面积下溢给课本式', ci2.cLines[1], '面积 ≈ 3.14159265359×10⁻⁴⁰⁰')
  const ci3 = makeInst(); ci3.cr = '2'; ci3.circSolve()
  eq('15g 圆 r=2 对照不变', ci3.cLines[0], '周长 = 4π')
  // 15h Δ 真值串与绘图交点（主页整机）
  const q1 = makeInst(); q1.qa = '1e200'; q1.qb = '0'; q1.qc = '-1e200'; q1.quadSolve()
  eq('15h 方程页 Δ 显示真值量级', q1.qLines[0], '判别式 Δ ≈ 4×10⁴⁰⁰ > 0')
  q1.openPlot('quad')
  eq('15h 绘图交点走稳定路径', q1.plotLines[2], '与 x 轴交点 x = −1、1')
  const q2 = calc.solveQuad(1e200, 0, -1e200)
  ok('15h solveQuad 给 discStr、根不变', q2.discStr === '4×10⁴⁰⁰' && q2.x1 === -1 && q2.x2 === 1)
  ok('15h solveQuad 普通输入 discStr 为空', calc.solveQuad(2, -7, 3).discStr === null && calc.solveQuad(2, -7, 3).disc === 25)
  // 15i onInit 存储竞态守卫（参数有效时跳过存储读；无参数时兜底仍工作）
  const loadPage2S = function (stored) {
    let script = ux2.slice(ux2.indexOf('<script>') + 8, ux2.indexOf('</script>'))
    globalThis.__storage = { get(o) { o.success(stored) }, set() {} }
    globalThis.__calc2 = calc2
    script = script
      .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
      .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
      .replace("import device from '@system.device'", 'const device = globalThis.__device')
      .replace("import router from '@system.router'", 'const router = globalThis.__router')
      .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
      .replace("import calc2 from '../../common/calc2'", 'const calc2 = globalThis.__calc2')
      .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
      .replace('export default', 'module.exports =')
    const mod = { exports: {} }
    new Function('module', 'exports', script)(mod, mod.exports)
    return mod.exports
  }
  const make2S = function (defS, props) {
    const inst = {}
    Object.assign(inst, JSON.parse(JSON.stringify(defS.data)))
    for (const k of Object.keys(defS)) if (typeof defS[k] === 'function') inst[k] = defS[k].bind(inst)
    Object.assign(inst, props || {})
    inst.onInit()
    return inst
  }
  eq('15i 参数 perm＋存储残留 seq → 仍 perm', make2S(loadPage2S('seq'), { tool: 'perm' }).view, 'perm')
  eq('15i 无参数＋存储 seq → 兜底到 seq', make2S(loadPage2S('seq'), {}).view, 'seq')
  if (buglog !== null) { ok('15z BUGLOG 含第十六轮条目', buglog.indexOf('第十六轮') >= 0) } else { skip++ }
}


// ===== §16 系数键盘扩键（2026-11-15，用户拍板按第十六轮复审建议） =====
// 补 +、−、×、( 四键（24 键、5 行、末行 » 加宽占两格）：和式/差式系数
// 如 (1+√5)/2 可直接输入。引擎零改动——coeffSrc 的自动补括号与 evaluate
// 本就能算这类式子，缺的只是键盘入口。§8a 的 20 键/无左括号断言已翻转。
{
  const grabEc = function (uxText) {
    const i = uxText.indexOf('function editCoeff')
    const j = uxText.indexOf('\n}\n', i)
    return new Function(uxText.slice(i, j + 3) + '; return editCoeff')()
  }
  const ecCases = [['', '+', ''], ['3', '+', '3+'], ['3+', '−', '3-'], ['3-', '+', '3+'], ['(', '−', '(-'], ['(-', '+', '(-'], ['2', '(', '2×('], ['', '(', '('], ['3/', '×', '3/'], ['3+', '×', '3×'], ['2', '×', '2×'], ['3', '−', '3-'], ['', '−', '-'], ['√(', '−', '√(-'], ['3×', '(', '3×(']]
  for (const [tag, uxText] of [['主页', ux], ['第二页', ux2]]) {
    const ec = grabEc(uxText)
    for (const [cur, v, want] of ecCases) eq('16a ' + tag + ' editCoeff(' + JSON.stringify(cur) + ', ' + v + ')', ec(cur, v), want)
  }
  const grabPc = function (uxText) {
    const seg = uxText.slice(uxText.indexOf('function coeffSrc'), uxText.indexOf('function parseCoeff0'))
    return new Function('calc', seg + '; return parseCoeff')(calc)
  }
  for (const [tag, uxText] of [['主页', ux], ['第二页', ux2]]) {
    const pc = grabPc(uxText)
    ok('16b ' + tag + ' (1+√5)/2 全闭合形', Math.abs(pc('(1+√(5))/2') - (1 + Math.sqrt(5)) / 2) < 1e-12)
    ok('16b ' + tag + ' (1+√5 外层未闭合自动补', Math.abs(pc('(1+√(5)') - (1 + Math.sqrt(5))) < 1e-12)
    ok('16b ' + tag + ' 2×(1+√3)', Math.abs(pc('2×(1+√(3))') - 2 * (1 + Math.sqrt(3))) < 1e-12)
    ok('16b ' + tag + ' (2-√3)(2+√3) 隐含乘法', Math.abs(pc('(2-√(3))×(2+√(3))') - 1) < 1e-12)
    ok('16b ' + tag + ' ((1+2)×3)/4 嵌套', pc('((1+2)×3)/4') === 2.25)
  }
  const inst = makeInst()
  inst.qa = '(1+√(5))/2'; inst.qb = '0'; inst.qc = '-1'; inst.quadSolve()
  ok('16c 二次方程 a=(1+√5)/2、c=-1 出两根 ±0.7861513777', inst.qLines.join(' ').indexOf('0.7861513777') >= 0)
  const inst2 = makeInst2()
  eq('16d 第二页系数键盘 24 键', inst2.quadKeys.length, 24)
  ok('16d 第二页系数键盘含 ( 与 +', inst2.quadKeys.some((k) => k.v === '(') && inst2.quadKeys.some((k) => k.v === '+'))
  ok('16e 主页 CSS 含 key-c5w 122px 且 6 处键盘绑 kcls', ux.indexOf('.key-c5w { width: 122px; }') >= 0 && (ux.match(/kcls \? \$item\.kcls/g) || []).length >= 6)
  ok('16e 第二页 CSS 含 key-c5w 122px 且 4 处键盘绑 kcls', ux2.indexOf('.key-c5w { width: 122px; }') >= 0 && (ux2.match(/kcls \? \$item\.kcls/g) || []).length >= 4)
  if (buglog !== null) { ok('16z BUGLOG 含扩键条目', buglog.indexOf('扩键') >= 0) } else { skip++ }
}


// ===== §17 第十七轮外部复审（ChatGPT，2026-11-15） =====
// 复审确认第十六轮修复与扩键全部独立通过；新发现 SSS 极小边误判退化：
// (1,1,1e-16) 数学上非退化，却因浮点 1+1e-16===1 与 sidesDegenerateExact
// 的安全整数上限被判「退化」。修法：判定改十进制 BigInt 精确比较
// （sidesSumCmp，无位数上限）；fromSSS 的 hs−n[i] 改稳定差形（先大边减、
// 再加小边）＋根号分开乘——极小角不再全算成 0，针形三角形一路算到
// 1e-308。连带披露：(0.30000000000000004, 0.1, 0.2) 按十进制语义是
// 0.3 < 0.30000000000000004，判「不能构成三角形」（旧浮点口径判退化）。
{
  const T = function (a, b, c) { return calc2.solveTriangle({ a: a, b: b, c: c, A: null, B: null, C: null }) }
  for (const e of [1e-14, 1e-15, 1e-16]) {
    const r = T(1, 1, e)
    ok('17a (1,1,' + e + ') 非退化被接受', !!r.solutions)
    if (r.solutions) {
      const s0 = r.solutions[0]
      ok('17a (1,1,' + e + ') 两底角 ≈90°、小角 ≈ ε·180/π、角和 180', Math.abs(s0.A - 90) < 1e-6 && Math.abs(s0.C - e * 57.29577951308232) / (e * 57.29577951308232) < 1e-6 && Math.abs(s0.A + s0.B + s0.C - 180) < 1e-9)
      ok('17a (1,1,' + e + ') 面积 ≈ ε/2', Math.abs(s0.area - e / 2) / (e / 2) < 1e-6)
    }
  }
  for (const e of [1e-100, 1e-300]) {
    const r = T(1, 1, e)
    ok('17b (1,1,' + e + ') 深针形仍可算（A=90）', !!r.solutions && Math.abs(r.solutions[0].A - 90) < 1e-9)
  }
  eq('17c (1,1,2) 真退化仍拒绝', T(1, 1, 2).error, '三边退化成一条直线')
  eq('17c (1,2,3) 真退化仍拒绝', T(1, 2, 3).error, '三边退化成一条直线')
  eq('17c (0.1,0.2,0.3) 十进制退化仍拒绝', T(0.1, 0.2, 0.3).error, '三边退化成一条直线')
  eq('17c (1,1,0) 零边拒绝', T(1, 1, 0).error, '边长要大于 0')
  eq('17c (2,3,10) 不等式拒绝', T(2, 3, 10).error, '三边不能构成三角形')
  eq('17d (0.30000000000000004,0.1,0.2) 十进制语义判不能构成', T(0.30000000000000004, 0.1, 0.2).error, '三边不能构成三角形')
  ok('17d (5,5,9.999999999999998) 近退化但有效', !!T(5, 5, 9.999999999999998).solutions)
  const s345 = T(3, 4, 5).solutions[0]
  ok('17e (3,4,5) 角度面积不变', Math.abs(s345.A - 36.86989764584402) < 1e-12 && Math.abs(s345.C - 90) < 1e-12 && s345.area === 6)
  const s789 = T(7, 8, 9).solutions[0]
  ok('17e (7,8,9) 面积不变', Math.abs(s789.area - 26.832815729997478) < 1e-12)
  if (buglog !== null) { ok('17z BUGLOG 含第十七轮条目', buglog.indexOf('第十七轮') >= 0) } else { skip++ }
}

// ===== §18 第十八轮外部复审（ChatGPT，2026-11-15） =====
// 复审对整个仓库重查（不只查 §17 新增），报 6 组问题＋1 项功能完整性；
// 逐项实跑核实：A–F 全部属实、已修；G（仓库无方差/标准差）属实但从来
// 没做过这个功能、非缺陷，不在本轮范围。
// A triArea 自带判定与第二页口径不一致：缩放超安全整数时退回浮点——
// (1,1,1e-16) 误判退化、(0.30000000000000004,0.1,0.2) 误判退化、
// (1e308,1e308,1e-308) 误判退化且 z/x 下溢、面积算不出。修法：判定改
// 走十进制串精确比较 triSumCmp（与 sidesSumCmp 同口径，S 只留给精确
// 形）；归一化面积为 0 时改对数域（Kahan 四因子取对数）兜底。
// B parseCoeff 科学计数法门只看尾数位数：1.23456789012345e17 尾数恰
// 15 位绕过、evaluate 却抛 precision。修法：与 intDigitsOf 完全同口径
// （展开整数位串、≥16 位逐字比对、真分数不设门、>21 位近似区不设门），
// 两页 parseCoeff 同步改、18b 守卫逐字一致。
// C 数列中间溢出：AP 先乘后除（n·(a1+an) 先溢出）、GP 的 pow 与 Σ 先
// 溢出。修法：AP 先均值后乘 n（a1+an 溢出用 a1/2+an/2 兜底）；GP 的
// an 直算失败改对数域、Sn 分治累加把首项折进递归（sumPowA）。
// D angSeg 把极小非零角显示成「= 0°」（fmtDeg 两位小数＋1e-9 绝对容
// 差）：<0.005° 的非零角改 formatDisplay 科学计数法显示并标 ≈。
// E 函数图象 drawPlot 二次分支仍直算 b²−4ac（a=1e200、c=−1e200 溢出
// 丢交点）：改走 solveQuad（与方程页、autoRange 口径统一），顶点 y 溢
// 出时归一化兜底。
// F sidesSumCmp 依赖 BigInt（无 BigInt 退回浮点误判）＋calc2 文件头
// 「禁 BigInt 调用」与 permComb 的守卫调用自相矛盾：sidesSumCmp 改纯
// 字符串加法/比较（行为与 BigInt 版一致、§17 断言不变）、文件头注释
// 订正为「禁字面量；构造调用仅限 typeof 守卫＋无 BigInt 兜底处」。
{
  const extractFrom = function (src, name) {
    const start = src.indexOf('function ' + name + '(')
    let depth = 0, i = src.indexOf('{', start)
    const from = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) }
    }
    throw new Error('函数未配平 ' + name)
  }
  // 18a triArea 口径与极端面积
  const ta1 = calc.triArea(1, 1, 1e-16)
  ok('18a triArea(1,1,1e-16) 非退化、面积 ≈5e-17', ta1.type === 'ok' && Math.abs(ta1.area - 5e-17) / 5e-17 < 1e-9, JSON.stringify(ta1))
  eq('18a triArea(0.30000000000000004,0.1,0.2) 与第二页同口径判不能构成', calc.triArea(0.30000000000000004, 0.1, 0.2).error, '不能构成三角形')
  const ta3 = calc.triArea(1e308, 1e308, 1e-308)
  ok('18a triArea(1e308,1e308,1e-308) 对数域面积 ≈0.5', ta3.type === 'ok' && Math.abs(ta3.area - 0.5) / 0.5 < 1e-9, JSON.stringify(ta3))
  eq('18a triArea(1,2,3) 真退化仍拒绝', calc.triArea(1, 2, 3).type, 'degenerate')
  eq('18a triArea(0.1,0.2,0.3) 十进制退化仍拒绝', calc.triArea(0.1, 0.2, 0.3).type, 'degenerate')
  eq('18a triArea(3,4,5) 精确形不变', JSON.stringify(calc.triArea(3, 4, 5).exact), JSON.stringify({ cn: 6, cd: 1, rad: 1 }))
  // 18b parseCoeff 科学计数法与 evaluate 同口径
  ok('18b parseCoeff(1.23456789012345e17) NaN（evaluate 抛 precision）', isNaN(F.parseCoeff('1.23456789012345e17')))
  ok('18b parseCoeff(-1.23456789012345e17) NaN', isNaN(F.parseCoeff('-1.23456789012345e17')))
  eq('18b parseCoeff(1.23456789012345e5) 真分数放行', F.parseCoeff('1.23456789012345e5'), 123456.789012345)
  ok('18b parseCoeff(9.007199254740993e15) 不精确 NaN', isNaN(F.parseCoeff('9.007199254740993e15')))
  eq('18b parseCoeff(9.007199254740992e15) 精确放行', F.parseCoeff('9.007199254740992e15'), 9007199254740992)
  eq('18b parseCoeff(1e21) 近似区放行', F.parseCoeff('1e21'), 1e21)
  eq('18b parseCoeff(1.5e3) 不变', F.parseCoeff('1.5e3'), 1500)
  eq('18b parseCoeff(5e-1) 不变', F.parseCoeff('5e-1'), 0.5)
  ok('18b 两页 parseCoeff 逐字一致', extractFrom(ux2, 'parseCoeff') === extractFn('parseCoeff'))
  // 18c 数列中间溢出
  const apB = calc2.seqSolve('ap', 1e304, 0, 9999)
  ok('18c AP(1e304,0,9999) 和 ≈9.999e307 不再误报溢出', apB.type === 'ok' && Math.abs(apB.Sn - 9.999e307) / 9.999e307 < 1e-12, JSON.stringify(apB))
  const gpB = calc2.seqSolve('gp', 1e-300, 10, 310)
  ok('18c GP(1e-300,10,310) an ≈1e9、Sn ≈1.111111111e9', gpB.type === 'ok' && Math.abs(gpB.an - 1e9) / 1e9 < 1e-6 && Math.abs(gpB.Sn - 1.111111111e9) / 1.111111111e9 < 1e-9, JSON.stringify(gpB))
  const gpN = calc2.seqSolve('gp', -1e-300, -10, 310)
  ok('18c GP(-1e-300,-10,310) 负公比 an ≈1e9、Sn ≈9.090909091e8', gpN.type === 'ok' && Math.abs(gpN.an - 1e9) / 1e9 < 1e-6 && Math.abs(gpN.Sn - 9.090909091e8) / 9.090909091e8 < 1e-6, JSON.stringify(gpN))
  const gpU = calc2.seqSolve('gp', 1e300, 1e-300, 3)
  ok('18c GP(1e300,1e-300,3) pow 下溢兜底 an ≈1e-300', gpU.type === 'ok' && Math.abs(gpU.an - 1e-300) / 1e-300 < 1e-6, JSON.stringify(gpU))
  ok('18c GP(1e300,10,310) 真溢出改逐行返回（§25 契约）', calc2.seqSolve('gp', 1e300, 10, 310).type === 'ok' && calc2.seqSolve('gp', 1e300, 10, 310).an === Infinity && calc2.seqSolve('gp', 1e300, 10, 310).Sn === Infinity)
  ok('18c AP(1e308,1e308,2) 真溢出改逐行返回（§25 契约）', calc2.seqSolve('ap', 1e308, 1e308, 2).type === 'ok' && calc2.seqSolve('ap', 1e308, 1e308, 2).an === Infinity && calc2.seqSolve('ap', 1e308, 1e308, 2).Sn === Infinity)
  eq('18c GP(1,2,10) 和仍精确 1023', calc2.seqSolve('gp', 1, 2, 10).Sn, 1023)
  eq('18c AP(1,1,100) 和仍精确 5050', calc2.seqSolve('ap', 1, 1, 100).Sn, 5050)
  // 18d 极小角显示
  const angSeg = new Function('calc', [extractFrom(ux2, 'FD'), extractFrom(ux2, 'fmtDeg'), extractFrom(ux2, 'angSeg')].join('\n') + '\nreturn angSeg')(calc)
  eq('18d 极小角走科学计数法显示', angSeg(5.729577951308232e-15), '≈ ' + calc.formatDisplay(5.729577951308232e-15) + '°')
  ok('18d 极小角不再显示 = 0°', angSeg(1.0000178463e-10).indexOf('= 0°') < 0 && angSeg(1.0000178463e-10).charAt(0) === '≈')
  eq('18d 普通直角口径不变', angSeg(90), '= 90°')
  eq('18d 普通角口径不变', angSeg(36.86989764584402), '≈ 36.87°')
  eq('18d 真零角仍 = 0°', angSeg(0), '= 0°')
  // 18e drawPlot 复用 solveQuad（整页实例驱动）
  const inst18 = makeInst()
  let capCfg = null
  inst18.buildPlot = function (cfg) { capCfg = cfg; return true }
  inst18.plotType = 'quad2'
  inst18.plotVals = { a: '1e200', b: '0', c: '-1e200' }
  inst18.drawPlot()
  ok('18e drawPlot(1e200,0,-1e200) 交点 −1/1 不丢', !!capCfg && capCfg.keyPts.some((p) => p.x === -1 && p.y === 0) && capCfg.keyPts.some((p) => p.x === 1 && p.y === 0), capCfg ? JSON.stringify(capCfg.keyPts) : '无 cfg')
  const inst18b = makeInst()
  let capCfg2 = null
  inst18b.buildPlot = function (cfg) { capCfg2 = cfg; return true }
  inst18b.plotType = 'quad2'
  inst18b.plotVals = { a: '1', b: '-3', c: '2' }
  inst18b.drawPlot()
  ok('18e drawPlot(1,-3,2) 交点 1/2 不变', !!capCfg2 && capCfg2.keyPts.some((p) => p.x === 1 && p.y === 0) && capCfg2.keyPts.some((p) => p.x === 2 && p.y === 0))
  // 18f 无 BigInt 环境（屏蔽全局 BigInt 重载模块）
  const savedBigInt2 = globalThis.BigInt
  globalThis.BigInt = undefined
  try {
    const nb2 = (await import('../src/common/calc2.js?nobigint=2')).default
    const rNb = nb2.solveTriangle({ a: 1, b: 1, c: 1e-16, A: null, B: null, C: null })
    ok('18f 无 BigInt SSS(1,1,1e-16) 仍非退化', !!rNb.solutions && Math.abs(rNb.solutions[0].C - 5.729577951308232e-15) / 5.729577951308232e-15 < 1e-6, JSON.stringify(rNb))
    eq('18f 无 BigInt SSS(1,1,2) 仍判退化', nb2.solveTriangle({ a: 1, b: 1, c: 2, A: null, B: null, C: null }).error, '三边退化成一条直线')
    const nbC = (await import('../src/common/calc.js?nobigint=2')).default
    const taNb = nbC.triArea(1, 1, 1e-16)
    ok('18f 无 BigInt triArea(1,1,1e-16) 仍可算', taNb.type === 'ok' && Math.abs(taNb.area - 5e-17) / 5e-17 < 1e-9, JSON.stringify(taNb))
  } finally {
    globalThis.BigInt = savedBigInt2
  }
  const c2src = readFileSync(new URL('../src/common/calc2.js', import.meta.url), 'utf8')
  const sscBody = c2src.slice(c2src.indexOf('function sidesSumCmp'), c2src.indexOf('function verify'))
  ok('18f sidesSumCmp 本体无 BigInt 依赖', sscBody.indexOf('BigInt') < 0)
  if (buglog !== null) { ok('18z BUGLOG 含第十八轮条目', buglog.indexOf('第十八轮') >= 0) } else { skip++ }
}

// ===== §19 第十九轮复审（ChatGPT 复审第十八轮＋自查同类，2026-11-15） =====
// 19a 等差数列末项中间溢出（ChatGPT 报）
const apO = calc2.seqSolve('ap', -1.5e308, 1e308, 3)
ok('19a AP(-1.5e308,1e308,3) an ≈5e307、Sn ≈-1.5e308', apO.type === 'ok' && Math.abs(apO.an - 5e307) / 5e307 < 1e-12 && Math.abs(apO.Sn - -1.5e308) / 1.5e308 < 1e-12, JSON.stringify(apO))
const apO2 = calc2.seqSolve('ap', 1e308, -1e308, 3)
ok('19a AP(1e308,-1e308,3) an = -1e308、Sn = 0', apO2.type === 'ok' && apO2.an === -1e308 && apO2.Sn === 0, JSON.stringify(apO2))
ok('19a AP(1.5e308,1e308,3) 真溢出改逐行返回（§25 契约）', calc2.seqSolve('ap', 1.5e308, 1e308, 3).type === 'ok' && calc2.seqSolve('ap', 1.5e308, 1e308, 3).an === Infinity && calc2.seqSolve('ap', 1.5e308, 1e308, 3).Sn === Infinity)
eq('19a AP(1,1,100) an/Sn 仍精确', JSON.stringify(calc2.seqSolve('ap', 1, 1, 100)), JSON.stringify({ type: 'ok', an: 100, Sn: 5050 }))

// 19b 面积中间溢出（自查同类：finish 乘回 sc²）
const sasT = calc2.solveTriangle({ a: 1e200, b: 1e200, c: null, A: null, B: null, C: 5.729577951308232e-149 })
ok('19b SAS(1e200,1e200,5.7e-149°) 面积 ≈5e249 不再误报溢出', !!sasT.solutions && Math.abs(sasT.solutions[0].area - 5e249) / 5e249 < 1e-6, JSON.stringify(sasT))
const sasR = calc2.solveTriangle({ a: 1e308, b: 1e-100, c: null, A: null, B: null, C: 90 })
ok('19b SAS(1e308,1e-100,90°) 有解、A≈90°、面积 ≈5e207', !!sasR.solutions && Math.abs(sasR.solutions[0].A - 90) < 1e-9 && Math.abs(sasR.solutions[0].area - 5e207) / 5e207 < 1e-6, JSON.stringify(sasR))

// 19c 极端边比角度塌陷（自查同类：fromSSS 对数域兜底）
const sssX = calc2.solveTriangle({ a: 1e308, b: 1e308, c: 1e-100, A: null, B: null, C: null })
ok('19c SSS(1e308,1e308,1e-100) A≈B≈90°、C 为极小角', !!sssX.solutions && Math.abs(sssX.solutions[0].A - 90) < 1e-9 && Math.abs(sssX.solutions[0].B - 90) < 1e-9 && sssX.solutions[0].C >= 0 && sssX.solutions[0].C < 1e-300, JSON.stringify(sssX))
ok('19c SSS(1e308,1e308,1e-100) 面积走海伦兜底 ≈5e207（sin 式为 0）', !!sssX.solutions && Math.abs(sssX.solutions[0].area - 5e207) / 5e207 < 1e-6, JSON.stringify(sssX))

// 19d ASA 边长溢出的文案（自查同类）
eq('19d ASA(1e308,30°,60°) 第三边溢出报溢出而非对不上', calc2.solveTriangle({ a: 1e308, b: null, c: null, A: 30, B: 60, C: null }).error, '数字太大，超出精确计算范围')
ok('19d ASA(5,30°,60°) 普通情形不变', !!calc2.solveTriangle({ a: 5, b: null, c: null, A: 30, B: 60, C: null }).solutions)

// 19z BUGLOG 守卫
if (buglog !== null) { ok('19z BUGLOG 含第十九轮条目', buglog.indexOf('第十九轮') >= 0) } else { skip++ }

// ===== §20 数据统计工具（用户点名新增，2026-11-15） =====
const st1 = calc2.statsOf([1, 2, 3, 4, 5])
ok('20 statsOf(1..5) mean=3、popVar=2、sampVar=2.5', st1.type === 'ok' && st1.mean === 3 && st1.popVar === 2 && st1.sampVar === 2.5 && Math.abs(st1.popSd - Math.SQRT2) < 1e-15 && Math.abs(st1.sampSd - Math.sqrt(2.5)) < 1e-15, JSON.stringify(st1))
const st2 = calc2.statsOf([2, 4, 4, 4, 5, 5, 7, 9])
ok('20 statsOf(经典组) mean=5、popVar=4、popSd=2、sampVar=32/7', st2.type === 'ok' && st2.mean === 5 && st2.popVar === 4 && st2.popSd === 2 && Math.abs(st2.sampVar - 32 / 7) < 1e-12, JSON.stringify(st2))
const st3 = calc2.statsOf([1e15 + 1, 1e15 + 2, 1e15 + 3])
ok('20 statsOf(1e15+1,2,3) 移位防相消：mean 精确、popVar=2/3', st3.type === 'ok' && st3.mean === 1e15 + 2 && Math.abs(st3.popVar - 2 / 3) / (2 / 3) < 1e-12, JSON.stringify(st3))
const st4 = calc2.statsOf([5, 5, 5])
ok('20 statsOf(全相同) 方差标准差全 0', st4.type === 'ok' && st4.popVar === 0 && st4.popSd === 0 && st4.sampVar === 0 && st4.sampSd === 0, JSON.stringify(st4))
const st5 = calc2.statsOf([7])
ok('20 statsOf(单个) mean=7、popVar=0、样本为 null', st5.type === 'ok' && st5.mean === 7 && st5.popVar === 0 && st5.sampVar === null && st5.sampSd === null, JSON.stringify(st5))
eq('20 statsOf(空) 报错', calc2.statsOf([]).error, '先加至少一个数据')
const st7 = calc2.statsOf([-1.5, 2.5])
ok('20 statsOf(-1.5,2.5) mean=0.5、popVar=4、sampVar=8', st7.type === 'ok' && st7.mean === 0.5 && st7.popVar === 4 && st7.popSd === 2 && st7.sampVar === 8, JSON.stringify(st7))
// 2026-11-15 第二十轮翻转并披露：原断言要求 ±1e308 时整页报「数字太
// 大」；方差改缩放累加后，均值 / 中位数照常出、只有真溢出的方差字段
// 返回 Infinity 由页面单独标「太大」（不连坐，同极差口径），见 §22e。
const st8 = calc2.statsOf([1e308, -1e308])
ok('20 statsOf(±1e308) 不再整页报错：mean=0、方差 Infinity', st8.type === 'ok' && st8.mean === 0 && st8.popVar === Infinity && st8.sampVar === Infinity, JSON.stringify(st8))
const st9 = calc2.statsOf([0.1, 0.2, 0.3])
ok('20 statsOf(0.1,0.2,0.3) mean≈0.2、popVar≈1/150', st9.type === 'ok' && Math.abs(st9.mean - 0.2) < 1e-16 && Math.abs(st9.popVar - 1 / 150) / (1 / 150) < 1e-9, JSON.stringify(st9))
eq('20 statsOf(含 NaN) 报错', calc2.statsOf([1, NaN]).error, '有数据不对')
const t2src = readFileSync(new URL('../src/pages/tools2/index.ux', import.meta.url), 'utf8')
ok('20 tools2 页面已接 statsOf 且菜单含数据统计', t2src.indexOf('statsOf') >= 0 && t2src.indexOf('数据统计') >= 0)
if (buglog !== null) { ok('20z BUGLOG 含数据统计条目', buglog.indexOf('数据统计工具新增') >= 0) } else { skip++ }

// ===== §21 统计补全 + 分布列 / 向量 / 复数 / 韦达弦长（用户点名「那些都做」，2026-11-15） =====
const s21a = calc2.statsOf([1, 2, 3, 4, 5])
ok('21 stats 中位数(奇数)=3、无众数、极差=4', s21a.median === 3 && s21a.modes === null && s21a.range === 4, JSON.stringify(s21a))
const s21b = calc2.statsOf([1, 2, 3, 4])
ok('21 stats 中位数(偶数)=2.5', s21b.median === 2.5 && s21b.range === 3, JSON.stringify(s21b))
const s21c = calc2.statsOf([1, 1, 2, 2, 3])
ok('21 stats 双众数 [1,2]、中位数 2', JSON.stringify(s21c.modes) === '[1,2]' && s21c.median === 2, JSON.stringify(s21c))
const s21d = calc2.statsOf([1e15 + 1, 1e15 + 2, 1e15 + 3])
ok('21 stats 扎堆组中位数精确、极差 2', s21d.median === 1e15 + 2 && s21d.range === 2, JSON.stringify(s21d))
const d21a = calc2.distOf([[0, 0.2], [1, 0.3], [2, 0.5]])
ok('21 distOf 经典列 E=1.3、D=0.61', d21a.type === 'ok' && Math.abs(d21a.E - 1.3) < 1e-12 && Math.abs(d21a.D - 0.61) < 1e-12 && Math.abs(d21a.sd - Math.sqrt(0.61)) < 1e-12, JSON.stringify(d21a))
const d21b = calc2.distOf([[0, 0.5], [1, 0.4]])
ok('21 distOf Σp≠1 报错并回带 psum', !!d21b.error && Math.abs(d21b.psum - 0.9) < 1e-15, JSON.stringify(d21b))
eq('21 distOf p 越界报错', calc2.distOf([[0, 1.5], [1, -0.5]]).error, '概率要在 0 到 1 之间')
const d21d = calc2.distOf([[1e15 + 1, 1 / 3], [1e15 + 2, 1 / 3], [1e15 + 3, 1 / 3]])
ok('21 distOf 相消组 E 精确、D=2/3（两遍法）', d21d.type === 'ok' && d21d.E === 1e15 + 2 && Math.abs(d21d.D - 2 / 3) / (2 / 3) < 1e-9, JSON.stringify(d21d))
const v21a = calc2.vecOf([1, 2, 3], [4, 5, 6])
ok('21 vecOf 点积 32、模 √14/√77、和 (5,7,9)、角 ≈12.933°', v21a.dot === 32 && Math.abs(v21a.magA - Math.sqrt(14)) < 1e-12 && Math.abs(v21a.magB - Math.sqrt(77)) < 1e-12 && JSON.stringify(v21a.sum) === '[5,7,9]' && Math.abs(v21a.angle - 12.933154491899135) < 1e-9, JSON.stringify(v21a))
const v21b = calc2.vecOf([3, 4], [1, 0])
ok('21 vecOf 2D |a|=5、夹角 acos(3/5)', v21b.magA === 5 && Math.abs(v21b.angle - 53.13010235415598) < 1e-9, JSON.stringify(v21b))
const v21c = calc2.vecOf([1e200, 1e200], [1e200, -1e200])
ok('21 vecOf 巨大分量：点积恰 0（不 NaN）、模有限、夹角 90°', v21c.dot === 0 && isFinite(v21c.magA) && v21c.angle === 90, JSON.stringify(v21c))
const v21d = calc2.vecOf([0, 0], [1, 2])
ok('21 vecOf 零向量夹角为 null', v21d.angle === null && v21d.magA === 0, JSON.stringify(v21d))
const c21a = calc2.cplxOps([1, 2], [3, 4])
ok('21 cplx 和差积商与模', JSON.stringify(c21a.add) === '[4,6]' && JSON.stringify(c21a.sub) === '[-2,-2]' && JSON.stringify(c21a.mul) === '[-5,10]' && Math.abs(c21a.div[0] - 0.44) < 1e-15 && Math.abs(c21a.div[1] - 0.08) < 1e-15 && Math.abs(c21a.mag1 - Math.sqrt(5)) < 1e-15 && c21a.mag2 === 5, JSON.stringify(c21a))
const c21b = calc2.cplxOps([1e200, 1e200], [1e200, -1e200])
ok('21 cplx 巨大分量除法稳定 = i', Math.abs(c21b.div[0]) < 1e-12 && Math.abs(c21b.div[1] - 1) < 1e-12, JSON.stringify(c21b.div))
eq('21 cplx 除数为 0 时 div 为 null', calc2.cplxOps([1, 2], [0, 0]).div, null)
const w21a = calc2.vietaOf(1, -3, 2, 1)
ok('21 vietaOf Δ=1、和 3、积 2、弦长 √2', Math.abs(w21a.disc - 1) < 1e-12 && w21a.sum === 3 && w21a.prod === 2 && Math.abs(w21a.chord - Math.SQRT2) < 1e-12, JSON.stringify(w21a))
const w21b = calc2.vietaOf(1, 0, 1, 2)
ok('21 vietaOf Δ<0 标记、无弦长', w21b.discNeg === true && w21b.chord === null && w21b.disc === -4, JSON.stringify(w21b))
eq('21 vietaOf a=0 报错', calc2.vietaOf(0, 1, 2, 1).error, 'a 不能是 0（不是二次方程）')
const w21d = calc2.vietaOf(1, -3, 2, 0)
ok('21 vietaOf k=0 弦长 = |x1−x2| = 1', Math.abs(w21d.chord - 1) < 1e-12, JSON.stringify(w21d))
ok('21 页面接线：四引擎与菜单齐全', t2src.indexOf('distOf') >= 0 && t2src.indexOf('vecOf') >= 0 && t2src.indexOf('cplxOps') >= 0 && t2src.indexOf('vietaOf') >= 0 && t2src.indexOf('分布列') >= 0 && t2src.indexOf('向量运算') >= 0 && t2src.indexOf('复数运算') >= 0 && t2src.indexOf('韦达 · 弦长') >= 0)
if (buglog !== null) { ok('21z BUGLOG 含四工具条目', buglog.indexOf('分布列期望方差') >= 0 && buglog.indexOf('向量运算') >= 0 && buglog.indexOf('复数运算') >= 0 && buglog.indexOf('韦达定理与弦长') >= 0) } else { skip++ }

// ===== §22 第二十轮外部复审（五项新功能边界，2026-11-15）＋同类自查 =====
// 复审五项逐项实跑全部属实；另自查同类两处：复数乘法相消 NaN、
// 中位数异号 (b−a) 溢出（被移位溢出挡住、修移位后才可达，一并修）。
const v22a = calc2.vecOf([1e200, 1e200], [1e-200, 1e-200])
ok('22a vecOf 混合量级：点积 2、|b|=√2e-200、夹角 0', v22a.dot === 2 && Math.abs(v22a.magB - Math.SQRT2 * 1e-200) / (Math.SQRT2 * 1e-200) < 1e-12 && v22a.angle === 0, JSON.stringify(v22a))
const v22b = calc2.vecOf([1e200, 1e200, 1e200], [1e-200, 1e-200, 1e-200])
ok('22a vecOf 3D 混合量级：点积 3、夹角 0', v22b.dot === 3 && v22b.angle === 0, JSON.stringify(v22b))
ok('22a vecOf 平行 / 反向夹角恰 0 / 180（无舍入尘）', calc2.vecOf([2, 2], [1, 1]).angle === 0 && calc2.vecOf([1, 0], [-1, 0]).angle === 180)
const v22d = calc2.vecOf([3e-200, 4e-200], [1, 0])
ok('22a vecOf 微量级模长不下溢：|a|=5e-200', Math.abs(v22d.magA - 5e-200) / 5e-200 < 1e-12, JSON.stringify(v22d))
const c22a = calc2.cplxOps([1e308, 1e308], [1e308, 1e308])
ok('22b cplx 极大除法 = [1, 0]（旧 Smith den 溢出变 NaN）', c22a.div[0] === 1 && c22a.div[1] === 0, JSON.stringify(c22a.div))
const c22b = calc2.cplxOps([1e200, 1e200], [1e200, 1e200])
ok('22b cplx 乘法相消：实部恰 0、虚部真溢出 Infinity（旧为 NaN）', c22b.mul[0] === 0 && c22b.mul[1] === Infinity, JSON.stringify(c22b.mul))
const c22c = calc2.cplxOps([1e308, 0], [1e-300, 0])
ok('22b cplx 尺度悬殊乘法不被吞：1e308×1e-300=1e8', Math.abs(c22c.mul[0] - 1e8) / 1e8 < 1e-12 && c22c.mul[1] === 0, JSON.stringify(c22c.mul))
const c22d = calc2.cplxOps([1, 0], [1e308, 0])
ok('22b cplx 大除小：商 1e-308', Math.abs(c22d.div[0] - 1e-308) / 1e-308 < 1e-9 && c22d.div[1] === 0, JSON.stringify(c22d.div))
const w22a = calc2.vietaOf(1e200, -2e200, 1e200, 0)
ok('22c vieta 重根 Δ 恰 0（旧 sc²·dn = ∞·0 = NaN）', w22a.disc === 0 && w22a.sum === 2 && w22a.prod === 1 && w22a.diffAbs === 0 && w22a.chord === 0, JSON.stringify(w22a))
const w22b = calc2.vietaOf(1e160, 2e160, 1e160 * (1 - 1e-13), 0)
ok('22c vieta 中量级极小 dn：Δ≈4e307 有限（旧 sc² 先溢出误报 Infinity）', isFinite(w22b.disc) && Math.abs(w22b.disc - 4e307) / 4e307 < 0.01, JSON.stringify(w22b))
const d22a = calc2.distOf([[-1e308, 1], [1e308, 0]])
ok('22d distOf 零概率极端值不连坐：E=−1e308、D=0', d22a.type === 'ok' && d22a.E === -1e308 && d22a.D === 0 && d22a.sd === 0, JSON.stringify(d22a))
const d22b = calc2.distOf([[5, 0], [1, 0.5], [2, 0.5]])
ok('22d distOf 零概率普通组：E=1.5、D=0.25', d22b.type === 'ok' && d22b.E === 1.5 && d22b.D === 0.25, JSON.stringify(d22b))
const d22c = calc2.distOf([[-1e308, 1], [1e308, 5e-324]])
ok('22d distOf 次正规概率极端偏离：D≈1.9763e293（dv 溢出走半差缩放）', d22c.type === 'ok' && d22c.E === -1e308 && Math.abs(d22c.D - 1.9762625833649863e293) / 1.9762625833649863e293 < 1e-9, JSON.stringify(d22c))
const s22a = calc2.statsOf([1e154, -1e154, 0])
ok('22e statsOf M2 中间溢出：总体方差 6.67e307、样本方差 1e308 都可表示', s22a.type === 'ok' && s22a.mean === 0 && s22a.median === 0 && Math.abs(s22a.popVar - 6.666666666666666e307) / 6.666666666666666e307 < 1e-12 && Math.abs(s22a.sampVar - 1e308) / 1e308 < 1e-12 && Math.abs(s22a.popSd - 8.16496580927726e153) / 8.16496580927726e153 < 1e-12, JSON.stringify(s22a))
const s22b = calc2.statsOf([1.7e308, -1.7e308])
ok('22e statsOf 满量程：mean / median 照常、方差与极差 Infinity 不连坐', s22b.type === 'ok' && s22b.mean === 0 && s22b.median === 0 && s22b.popVar === Infinity && s22b.range === Infinity, JSON.stringify(s22b))
const s22c = calc2.statsOf([1.3e154, -1.3e154])
ok('22e statsOf 样本方差单独溢出：总体 1.69e308 有限、样本 Infinity', isFinite(s22c.popVar) && Math.abs(s22c.popVar - 1.69e308) / 1.69e308 < 1e-9 && s22c.sampVar === Infinity, JSON.stringify(s22c))
ok('22e statsOf 中位数异号小数组：(−5, 5) 中位数 0', calc2.statsOf([-5, 5]).median === 0)
if (buglog !== null) { ok('22z BUGLOG 含第二十轮条目', buglog.indexOf('第二十轮') >= 0) } else { skip++ }

// ===== §23 第二十一轮外部复审（对象内部尺度与缩放助手端点，2026-11-15） =====
// 复审 8 项逐项实跑全部属实；修法统一为逐项 (尾数, 指数) 缩放
// （expAdd 累加器 + prodT 单项乘积），整体缩放只留兜底。
const MAXV = Number.MAX_VALUE
const m23a = calc2.cplxOps([MAXV, 0], [1, 0])
ok('23a cplx MAX×1 乘法 = [MAX, 0]（frexp2 端点修复）', m23a.mul[0] === MAXV && m23a.mul[1] === 0, JSON.stringify(m23a.mul))
const m23b = calc2.cplxOps([MAXV, 0], [MAXV, 0])
ok('23a cplx MAX÷MAX = [1, 0]', m23b.div[0] === 1 && m23b.div[1] === 0, JSON.stringify(m23b.div))
const w23a = calc2.vietaOf(MAXV, MAXV, 0, 0)
ok('23a vieta MAX 系数 Δ 真溢出 Infinity、根差恰 1', w23a.disc === Infinity && w23a.diffAbs === 1, JSON.stringify(w23a))
const v23a = calc2.vecOf([1e308, 1e-308], [1e-308, 1e308])
ok('23b vecOf 向量内部尺度悬殊：点积 ≈ 2、夹角 90', Math.abs(v23a.dot - 2) / 2 < 1e-12 && v23a.angle === 90, JSON.stringify(v23a))
const v23b = calc2.vecOf([1e308, 1e-308, 0], [1e-308, 1e308, 0])
ok('23b vecOf 3D 内部尺度悬殊：点积 ≈ 2', Math.abs(v23b.dot - 2) / 2 < 1e-12, JSON.stringify(v23b))
const v23c = calc2.vecOf([1, 0], [1, 1e-6])
const v23d = calc2.vecOf([1, 0], [-1, 1e-6])
ok('23b vecOf 真实小夹角不归零：≈5.7296e-5° 与 ≈179.99994°', Math.abs(v23c.angle - 5.729577951308232e-5) / 5.729577951308232e-5 < 1e-9 && Math.abs(v23d.angle - 179.9999427042205) < 1e-9, v23c.angle + '/' + v23d.angle)
const c23a = calc2.cplxOps([1e308, 1e-308], [1, 0])
ok('23c cplx 内部小分量不丢：×[1,0] 与 ÷[1,0] 都保住 1e-308 虚部', c23a.mul[0] === 1e308 && c23a.mul[1] === 1e-308 && c23a.div[0] === 1e308 && c23a.div[1] === 1e-308, JSON.stringify(c23a))
const c23b = calc2.cplxOps([1e308, 1e-308], [1e-308, -1e308])
ok('23c cplx 交叉项：实部 ≈ 2、虚部真溢出 -Infinity', Math.abs(c23b.mul[0] - 2) / 2 < 1e-12 && c23b.mul[1] === -Infinity, JSON.stringify(c23b.mul))
const w23b = calc2.vietaOf(1e308, 0, -1e-308, 0)
ok('23d vieta 小系数不消失：Δ ≈ 4、根差 ≈ 2e-308', Math.abs(w23b.disc - 4) / 4 < 1e-12 && Math.abs(w23b.diffAbs - 2e-308) / 2e-308 < 1e-9, JSON.stringify(w23b))
const w23c = calc2.vietaOf(1e308, 0, 1e-308, 0)
ok('23d vieta 无实根不误判重根：Δ ≈ -4、discNeg', Math.abs(w23c.disc + 4) / 4 < 1e-12 && w23c.discNeg === true && w23c.diffAbs === null, JSON.stringify(w23c))
const s23a = calc2.statsOf([8.99e307, -8.99e307])
ok('23e statsOf 半量程阈值边界：mean / median 照常、方差 Infinity', s23a.type === 'ok' && s23a.mean === 0 && s23a.median === 0 && s23a.popVar === Infinity, JSON.stringify(s23a))
const d23a = calc2.distOf([[5e-324, 0.5], [5e-324, 0.5]])
ok('23f distOf 次正规期望不下溢：E = 5e-324', d23a.type === 'ok' && d23a.E === 5e-324 && d23a.D === 0, JSON.stringify(d23a))
const d23b = calc2.distOf([[-1e308, 0.5], [1e308, 0.5]])
ok('23f distOf 方差真溢出不连坐期望：E = 0、D / sd Infinity', d23b.type === 'ok' && d23b.E === 0 && d23b.D === Infinity && d23b.sd === Infinity, JSON.stringify(d23b))
const fd1 = calc.formatDisplay(2.23607)
ok('23g formatDisplay 不带尾零：2.23607 / 2.5 / 100.1 原样', fd1 === '2.23607' && calc.formatDisplay(2.5) === '2.5' && calc.formatDisplay(100.1) === '100.1', fd1)
if (buglog !== null) { ok('23z BUGLOG 含第二十一轮条目', buglog.indexOf('第二十一轮') >= 0) } else { skip++ }

// ===== §24 第二十二轮外部复审（精确求和与不连坐，2026-11-15） =====
// 复审 3 项逐项实跑全部属实：expAdd 单尾数对齐累加的消去误差使点积 /
// 期望随输入顺序变；Welford 平均数同病；向量页 bad gate 连坐隐藏。
// 修法：expSumFE = BigInt 精确求和（53 位整数尾数对齐相加），三处
// 调用点与统计平均数统一换用；vc/pm/sq 三页改逐行判溢出。
ok('24a vecOf 点积排列一：小量在前 dot 恰 1', calc2.vecOf([1, 1e308, 1e308], [1, 1e308, -1e308]).dot === 1)
ok('24a vecOf 点积排列二：大量在前 dot 恰 1', calc2.vecOf([1e308, 1e308, 1], [1e308, -1e308, 1]).dot === 1)
ok('24a vecOf 点积排列三：负大量在前 dot 恰 1', calc2.vecOf([1e308, 1, 1e308], [-1e308, 1, 1e308]).dot === 1)
const perms24 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
const base24 = [[1, 0.5], [1e308, 0.25], [-1e308, 0.25]]
let allE = true
for (const pm of perms24) { const r = calc2.distOf(pm.map(function (i) { return base24[i] })); if (r.E !== 0.5) allE = false }
ok('24a distOf 期望六种排列全等 0.5', allE)
const st24a = calc2.statsOf([1, 1e308, -1e308])
ok('24b statsOf 平均数排列一：恰 1/3、方差 Infinity', st24a.mean === 1 / 3 && st24a.popVar === Infinity, JSON.stringify(st24a))
const st24b = calc2.statsOf([1e308, -1e308, 1])
ok('24b statsOf 平均数排列二：恰 1/3', st24b.mean === 1 / 3, JSON.stringify(st24b))
ok('24b statsOf 大数扎堆平均数恰 100000002', calc2.statsOf([100000001, 100000002, 100000003]).mean === 100000002)
ok('24b statsOf 满量程平均数：[MAX, MAX] = MAX、[MAX, -MAX] = 0', calc2.statsOf([MAXV, MAXV]).mean === MAXV && calc2.statsOf([MAXV, -MAXV]).mean === 0)
const m24 = Number.MAX_VALUE * 0.6
const v24 = calc2.vecOf([m24, m24], [m24, -m24])
ok('24c vecOf 部分溢出引擎契约：dot 0、模长有限、夹角 90、sum/diff 各一分量 Inf', v24.dot === 0 && isFinite(v24.magA) && v24.angle === 90 && v24.sum[0] === Infinity && v24.diff[1] === Infinity, JSON.stringify(v24))
ok('24c 向量页逐行判溢出：bad gate 已除、点积行有「太大」分支', ux2.indexOf('const bad = !isFinite(r.dot)') < 0 && ux2.indexOf('a·b 太大了') >= 0)
ok('24c 数列 / 排列组合页逐行判溢出', ux2.indexOf('项太大了') >= 0 && ux2.indexOf('cBig') >= 0)
if (buglog !== null) { ok('24z BUGLOG 含第二十二轮条目', buglog.indexOf('第二十二轮') >= 0) } else { skip++ }

// ===== §25 第二十三轮复审（ChatGPT 报 4 项 + 自查 3 项）=====
// 25a 点积普通量级路径（BUG-01）：旧版 MA,MB ≤ 1e150 走双精度直加、
// 大数抵消吞小量；改全程精确乘积 + 精确求和后所有量级、所有排列同值。
eq('25a vecOf 普通量级点积抵消保 1', calc2.vecOf([1, 1e100, 1e100], [1, 1e100, -1e100]).dot, 1)
eq('25a vecOf 普通量级换序仍 1', calc2.vecOf([1e100, 1e100, 1], [1e100, -1e100, 1]).dot, 1)
eq('25a vecOf 极端量级仍 1', calc2.vecOf([1, 1e308, 1e308], [1, 1e308, -1e308]).dot, 1)
eq('25a vecOf 教材值不变', calc2.vecOf([1, 2, 3], [4, 5, 6]).dot, 32)
ok('25a vecOf 小数点积正确舍入（精确值 0.11000000000000001）', calc2.vecOf([0.1, 0.2], [0.3, 0.4]).dot === 0.11000000000000001, String(calc2.vecOf([0.1, 0.2], [0.3, 0.4]).dot))
// 25b 韦达 Δ 精确乘积（BUG-02）：b² 与 4ac 先舍入会把真 Δ = 9.17e131
// 算成 0 误判重根；Dekker 两积 + 精确求和后与精确有理数计算逐位一致。
const w25 = calc2.vietaOf(1.3690040441523358e23, 9.54250347729416e73, 1.6628762530528816e124, 0)
ok('25b vieta 近重根 Δ 逐位正确、非重根', w25.disc === 9.173262235320083e131 && w25.discNeg === false && w25.diffAbs > 0, JSON.stringify(w25))
eq('25b vieta 普通重根 Δ 仍恰为 0', calc2.vietaOf(1, -2, 1, 0).disc, 0)
// 25c 数列逐行贯通（BUG-03）：引擎不再整体报错，an / Sn 各自返回。
const sq25 = calc2.seqSolve('gp', 1e308, 1, 3)
ok('25c seqSolve an 有限、Sn 单独溢出', sq25.type === 'ok' && sq25.an === 1e308 && sq25.Sn === Infinity, JSON.stringify(sq25))
// 25d 向量页逐分量（BUG-04）：整行隐藏的旧串已除、逐分量「太大」在位。
ok('25d 向量页逐分量标太大', ux2.indexOf("return label + ' 太大了，超出范围'") < 0 && ux2.indexOf(": '太大'") >= 0 && ux2.indexOf('太大i') >= 0)
// 25e 自查：复数除法分子全程 (尾数, 指数) 域——次正规除数不再把商算成 0 / NaN。
eq('25e cplx 次正规自除 = [1, 0]', JSON.stringify(calc2.cplxOps([1e-320, 0], [1e-320, 0]).div), JSON.stringify([1, 0]))
ok('25e cplx 大商双 Inf 不再 NaN', calc2.cplxOps([3, 4], [1e-320, 0]).div[0] === Infinity && calc2.cplxOps([3, 4], [1e-320, 0]).div[1] === Infinity)
eq('25e cplx §21 除法不回退', JSON.stringify(calc2.cplxOps([1e308, 1e-308], [1, -1]).div), JSON.stringify([5e307, 5e307]))
// 25f 自查：等比首项 0 不再 NaN、负公比 Inf 相消不再 NaN、直角三角形
// 斜边溢出不再误报勾股不符且角度照常、排列组合 C 溢出不连坐。
eq('25f seqSolve gp 首项 0', JSON.stringify(calc2.seqSolve('gp', 0, 1e308, 3)), JSON.stringify({ type: 'ok', an: 0, Sn: 0 }))
ok('25f seqSolve gp 负公比 n=4 Sn = -Inf（非 NaN）', calc2.seqSolve('gp', 1, -1e200, 4).Sn === -Infinity && calc2.seqSolve('gp', 1, -1e200, 4).an === -Infinity)
ok('25f seqSolve gp 负公比 n=3 Sn = +Inf', calc2.seqSolve('gp', 1, -1e200, 3).Sn === Infinity)
const rt25 = calc2.solveRightTri({ a: 1.5e308, b: 1.5e308, c: null, A: null, B: null })
ok('25f solveRightTri 斜边溢出：ok、c = Inf、两角 45', rt25.type === 'ok' && rt25.c === Infinity && Math.abs(rt25.A - 45) < 1e-9 && Math.abs(rt25.B - 45) < 1e-9, JSON.stringify(rt25))
eq('25f solveRightTri 真不符仍报勾股', calc2.solveRightTri({ a: 3, b: 4, c: 6, A: null, B: null }).error, '三边不符合勾股定理')
ok('25f permComb C 溢出不连坐（引擎层）', calc2.permComb(2000, 1000).type === 'ok' && calc2.permComb(2000, 1000).C === Infinity)
// 25g 无 BigInt 兜底（风险-05）：隐藏 BigInt 后分桶折叠路径与精确路
// 径同值——ChatGPT 的 [1, 200 个 2^-60] 平均数与点积抵消两例。
const meanBig = calc2.statsOf([1].concat(Array(200).fill(Math.pow(2, -60)))).mean
const savedBigInt = globalThis.BigInt
globalThis.BigInt = undefined
let meanNoBig, dotNoBig
try {
  meanNoBig = calc2.statsOf([1].concat(Array(200).fill(Math.pow(2, -60)))).mean
  dotNoBig = calc2.vecOf([1, 1e100, 1e100], [1, 1e100, -1e100]).dot
} finally { globalThis.BigInt = savedBigInt }
ok('25g 无 BigInt 兜底平均数与精确路径一致', meanNoBig === meanBig, String(meanNoBig) + ' vs ' + String(meanBig))
eq('25g 无 BigInt 兜底点积抵消仍 1', dotNoBig, 1)
if (buglog !== null) { ok('25z BUGLOG 含第二十三轮条目', buglog.indexOf('第二十三轮') >= 0) } else { skip++ }

// §26 第二十三轮补修（交接深挖 N1–N6 + BigInt 口径更正）：手环
// QuickJS 没有 BigInt（1.5.20 定案）——真机恒走无 BigInt 路径，
// 该路径已换成 27 位肢体精确算术，必须与 BigInt 路径逐位一致。
{
  const cm = calc2.cplxOps([9.54250347729416e73, 1.3690040441523358e23], [9.54250347729416e73, 6.651505012211527e124])
  eq('26a N6 复数乘法实部不再被乘积舍入吞掉', cm.mul[0], -3.687394939405315e131)
  const B = 9.54250347729416e73 * Math.pow(2, 260), A2 = 1.3690040441523358e23 * Math.pow(2, 260), C2 = 1.6628762530528816e124 * Math.pow(2, 260)
  eq('26b N1 点积缩放路径精确值', calc2.vecOf([B, A2], [B, -4 * C2]).dot, 3.14862945643949e288)
  const ap = calc2.seqSolve('ap', 1e308, 0, 3)
  ok('26c N2 数列 AP an 有限 Sn 溢出各自返回', ap.type === 'ok' && ap.an === 1e308 && ap.Sn === Infinity)
  const tr = calc2.solveTriangle({ a: 1e200, b: 1e200, c: 1e200 })
  ok('26d N3 三角形面积溢出不连坐整解', !tr.error && tr.solutions[0].area === Infinity && Math.abs(tr.solutions[0].B - 60) < 1e-9)
  const rt = calc2.solveRightTri({ a: 1.7e308, A: 30 })
  ok('26e N4 直角三角形边溢出角照常给', rt.type === 'ok' && rt.B === 60 && rt.b === Infinity && rt.c === Infinity)
  // 无 BigInt（= 真机路径）与 BigInt 路径逐项对拍：关键引擎全等
  const savedBI = globalThis.BigInt
  const battery = [
    () => calc2.vecOf([1, 1e100, 1e100], [1, 1e100, -1e100]).dot,
    () => calc2.vecOf([B, A2], [B, -4 * C2]).dot,
    () => calc2.vietaOf(1.3690040441523358e23, 9.54250347729416e73, 1.6628762530528816e124, 0).disc,
    () => calc2.statsOf([1].concat(Array(200).fill(Math.pow(2, -60)))).mean,
    () => calc2.distOf([[1, 0.5], [1e308, 0.25], [-1e308, 0.25]]).E,
    () => calc2.cplxOps([9.54250347729416e73, 1.3690040441523358e23], [9.54250347729416e73, 6.651505012211527e124]).mul[0],
    () => calc2.cplxOps([1e-320, 0], [1e-320, 0]).div[0]
  ]
  const onVals = battery.map(f => f())
  globalThis.BigInt = undefined
  let offVals = null
  try { offVals = battery.map(f => f()) } finally { globalThis.BigInt = savedBI }
  ok('26f 无 BigInt 路径与 BigInt 路径逐项全等（真机口径）', offVals !== null && offVals.every((v, i) => v === onVals[i]))
  const uxIdx = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
  ok('26g 页脚受众只写初高中', uxIdx.indexOf('为初高中同学备的工具') >= 0 && uxIdx.indexOf('小初高') < 0)
  const uxT2 = readFileSync(new URL('../src/pages/tools2/index.ux', import.meta.url), 'utf8')
  ok('26h 三角形页面积溢出单独标太大', uxT2.indexOf('面积 太大了，超出范围') >= 0)
}
if (buglog !== null) { ok('26z BUGLOG 含第二十三轮补修条目', buglog.indexOf('第二十三轮补修') >= 0) } else { skip++ }

console.log('regression-1.6.0: pass=' + pass + ' fail=' + fail + ' skip=' + skip)
if (fail) process.exit(1)
