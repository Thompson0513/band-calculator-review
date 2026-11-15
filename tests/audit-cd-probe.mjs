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

// ---- C1 ----
{
  const i = makeInst(def)
  i.pressKey('2'); i.pressKey('.'); i.pressKey('π')
  show('C1 主键盘 2 . π expr', i.expr)
  show('C1 主键盘 2 . π resDisp', i.resDisp)
  const j = makeInst(def)
  j.pressKey('2'); j.pressKey('.'); j.pressKey('e')
  show('C1 主键盘 2 . e expr', j.expr)
  const k = makeInst(def)
  k.pressKey('2'); k.pressKey('.'); k.pressKey('sin(')
  show('C1 主键盘 2 . sin( expr', k.expr)
  const e = makeInst(def)
  e.eqFocus = 1; e.eqExpr = ''; e.eqPad('2'); e.eqPad('.'); e.eqPad('π')
  show('C1 方程页 2 . π eqExpr', e.eqExpr)
}
// ---- C2 ----
{
  const e = makeInst(def)
  e.eqFocus = 1; e.eqExpr = ''
  for (const v of ['5', '0', '%', '.', '5']) e.eqPad(v)
  show('C2 方程页 50%.5 eqExpr', e.eqExpr)
  const e2 = makeInst(def)
  e2.eqFocus = 1; e2.eqExpr = ''
  for (const v of ['9', '0', '°', '.']) e2.eqPad(v)
  show('C2 方程页 90°. eqExpr', e2.eqExpr)
}
// ---- C3 ----
{
  const e = makeInst(def)
  e.eqFocus = 1; e.eqExpr = ''
  for (const v of ['5', '0', '%', '%']) e.eqPad(v)
  show('C3 方程页 50%% eqExpr', e.eqExpr)
  const i = makeInst(def)
  i.pressKey('5'); i.pressKey('0'); i.pressKey('%'); i.pressKey('%')
  show('C3 主键盘 50%% expr/resDisp', i.expr + ' | ' + i.resDisp)
}
// ---- C4 ----
{
  const ec = F.editCoeff
  show('C4 系数格 20字+. ', JSON.stringify(ec('12345678901234567890', '.')) + ' len=' + ec('12345678901234567890', '.').length)
  show('C4 系数格 20字+/ ', JSON.stringify(ec('12345678901234567890', '/')) + ' len=' + ec('12345678901234567890', '/').length)
  show('C4 系数格 20字+± ', JSON.stringify(ec('12345678901234567890', 'neg')) + ' len=' + ec('12345678901234567890', 'neg').length)
  show('C4 系数格 19字+√ ', JSON.stringify(ec('1234567890123456789', 'sqrt')) + ' len=' + ec('1234567890123456789', 'sqrt').length)
  show('C4 editNum 8位+00 ', JSON.stringify(F.editNum('12345678', '00', false)) + ' len=' + F.editNum('12345678', '00', false).length)
  const i = makeInst(def)
  i.unitVal = '123456789012'
  i.unitPad('.')
  show('C4 单位换算 12字+. unitVal', i.unitVal + ' len=' + i.unitVal.length)
  const i2 = makeInst(def)
  i2.unitVal = '12345678901'
  i2.unitPad('00')
  show('C4 单位换算 11字+00 unitVal', i2.unitVal + ' len=' + i2.unitVal.length)
}
// ---- C5 ----
{
  const i = makeInst(def)
  i.expr = '1'.repeat(60)
  i.lastAns = '7'
  i.ansFull = '7'
  i.pressKey('ans')
  show('C5 60字+Ans expr len', i.expr.length)
  const j = makeInst(def)
  j.expr = '1'.repeat(60)
  j.pressKey('neg')
  show('C5 60字+± expr len', j.expr.length)
  const k = makeInst(def)
  k.expr = '1'.repeat(60)
  k.pressKey('2')
  show('C5 60字+数字 expr len', k.expr.length)
}
// ---- C6 ----
{
  const i = makeInst(def)
  i.pressKey('9'); i.pressKey('0'); i.pressKey('°'); i.pressKey('°')
  show('C6 主键盘 90°° expr/resDisp', i.expr + ' | ' + i.resDisp)
}
// ---- C7 ----
{
  const d = loadPage(ux, { keyOk: true })
  const i = {}
  Object.assign(i, JSON.parse(JSON.stringify(d.data)))
  for (const k of Object.keys(d)) if (typeof d[k] === 'function') i[k] = d[k].bind(i)
  i.onInit()
  i.unlocked = false
  i.openSolver('quad')
  show('C7 未解锁点二次方程后 view', i.view)
  i.deviceId = '0123456789abcdeffedcba9876543210'
  i.keyInput = '1234567890'
  i.confirmUnlock()
  show('C7 解锁成功后 unlocked/view', i.unlocked + ' / ' + i.view)
}
// ---- F1/F2 ----
{
  const rr1 = Math.SQRT2, rr2 = -Math.SQRT2
  show('F1 绘图交点行 x²-2', F.rootsLine(rr1, rr2, F.quadRadStrs(1, 0, -2, rr1, rr2)))
  const a = 0.3333333333, disc = 0 - 4 * a * -2
  const sq = Math.sqrt(disc)
  const r1 = (-0 + sq) / (2 * a), r2 = (-0 - sq) / (2 * a)
  show('F2 绘图交点行 a=0.3333333333', F.rootsLine(r1, r2, F.quadRadStrs(a, 0, -2, r1, r2)))
  show('F2 linePx(该行)', F.linePx(F.rootsLine(r1, r2, F.quadRadStrs(a, 0, -2, r1, r2))))
}
// ---- F3 ----
{
  const v = 1234567890123.5
  const fr = calc.toFraction(v)
  show('F3 toFraction(1234567890123.5)', fr)
  show('F3 fracIsExact', calc.fracIsExact(v, fr))
  const i = makeInst(def)
  i.expr = '1234567890123.5'; i.refreshCalc()
  show('F3 直播 resDisp', i.resDisp)
  i.fracOn = true; i.refreshCalc()
  show('F3 点看分数后 resDisp', i.resDisp)
}
// ---- F4 ----
{
  const i = makeInst(def)
  i.expr = '1234567890123.5'; i.refreshCalc()
  show('F4 直播 resDisp', i.resDisp)
  i.pressKey('eq')
  show('F4 按=后 resDisp/expr', i.resDisp + ' | expr=' + i.expr)
  const j = makeInst(def)
  j.expr = '9999999999999.5'; j.refreshCalc()
  show('F4 9999999999999.5 直播 resDisp', j.resDisp)
  show('F4 fitResStr(1234567890123.5,11)', F.fitResStr(1234567890123.5, 11))
  show('F4 fitResStr(1/3,11)', F.fitResStr(1 / 3, 11))
}
// ---- F5/F6/F9 ----
{
  const i2 = makeInst(def2)
  i2.sqKind = 'gp'; i2.sqa = '1'; i2.sqx = '1/2'; i2.sqn = '10'; i2.sqSolve()
  show('F5 等比 a1=1 q=1/2 n=10 sqLines', i2.sqLines)
  const r = makeInst(def2)
  r.rtc = '5'; r.rtA = '30'; r.rtSolve()
  show('F5 直角 c=5 A=30 rtLines', r.rtLines)
  const g = makeInst(def2)
  g.sqKind = 'gp'; g.sqa = '1'; g.sqx = '3'; g.sqn = '100'; g.sqSolve()
  show('F6 等比 a1=1 q=3 n=100 sqLines', g.sqLines)
  const l = makeInst(def2)
  l.lwa = '1' + '0'.repeat(100); l.lwb = '1' + '0'.repeat(100); l.lwc = '1' + '0'.repeat(100); l.lwSolve()
  show('F6 正余弦 SSS 1e100 lwLines', l.lwLines)
  const p = makeInst(def2)
  p.pmn = '30'; p.pmr = '15'; p.pmSolve()
  show('F9 排列 A(30,15) pmLines', p.pmLines)
  show('F9 A行长度', p.pmLines[0].length)
}
// ---- F7 ----
{
  const v = 1e-15 / 8.1
  show('F7 formatDisplay(1e-15÷8.1)', calc.formatDisplay(v))
  show('F7 真值', v)
  const i = makeInst(def)
  i.expr = '1e-15÷8.1'; i.refreshCalc()
  show('F7 主界面直播 resDisp', i.resDisp)
  show('F7 对照 formatDisplay(1e-16÷8.1)', calc.formatDisplay(1e-16 / 8.1))
}
// ---- F8 ----
{
  const i = makeInst(def)
  i.ga = '94000000'; i.gb = '93999999'; i.gcdSolve()
  show('F8 公约数 gLines', i.gLines)
  show('F8 真 lcm', 94000000 * 93999999 / 4)
  const j = makeInst(def)
  j.ga = '12345678'; j.gb = '87654321'; j.gcdSolve()
  show('F8 例2 gLines', j.gLines)
}
// ---- F10 ----
{
  const i = makeInst(def)
  i.sqrtN = '72'; i.sqrtSolve()
  show('F10 根号72 sqrtLines', i.sqrtLines)
  const j = makeInst(def)
  j.sqrtN = '2000000'; j.sqrtSolve()
  show('F10 根号2000000 sqrtLines', j.sqrtLines)
}
// ---- F11 ----
{
  show('F11 parseCoeff(1e21)', F.parseCoeff('1e21'))
  show('F11 coeffSrc(1e21)', F.coeffSrc('1e21'))
  const i = makeInst(def)
  i.cr = '1e21'; i.circSolve()
  show('F11 圆页 r=1e21 cLines', i.cLines)
  const j = makeInst(def)
  j.cr = '10000000000'; j.circSolve()
  show('F11 圆页 r=1e10 cLines', j.cLines)
}
// ---- regression-1.5.4:163 钉死的绘图行 ----
{
  const uxReg = readFileSync(new URL('./regression-1.5.4.mjs', import.meta.url), 'utf8')
  const lines = uxReg.split('\n')
  console.log('1.5.4:163 =>', lines[162])
}
console.log('PROBE DONE')
