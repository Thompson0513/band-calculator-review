// C/D 轮复核探针：逐项复现 C1-C7、F1-F11，只打印实测值、不改文件。
// 用法：node tests/audit-cd-probe.mjs
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'
import calc2 from '../src/common/calc2.js'

const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
const ux2 = readFileSync(new URL('../src/pages/tools2/index.ux', import.meta.url), 'utf8')
function loadPage(src, extra) {
  let script = src.slice(src.indexOf('<script>') + 8, src.indexOf('</script>'))
  globalThis.__storage = { get(o) { o.success('') }, set() {} }
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__router = { push() {}, back() {}, replace() {} }
  globalThis.__calc = calc
  globalThis.__calc2 = calc2
  globalThis.__paykey = { keyMatches: extra && extra.keyOk ? () => true : () => false, normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), shortCodeForDevice: () => 'AAAAAA' }
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import router from '@system.router'", 'const router = globalThis.__router')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import calc2 from '../../common/calc2'", 'const calc2 = globalThis.__calc2')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  script += '\n;module.exports.__fns = { editCoeff, editNum: (typeof editNum !== "undefined" ? editNum : undefined), quadRadStrs: (typeof quadRadStrs !== "undefined" ? quadRadStrs : undefined), rootsLine: (typeof rootsLine !== "undefined" ? rootsLine : undefined), vertexLine: (typeof vertexLine !== "undefined" ? vertexLine : undefined), linePx: (typeof linePx !== "undefined" ? linePx : undefined), fitResStr: (typeof fitResStr !== "undefined" ? fitResStr : undefined), fitResPx: (typeof fitResPx !== "undefined" ? fitResPx : undefined), coeffSrc, parseCoeff, DP: (typeof DP !== "undefined" ? DP : undefined), hardFit: (typeof hardFit !== "undefined" ? hardFit : undefined), pvStr: (typeof pvStr !== "undefined" ? pvStr : undefined), ansStr: (typeof ansStr !== "undefined" ? ansStr : undefined), dm: (typeof dm !== "undefined" ? dm : undefined), fmtSide: (typeof fmtSide !== "undefined" ? fmtSide : undefined), fmtVal: (typeof fmtVal !== "undefined" ? fmtVal : undefined) }'
  const mod = { exports: {} }
  new Function('module', 'exports', script)(mod, mod.exports)
  return mod.exports
}
const def = loadPage(ux)
const def2 = loadPage(ux2)
function makeInst(d, keyOk) {
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(d.data)))
  for (const k of Object.keys(d)) if (typeof d[k] === 'function') inst[k] = d[k].bind(inst)
  inst.onInit()
  inst.unlocked = true
  return inst
}
const F = def.__fns
const F2 = def2.__fns
const show = (label, v) => console.log(label, '=>', JSON.stringify(v))
// ---- C/D 修复验证探针（只打印 PASS/FAIL，不改文件） ----
let pass = 0, fail = 0
const ck = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++; console.log('PASS', label, '=>', JSON.stringify(got)) }
  else { fail++; console.log('FAIL', label, '=> got', JSON.stringify(got), 'want', JSON.stringify(want)) }
}
const ckOk = (label, cond, extra) => {
  if (cond) { pass++; console.log('PASS', label, extra === undefined ? '' : '=> ' + JSON.stringify(extra)) }
  else { fail++; console.log('FAIL', label, extra === undefined ? '' : '=> ' + JSON.stringify(extra)) }
}
// C1
{
  const i = makeInst(def); i.pressKey('2'); i.pressKey('.'); i.pressKey('π')
  ck('C1 主键盘 2.π', i.expr, '2.×π'); ckOk('C1 2.×π 可算', i.previewOk, i.resDisp)
  const j = makeInst(def); j.pressKey('2'); j.pressKey('.'); j.pressKey('sin(')
  ck('C1 主键盘 2.sin(', j.expr, '2.×sin(')
  const k = makeInst(def); k.pressKey('2'); k.pressKey('.'); k.pressKey('√(')
  ck('C1 主键盘 2.√(', k.expr, '2.×√(')
  const e = makeInst(def); e.eqFocus = 1; e.eqExpr = ''; e.eqPad('2'); e.eqPad('.'); e.eqPad('π')
  ck('C1 方程页 2.π', e.eqExpr, '2.×π')
  const e2 = makeInst(def); e2.eqFocus = 1; e2.eqExpr = ''; e2.eqPad('2'); e2.eqPad('.'); e2.eqPad('(')
  ck('C1 方程页 2.(', e2.eqExpr, '2.×(')
}
// C2
{
  const e = makeInst(def); e.eqFocus = 1; e.eqExpr = ''
  for (const v of ['5', '0', '%', '.', '5']) e.eqPad(v)
  ck('C2 方程页 50%×0.5', e.eqExpr, '50%×0.5')
  const e2 = makeInst(def); e2.eqFocus = 1; e2.eqExpr = ''
  for (const v of ['9', '0', '°', '.']) e2.eqPad(v)
  ck('C2 方程页 90°×0.', e2.eqExpr, '90°×0.')
}
// C3
{
  const e = makeInst(def); e.eqFocus = 1; e.eqExpr = ''
  for (const v of ['5', '0', '%', '%']) e.eqPad(v)
  ck('C3 方程页 50%%', e.eqExpr, '50%%')
}
// C4
{
  const long20 = '12345678901234567890'
  ck('C4 editCoeff 20字+.', F.editCoeff(long20, '.'), long20)
  ck('C4 editCoeff 20字+/', F.editCoeff(long20, '/'), long20)
  ck('C4 editCoeff 20字+neg', F.editCoeff(long20, 'neg'), long20)
  ck('C4 editCoeff 20字-neg解', F.editCoeff('-' + long20.slice(0, 19), 'neg'), long20.slice(0, 19))
  ck('C4 editCoeff 19字+sqrt', F.editCoeff('1234567890123456789', 'sqrt'), '1234567890123456789')
  ck('C4 editCoeff 18字+sqrt', F.editCoeff('123456789012345678', 'sqrt'), '123456789012345678√(')
  ck('C4 editCoeff tools2 20字+.', F2.editCoeff(long20, '.'), long20)
  ck('C4 editCoeff tools2 19字+sqrt', F2.editCoeff('1234567890123456789', 'sqrt'), '1234567890123456789')
  ck('C4 editNum 8位+00', F.editNum('12345678', '00', false), '12345678')
  ck('C4 editNum 7位+00', F.editNum('1234567', '00', false), '123456700')
  const u = makeInst(def); u.unitVal = '123456789012'; u.unitPad('.')
  ck('C4 unitPad 12字+.', u.unitVal, '123456789012')
  const u2 = makeInst(def); u2.unitVal = '12345678901'; u2.unitPad('00')
  ck('C4 unitPad 11字+00', u2.unitVal, '12345678901')
  const u3 = makeInst(def); u3.unitVal = '1234567890'; u3.unitPad('00')
  ck('C4 unitPad 10字+00', u3.unitVal, '123456789000')
}
// C5
{
  const i = makeInst(def); i.expr = '1'.repeat(60); i.lastAns = '7'; i.ansFull = '7'; i.pressKey('ans')
  ck('C5 60字+Ans', i.expr, '1'.repeat(60))
  const j = makeInst(def); j.expr = '1'.repeat(60); j.pressKey('neg')
  ck('C5 60字+±', j.expr, '1'.repeat(60))
  const k = makeInst(def); k.expr = '−(' + '1'.repeat(58) + ')'; k.pressKey('neg')
  ck('C5 60字包裹+±解包', k.expr, '1'.repeat(58))
  const m = makeInst(def); m.expr = '1'.repeat(60); m.pressKey('2')
  ck('C5 60字+数字仍拦', m.expr, '1'.repeat(60))
  const n = makeInst(def); n.expr = '1'.repeat(60); n.pressKey('C')
  ck('C5 60字+C仍可用', n.expr, '')
}
// C6
{
  const i = makeInst(def); i.pressKey('9'); i.pressKey('0'); i.pressKey('°'); i.pressKey('°')
  ck('C6 90°°', i.expr, '90°')
  const j = makeInst(def); j.pressKey('2'); j.pressKey('²'); j.pressKey('²')
  ck('C6 2²²不动', j.expr, '2²²')
  const k = makeInst(def); k.pressKey('5'); k.pressKey('0'); k.pressKey('%'); k.pressKey('%')
  ck('C6 50%%不动', k.expr, '50%%')
}
// C7（keyMatches 恒真桩）
{
  const d = loadPage(ux, { keyOk: true })
  const i = makeInst(d, true)
  i.unlocked = false; i.deviceId = '0123456789abcdeffedcba9876543210'
  i.openSolver('quad')
  ck('C7 未解锁点解方程进解锁页', i.view, 'unlock')
  i.keyInput = '1234567890'; i.confirmUnlock()
  ck('C7 解锁后直达 quad', i.view, 'quad')
  const j = makeInst(d, true)
  j.unlocked = false; j.deviceId = '0123456789abcdeffedcba9876543210'
  j.openSolver('sys')
  j.keyInput = '1234567890'; j.confirmUnlock()
  ck('C7 解锁后直达 sys', j.view, 'sys')
  const k = makeInst(d, true)
  k.unlocked = false; k.deviceId = '0123456789abcdeffedcba9876543210'
  k.goTools()
  k.keyInput = '1234567890'; k.confirmUnlock()
  ck('C7 解锁后直达 tools', k.view, 'tools')
  const m = makeInst(d, true)
  m.unlocked = false; m.deviceId = '0123456789abcdeffedcba9876543210'
  m.goUnlock()
  m.keyInput = '1234567890'; m.confirmUnlock()
  ck('C7 无目标解锁停在解锁页', m.view, 'unlock')
}
// F1
{
  const i = makeInst(def); i.unlocked = true
  i.qa = '1'; i.qb = '0'; i.qc = '-2'; i.openPlot('quad')
  ck('F1 图象交点行升序', i.plotLines.join('|').indexOf('与 x 轴交点 x = −√2、√2 ≈ 1.41') >= 0, true)
}
// F2
{
  const r = calc.solveQuad(0.3333333333, 0, -2)
  const s = F.rootsLine(r.x1, r.x2, F.quadRadStrs(0.3333333333, 0, -2, r.x1, r.x2))
  ck('F2 不精确系数交点行回落纯小数', s, '与 x 轴交点 x = −2.4495、2.4495')
  const r2 = calc.solveQuad(1, 0, -2)
  ck('F2 精确系数 √2 行不动', F.rootsLine(r2.x1, r2.x2, F.quadRadStrs(1, 0, -2, r2.x1, r2.x2)), '与 x 轴交点 x = −√2、√2 ≈ 1.41')
  const r3 = calc.solveQuad(2, -8, 2)
  ck('F2 精确系数 2±√3 行不动', F.rootsLine(r3.x1, r3.x2, F.quadRadStrs(2, -8, 2, r3.x1, r3.x2)), '与 x 轴交点 x = 2−√3、2+√3')
}
// F3/F4（主界面）
{
  const i = makeInst(def); i.expr = '1234567890123.5'; i.refreshCalc()
  ck('F4 大数主行保精确', i.resDisp, '≈ 1,234,567,890,124')
  i.fracOn = true; i.refreshCalc()
  ck('F3 大数分数用 =', i.resDisp, '= 2469135780247/2')
  const j = makeInst(def); j.expr = '9999999999999.5'; j.refreshCalc()
  ck('F4 大数2主行保精确', j.resDisp, '= 9,999,999,999,999.5')
  const k = makeInst(def); k.expr = '1÷3'; k.refreshCalc()
  ck('F4 1/3 仍 9 位小数', k.resDisp, '≈ 0.333333333')
  ck('F4 fitResStr(1/3,11)', F.fitResStr(1 / 3, 11), '0.333333333')
}
// F5/F6（tools2）
{
  ck('F5 fmtSide 1/512 用 =', F2.fmtSide(1 / 512).t, '1/512 = 0.001953125')
  ck('F5 fmtSide 5/2 用 =', F2.fmtSide(2.5).t, '5/2 = 2.5')
  ck('F5 fmtSide 1/3 用 ≈', F2.fmtSide(0.3333333334).t, '1/3 ≈ 0.333333333333')
  // 【1.6.0 第十六轮复审修订】fmtVal 改回 {t, exact} 结构（防近似值冒充精确），断言同步改查 t 与 exact。
  ck('F5 fmtVal 1/8 用 =', F2.fmtVal(1 / 8).t + '|exact=' + F2.fmtVal(1 / 8).exact, '1/8 = 0.125|exact=true')
  ck('F6 fmtSide 大整数无 e', F2.fmtSide(1.7179250691067045e47).t.indexOf('e+') < 0, true)
  ck('F6 fmtSide 大整数 ×10', F2.fmtSide(1.7179250691067045e47).t, '1.71792506911×10⁴⁷')
  ck('F6 fmtVal 大整数 ×10', F2.fmtVal(1.7179250691067045e47).t + '|exact=' + F2.fmtVal(1.7179250691067045e47).exact, '1.71792506911×10⁴⁷|exact=true')
  ck('F6 fmtSide 小整数原样', F2.fmtSide(123456).t, '123456')
  const s = makeInst(def2); s.sqa = '1'; s.sqx = '1/2'; s.sqn = '10'; s.sqKind = 'gp'; s.sqSolve()
  ck('F5 数列等比行用 =', JSON.stringify(s.sqLines), JSON.stringify(['第 10 项 = 1/512 = 0.001953125', '前 10 项和 = 1023/512 = 1.998046875']))
}
// F7（主界面）
{
  const i = makeInst(def); i.expr = '1e-15÷8.1'; i.refreshCalc()
  ckOk('F7 1e-15÷8.1 不再 ≈ 0', i.resDisp !== '≈ 0', i.resDisp)
  ck('F7 1e-15÷8.1 显示', i.resDisp, '≈ 1.234567901×10⁻¹⁶')
}
// F8
{
  const i = makeInst(def); i.ga = '94000000'; i.gb = '93999999'; i.gcdSolve()
  ck('F8 lcm 截断用 ≈', i.gLines, ['最大公约数 = 1', '最小公倍数 ≈ 8.83599991×10¹⁵'])
  const j = makeInst(def); j.ga = '12'; j.gb = '18'; j.gcdSolve()
  ck('F8 小 lcm 仍用 =', j.gLines, ['最大公约数 = 6', '最小公倍数 = 36'])
}
// F9
{
  const p = makeInst(def2); p.pmn = '30'; p.pmr = '15'; p.pmSolve()
  ck('F9 A(30,15) 缩短', p.pmLines[0], 'A(30,15) ≈ 2.028432049×10²⁰')
  ckOk('F9 A 行 ≤30 字', p.pmLines[0].length <= 30, p.pmLines[0].length)
  ck('F9 C(30,15) 不动', p.pmLines[1], 'C(30,15) = 155117520')
  const q = makeInst(def2); q.pmn = '5'; q.pmr = '2'; q.pmSolve()
  ck('F9 A(5,2) 不动', q.pmLines, ['A(5,2) = 20', 'C(5,2) = 10'])
}
// F10
{
  const i = makeInst(def); i.sqrtN = '72'; i.sqrtSolve()
  ck('F10 √72 12 位', i.sqrtLines, ['√72 = 6√2', '≈ 8.48528137424'])
  const j = makeInst(def); j.sqrtN = '2000000'; j.sqrtSolve()
  ck('F10 √2000000 12 位', j.sqrtLines, ['√2000000 = 1000√2', '≈ 1,414.21356237'])
}
// F11
{
  ck('F11 parseCoeff 1e21', F.parseCoeff('1e21'), 1e21)
  ck('F11 parseCoeff tools2 1e21', F2.parseCoeff('1e21'), 1e21)
  ck('F11 parseCoeff 2e 不动', F.parseCoeff('2e'), 2 * Math.E)
  ck('F11 parseCoeff e2 不动', F.parseCoeff('e2'), 2 * Math.E)
  ck('F11 parseCoeff 1.5e3', F.parseCoeff('1.5e3'), 1500)
  const i = makeInst(def); i.cr = '1e21'; i.circSolve()
  ckOk('F11 圆半径 1e21 周长 ×10', i.cLines.join('|').indexOf('×10') >= 0, i.cLines)
}
console.log('cd-verify: pass=' + pass + ' fail=' + fail)
if (fail) process.exit(1)
