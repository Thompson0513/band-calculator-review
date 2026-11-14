// calc-band 回归 + 边界审计测试（Node 直接跑：node tests/run-tests.js）
const fs = require('fs')
const path = require('path')

let pass = 0, fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++ }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? '-> ' + JSON.stringify(extra) : '') }
}
function eq(name, got, want) { ok(name, got === want, { got, want }) }
function approx(name, got, want, eps) { ok(name, Math.abs(got - want) < (eps || 1e-9), { got, want }) }
function throws(name, fn) { try { fn(); ok(name, false, 'did not throw') } catch (e) { ok(name, true) } }

// ---------- 加载 calc.js（ESM -> CJS 变换） ----------
const calcSrc = fs.readFileSync(path.join(__dirname, '../src/common/calc.js'), 'utf8')
  .replace('export default', 'module.exports =')
const calcMod = { exports: {} }
new Function('module', 'exports', calcSrc)(calcMod, calcMod.exports)
const calc = calcMod.exports
const E = (s, o) => calc.evaluate(s, o)

// ---------- 核心求值（1.2.2 已修项回归） ----------
approx('sin(30) 角度制', E('sin(30)'), 0.5)
approx('sin(-30)', E('sin(−30)'), -0.5)
approx('sin(30+15)', E('sin(30+15)'), Math.SQRT1_2)
approx('sin(2×30)', E('sin(2×30)'), 0.8660254038, 1e-9)
approx('sin(30°) 弧度标记', E('sin(30°)'), 0.5)
approx('sin(180) 归零', E('sin(180)'), 0)
approx('cos(60)', E('cos(60)'), 0.5)
approx('tan(45)', E('tan(45)'), 1)
throws('tan(90) 无意义', () => E('tan(90)'))
throws('log(0) 定义域', () => E('log(0)'))
throws('√(-1) 定义域', () => E('√(−1)'))
throws('1÷0', () => E('1÷0'))
eq('18! 精确', calc.formatPlain(E('18!')), '6402373705728000')
eq('3!', E('3!'), 6)
eq('0!', E('0!'), 1)
throws('(-1)! 定义域', () => E('(−1)!'))
throws('2.5! 定义域', () => E('2.5!'))
eq('1e-7 结果再入算', E('1e-7'), 1e-7)
eq('0.1+0.2', calc.formatPlain(E('0.1+0.2')), '0.3')
eq('10÷3×3', calc.formatPlain(E('10÷3×3')), '10')

// ---------- 边界审计（新增探针） ----------
eq('5%', E('5%'), 0.05)
eq('100+10%', E('100+10%'), 110)
eq('100−10%', E('100−10%'), 90)
eq('50×10%', E('50×10%'), 5)
eq('5%%', E('5%%'), 0.0005)
eq('2^3^2 右结合', E('2^3^2'), 512)
eq('-2^2 = -4', E('−2^2'), -4)
eq('(-2)^2 = 4', E('(−2)^2'), 4)
eq('(2+3)×(4+5)', E('(2+3)×(4+5)'), 45)
eq('√(9)+√(16)', E('√(9)+√(16)'), 7)
eq('log(1000)', E('log(1000)'), 3)
eq('abs(-5)', E('abs(−5)'), 5)
approx('5^0.5', E('5^0.5'), Math.sqrt(5))
eq('π 常量', calc.formatPlain(E('π')), '3.14159265359')
eq('千分位', calc.formatDisplay(1234567.891), '1,234,567.891')
eq('负数千分位', calc.formatDisplay(-1234.5), '-1,234.5')

// ---------- 分数/方程/换算/进制 ----------
eq('toFraction(1/3)', JSON.stringify(calc.toFraction(1 / 3)), JSON.stringify({ n: 1, d: 3 }))
eq('toFraction(π) 不冒充', calc.toFraction(Math.PI), null)
eq('toFraction(√2/2) 不冒充', calc.toFraction(Math.SQRT1_2), null)
eq('toFraction(0.3)', JSON.stringify(calc.toFraction(0.1 + 0.2)), JSON.stringify({ n: 3, d: 10 }))
const fc = calc.fracCalc(1, 2, '+', 1, 3)
ok('fracCalc 1/2+1/3=5/6', fc.n === 5 && fc.d === 6, fc)
const fc2 = calc.fracCalc(7, 4, '+', 0, 1)
ok('fracCalc 带分数', fc2.mixed && fc2.mixed.w === 1 && fc2.mixed.n === 3 && fc2.mixed.d === 4, fc2)
eq('二次重根 0.1', calc.formatDisplay(calc.solveQuad(1, -0.2, 0.01).x), '0.1')
eq('二次重根 3（界面显示值）', calc.formatDisplay(calc.solveQuad(0.1, -0.6, 0.9).x), '3')
eq('一次方程', calc.solveLinear(2, 3, 0, 7).x, 2)
const ss = calc.solveSystem(1, 1, 3, 1, -1, 1)
ok('方程组 x=2 y=1', ss.x === 2 && ss.y === 1, ss)
eq('1 公顷 = 15 亩', calc.convertUnit(2, 'ha', 'mu', 1), 15)
eq('100°C = 212°F', calc.convertUnit(3, 'c', 'f', 100), 212)
eq('0K = -273.15°C', calc.convertUnit(3, 'k', 'c', 0), -273.15)
eq('gcd/lcm', JSON.stringify(calc.gcdLcm(12, 18)), JSON.stringify({ gcd: 6, lcm: 36 }))
eq('√12 化简', JSON.stringify(calc.simplifySqrt(12)), JSON.stringify({ coef: 2, rad: 3, dec: Math.sqrt(12) }))
eq('FFFFFFFF 十进制', calc.baseConvert('FFFFFFFF', 16).dec, '4294967295')
ok('二进制含 2 报错', !!calc.baseConvert('2', 2).error)

// ---------- 页面层（提取 index.ux 的 script 做模拟） ----------
const ux = fs.readFileSync(path.join(__dirname, '../src/pages/index/index.ux'), 'utf8')
let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
const memStore = {}
globalThis.__storage = {
  get(o) { o.success(memStore[o.key] || '') },
  set(o) { memStore[o.key] = o.value }
}
globalThis.__vibrator = { vibrate() {} }
globalThis.__calc = calc
function loadEsm(p) {
  let s = fs.readFileSync(p, 'utf8').replace(/export function /g, 'function ')
  s += '\nmodule.exports = { normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches }'
  const m = { exports: {} }
  new Function('module', 'exports', s)(m, m.exports)
  return m.exports
}
const paykey = loadEsm(path.join(__dirname, '../src/common/paykey.js'))
const ppkey = loadEsm('/home/hatch/workspace/band-apps/pp-clean/src/common/key.js')
const MOCK_ID = '0123456789abcdeffedcba9876543210'
globalThis.__paykey = paykey
globalThis.__device = { getDeviceId(o) { o.success({ deviceId: MOCK_ID }) } }
script = script
  .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
  .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
  .replace("import device from '@system.device'", 'const device = globalThis.__device')
  .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
  .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
  .replace('export default', 'module.exports =')
const pageMod = { exports: {} }
new Function('module', 'exports', script)(pageMod, pageMod.exports)
const def = pageMod.exports
const inst = {}
Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
for (const k of Object.keys(def)) {
  if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
}
// data 里的函数型字段（plotVals 等对象）JSON 往返无碍；keys 数组完好
inst.onInit()

function type(str) { for (const ch of str) inst.pressKey(ch) }

// 历史过滤：真实计算才记
type('2+3'); inst.pressKey('eq')
eq('历史记 1 条', inst.hist.length, 1)
eq('历史内容', inst.hist[0].expr, '2+3')
ok('历史带时间', typeof inst.hist[0].time === 'string' && inst.hist[0].time.length >= 4, inst.hist[0])
inst.pressKey('eq') // 此时 expr 已是结果 5，纯数字按 = 不记
eq('纯数字 = 不记', inst.hist.length, 1)
type('9+1'); inst.pressKey('eq')
eq('第二条真实计算', inst.hist.length, 2)
eq('最新在前', inst.hist[0].expr, '9+1')
inst.pressKey('C'); type('9+1'); inst.pressKey('eq')
eq('与上一条相同不重复记', inst.hist.length, 2)
inst.pressKey('C'); type('36984455'); inst.pressKey('eq')
eq('长纯数字不记（照片里的垃圾记录）', inst.hist.length, 2)
inst.pressKey('C'); type('50%'); inst.pressKey('eq')
eq('50% 是真实计算要记', inst.hist.length, 3)
// 科学计数法纯数字按 = 不记（e+34 里的 + 不是运算符；真机照片里的两条垃圾记录就是这么来的）
inst.expr = '3.69844555555e+34'; inst.refreshCalc()
ok('科学计数纯数字可求值', inst.previewOk)
inst.pressKey('eq')
eq('e+34 纯数字不记', inst.hist.length, 3)
inst.expr = '1e-7'; inst.refreshCalc(); inst.pressKey('eq')
eq('e-7 纯数字不记', inst.hist.length, 3)
// 历史存 10 条 + 分页（每页 5 条）
for (let i = 1; i <= 7; i++) { inst.pressKey('C'); type('1+' + i); inst.pressKey('eq') }
eq('历史存满 10 条', inst.hist.length, 10)
eq('第一页 5 条', inst.histDisp.length, 5)
eq('有更早一页', inst.histHasOlder, true)
eq('页码 1/2', inst.histPageTxt, '1 / 2')
inst.histOlder()
eq('第二页 5 条', inst.histDisp.length, 5)
eq('第二页是最早的', inst.histDisp[4].expr, '2+3')
inst.histNewer()
eq('回到第一页', inst.histDisp[0].expr, '1+7')

// = 后输数字开新算式
inst.pressKey('C'); type('2+3'); inst.pressKey('eq'); inst.pressKey('4')
eq('= 后输数字开新算式', inst.expr, '4')

// onBackPress 逐级返回（在已解锁状态下测；锁定时 onBackPress 一律挡回解锁页，见收费段）
inst.unlocked = true
inst.view = 'frac'; eq('分数页返回->工具箱', inst.onBackPress() && inst.view, 'tools')
inst.view = 'unitpick'; inst.onBackPress(); eq('选单位->单位换算', inst.view, 'unit')
inst.view = 'lin'; inst.onBackPress(); eq('一次方程->解方程', inst.view, 'solvers')
inst.view = 'solvers'; inst.onBackPress(); eq('解方程->工具箱', inst.view, 'tools')
inst.view = 'tools'; inst.onBackPress(); eq('工具箱->主页', inst.view, 'calc')
inst.view = 'plot'; inst.plotBack = 'plotcfg'; inst.onBackPress(); eq('图象->设置页', inst.view, 'plotcfg')
inst.view = 'calc'; inst.padPage = 'sci'
ok('科学键盘返回先回主键盘', inst.onBackPress() === true && inst.padPage === 'main')
ok('主页返回放行退出', inst.onBackPress() === false)
inst.unlocked = false // 恢复锁定状态，后面的收费段从锁定开始测

// 各 pad 冒烟（不抛错即过）
try {
  inst.unitPad('5'); inst.basePad('A'); inst.linPad('5'); inst.quadPad('5')
  inst.sysPad('5'); inst.fracPad('5'); inst.sqrtPad('5'); inst.gcdPad('5'); inst.plotPad('5')
  ok('各工具 pad 冒烟', true)
} catch (e) { ok('各工具 pad 冒烟', false, e.message) }

// 分数求解仍正常
inst.fn1 = '1'; inst.fd1 = '26'; inst.fn2 = '1'; inst.fd2 = '36'; inst.fracSolve()
ok('分数 1/26+1/36', inst.fLines[0] === '= 31/468', inst.fLines)

// ---------- 图象坐标轴刻度（单位长度自动分档） ----------
// 图象信息行小数收敛（DP 4 位）：顶点坐标别再是一长串
inst.unlocked = true
inst.plotType = 'quad2'
inst.plotVals = { a: '63', b: '65', c: '-62' }
inst.drawPlot()
eq('drawPlot 打开图象页', inst.view, 'plot')
eq('顶点坐标只留 4 位小数', inst.plotLines[0], '顶点 (−0.5159, −78.7659)')
ok('x 范围按系数自动取 ±5（有 −5、无 −8）', inst.plotLabX.some(t => t.lab === '−5') && !inst.plotLabX.some(t => t.lab === '−8' || t.lab === '−6'), inst.plotLabX.map(t => t.lab))
inst.unlocked = false
inst.buildPlot({ f: function (x) { return x * x }, x0: -8, x1: 8, title: 't', keyPts: [], lines: [], back: 'tools' })
eq('x 刻度 ±8 每 2 一格（8 个）', inst.plotTickX.length, 8)
ok('x 标签含 −6 与 6', inst.plotLabX.some(t => t.lab === '−6') && inst.plotLabX.some(t => t.lab === '6'), inst.plotLabX.map(t => t.lab))
ok('原点有 0 标签', inst.plotLabX.some(t => t.lab === '0'))
eq('y 刻度每 10 一格（6 个）', inst.plotTickY.length, 6)
ok('y 标签含 60', inst.plotLabY.some(t => t.lab === '60'), inst.plotLabY.map(t => t.lab))
inst.buildPlot({ f: function (x) { return 156 * x * x }, x0: -4, x1: 4, title: 't', keyPts: [], lines: [], back: 'tools' })
ok('大函数 y 自动升档（标签含 2000）', inst.plotLabY.some(t => t.lab === '2000'), inst.plotLabY.map(t => t.lab))
inst.buildPlot({ f: function (x) { return Math.sin(x) }, x0: -3, x1: 3, title: 't', keyPts: [], lines: [], back: 'tools' })
ok('小函数 y 出现小数刻度', inst.plotLabY.some(t => t.lab.indexOf('.') >= 0), inst.plotLabY.map(t => t.lab))
inst.buildPlot({ f: function (x) { return x }, x0: -360, x1: 360, title: 't', keyPts: [], lines: [], back: 'tools' })
eq('角度范围 x 每 100 一格（6 个）', inst.plotTickX.length, 6)

// ---------- 收费系统：算法隔离（与乒乓不通用） ----------
const code = paykey.shortCodeForDevice(MOCK_ID)
const key = paykey.keyForShortCode(code)
ok('设备码 6 位', /^[0-9A-Z]{6}$/.test(code), code)
ok('密钥 10 位数字', /^[0-9]{10}$/.test(key), key)
ok('同设备结果稳定且自验通过', paykey.shortCodeForDevice(MOCK_ID) === code && paykey.keyMatches(MOCK_ID, key))
const ppCode = ppkey.shortCodeForDevice(MOCK_ID)
const ppKey = ppkey.keyForShortCode(ppCode)
ok('与乒乓设备码不同', ppCode !== code, { ppCode, code })
ok('与乒乓密钥不同', ppKey !== key)
ok('计算器拒绝乒乓密钥', !paykey.keyMatches(MOCK_ID, ppKey))
ok('乒乓拒绝计算器密钥', !ppkey.keyMatches(MOCK_ID, key))
const flipped = key.slice(0, 9) + (key[9] === '0' ? '1' : '0')
ok('密钥改一位数字被拒', !paykey.keyMatches(MOCK_ID, flipped))
ok('另一台设备的密钥被拒', !paykey.keyMatches(MOCK_ID, paykey.keyForShortCode(paykey.shortCodeForDevice('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))))
ok('空/短密钥被拒', !paykey.keyMatches(MOCK_ID, '') && !paykey.keyMatches(MOCK_ID, '12345'))
ok('设备码小写算出同一密钥', paykey.keyForShortCode(code.toLowerCase()) === key)
{
  const crypto = require('crypto')
  const seenK = new Set()
  for (let i = 0; i < 5000; i++) {
    const id = crypto.randomBytes(16).toString('hex')
    seenK.add(paykey.keyForShortCode(paykey.shortCodeForDevice(id)))
  }
  eq('5000 台随机设备密钥无重复', seenK.size, 5000)
}

// ---------- 收费系统：防逃单（页面层） ----------
eq('设备码显示与算法一致', inst.devCodeDisp, code.slice(0, 3) + ' ' + code.slice(3))
eq('初始为锁定状态', inst.unlocked, false)
const attempts = [
  ['openTool', 'unit'], ['openTool', 'base'], ['openTool', 'solvers'], ['openTool', 'plot'],
  ['openTool', 'frac'], ['openTool', 'sqrt'], ['openTool', 'gcd'], ['openTool', 'history'],
  ['openSolver', 'lin'], ['openSolver', 'quad'], ['openSolver', 'sys'],
  ['goSolvers'], ['openPlot', 'lin'], ['openPlot', 'quad'], ['drawPlot'],
  ['goTools'], ['openTools'], ['openHistory']
]
const escaped = []
for (const [m, a] of attempts) {
  inst.view = 'tools'
  if (a !== undefined) inst[m](a); else inst[m]()
  if (inst.view !== 'unlock') escaped.push(m + '(' + (a || '') + ')->' + inst.view)
}
ok('18 个高级入口全被锁挡住（免费版）', escaped.length === 0, escaped)
inst.view = 'calc'; inst.padPage = 'main'; inst.expr = ''
inst.pressKey('7'); ok('未解锁能用基础计算', inst.expr.indexOf('7') >= 0, inst.expr)
inst.pressKey('fx'); eq('未解锁点 fx 被挡到解锁页', inst.view, 'unlock')
inst.goCalc(); eq('解锁页能回基础计算', inst.view, 'calc')
// 免费版逃逸复扫：从唯一可达的 calc 页出发，所有入口最终只能落 calc/unlock
const esc2 = []
const attempts2 = [
  ['openTool', 'unit'], ['openTool', 'base'], ['openTool', 'solvers'], ['openTool', 'plot'],
  ['openTool', 'frac'], ['openTool', 'sqrt'], ['openTool', 'gcd'], ['openTool', 'history'],
  ['openSolver', 'lin'], ['openSolver', 'quad'], ['openSolver', 'sys'],
  ['goSolvers'], ['goTools'], ['openTools'], ['openHistory'], ['openPlot', 'lin'], ['openPlot', 'quad'],
  ['drawPlot'], ['pressKey', 'fx']
]
for (const [m, a] of attempts2) {
  inst.view = 'calc'; inst.padPage = 'main'
  inst[m](a)
  if (inst.view !== 'calc' && inst.view !== 'unlock') esc2.push(m + '(' + a + ')->' + inst.view)
  if (inst.padPage !== 'main') esc2.push(m + ' padPage->' + inst.padPage)
}
ok('从计算页出发 19 个高级入口无一逃逸', esc2.length === 0, esc2)
inst.view = 'calc'
inst.useHist({ expr: '1+1', res: '2' })
eq('点历史记录也进不去', inst.view, 'unlock')
inst.view = 'unlock'
function typeKey(k) { inst.keyInput = ''; for (const ch of k) inst.unPad(ch) }
typeKey(ppKey); inst.confirmUnlock()
eq('在 App 里输入乒乓密钥解不开', inst.unlocked, false)
ok('错钥有明确提示', inst.unlockMsg.indexOf('不对') >= 0, inst.unlockMsg)
typeKey('123456789'); inst.confirmUnlock()
ok('输 9 位提示还差几位', inst.unlockMsg.indexOf('还差') >= 0, inst.unlockMsg)
typeKey(key); inst.confirmUnlock()
eq('正确密钥解锁成功', inst.unlocked, true)
eq('存的是密钥本身（下次启动验真）', memStore['calc_key'], key)
inst.openTool('unit'); eq('解锁后单位换算可进', inst.view, 'unit')
inst.openSolver('lin'); eq('解锁后解方程可进', inst.view, 'lin')
inst.view = 'tools'; inst.openTool('plot'); eq('解锁后图象设置可进', inst.view, 'plotcfg')
inst.openTool('history'); eq('解锁后历史可进', inst.view, 'history')

// ---------- 收费系统：持久化与防篡改 ----------
function makeInst(deviceImpl, store) {
  let s = fs.readFileSync(path.join(__dirname, '../src/pages/index/index.ux'), 'utf8')
  s = s.slice(s.indexOf('<script>') + 8, s.indexOf('</script>'))
  globalThis.__storage = { get(o) { o.success(store[o.key] || '') }, set(o) { store[o.key] = o.value } }
  globalThis.__device = deviceImpl
  s = s.replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  const mm = { exports: {} }
  new Function('module', 'exports', s)(mm, mm.exports)
  const d = mm.exports
  const it = {}
  Object.assign(it, JSON.parse(JSON.stringify(d.data)))
  for (const k of Object.keys(d)) if (typeof d[k] === 'function') it[k] = d[k].bind(it)
  it.onInit()
  return it
}
const goodDevice = { getDeviceId(o) { o.success({ deviceId: MOCK_ID }) } }
eq('重启后凭存储密钥自动验真解锁', makeInst(goodDevice, { calc_key: key }).unlocked, true)
eq('存储里塞假密钥解不开', makeInst(goodDevice, { calc_key: '1234567890' }).unlocked, false)
eq('存储里塞乒乓密钥解不开', makeInst(goodDevice, { calc_key: ppKey }).unlocked, false)
const instL = makeInst(goodDevice, {})
eq('全新安装启动是基础计算页（免费版）', instL.view, 'calc')
instL.view = 'tools'
ok('锁定状态右滑逐级返回（免费版无强制墙）', instL.onBackPress() === true && instL.view === 'calc')
instL.view = 'unlock'
ok('解锁页右滑回基础计算（免费版）', instL.onBackPress() === true && instL.view === 'calc')
eq('有钥重启自动进计算器', makeInst(goodDevice, { calc_key: key }).view, 'calc')
const failDevice = { getDeviceId(o) { o.fail() } }
const storeF = {}
const instF = makeInst(failDevice, storeF)
ok('取不到硬件号时生成备用设备码', /^[0-9a-f]{32}$/.test(instF.deviceId), instF.deviceId)
ok('备用码已持久化', storeF['calc_devcode'] === instF.deviceId)
eq('备用码跨重启稳定', makeInst(failDevice, storeF).deviceId, instF.deviceId)

// ===== 1.4.1 修复：系数分数输入 =====
const instFr = makeInst(goodDevice, {})
instFr.view = 'lin'; instFr.lField = 'a'; instFr.la = ''
instFr.linPad('/'); eq('系数格空时不许打 /', instFr.la, '')
instFr.linPad('1'); instFr.linPad('/'); instFr.linPad('2'); eq('系数能打分数 1/2', instFr.la, '1/2')
instFr.linPad('/'); eq('第二个 / 被拒', instFr.la, '1/2')
instFr.linPad('.'); eq('分数里不许再打小数点', instFr.la, '1/2')
instFr.la = '1/0'; instFr.linPad('5'); eq('分母前导零被替换', instFr.la, '1/5')
instFr.la = '1/2'; instFr.lb = '0'; instFr.lc = '0'; instFr.ld = '1/4'; instFr.linSolve()
ok('分数系数方程 (1/2)x=1/4 解出 x=0.5', instFr.lLines.join(' ').indexOf('0.5') >= 0)
instFr.view = 'quad'; instFr.qa = '1/2'; instFr.qb = '0'; instFr.qc = '-1/8'; instFr.quadSolve()
ok('分数系数二次方程有实根 0.5', instFr.qLines.join(' ').indexOf('0.5') >= 0)
instFr.qa = '1/0'; instFr.quadSolve()
ok('分母为 0 的系数按未填处理', instFr.qLines.join(' ').indexOf('填') >= 0)
ok('系数键盘含 / 键且无 00 键', instFr.quadKeys.some(k => k.v === '/') && !instFr.quadKeys.some(k => k.v === '00'))

// ===== 1.4.1 修复：显示系统（不省略、全显、字号档） =====
const instD = makeInst(goodDevice, {})
instD.view = 'calc'; instD.padPage = 'main'
instD.expr = '1÷3'; instD.refreshCalc()
ok('长小数结果无省略号', instD.resDisp.indexOf('...') < 0 && instD.resDisp.indexOf('…') < 0)
eq('长小数结果按档缩字号', instD.resPx, 30)
instD.expr = '123456789×123456789'; instD.refreshCalc()
ok('大整数结果走科学计数且不超长', instD.resDisp.indexOf('e') >= 0 && instD.resDisp.length <= 20)
instD.expr = '2+3×4-5+6×7-8+9×1-2+3×4-5+6×7-8+9'; instD.refreshCalc()
eq('超长算式字号降到最小档', instD.exprPx, 15)
ok('超长算式显示末尾（刚打的看得见）', instD.exprDisp.length === 32 && instD.exprDisp.slice(-1) === '9')
instD.expr = ''; instD.refreshCalc(); eq('清空后表达式显示为空', instD.exprDisp, '')

// ===== 1.4.1 修复：样式撞名与缺字（静态核查） =====
ok('解锁页卡片已改名 un-card', ux.indexOf('class="un-card"') >= 0)
eq('样式里 .u-card 只剩工具页一份定义', (ux.match(/\.u-card \{/g) || []).length, 1)
ok('交换按钮无缺字符号', ux.indexOf('⇅') < 0)
ok('算式行绑定 exprDisp', ux.indexOf('{{exprDisp}}') >= 0)

// ===== 1.4.2：显示两行绝对定位钉死（静态核查） =====
ok('显示区为相对定位容器', ux.indexOf('position: relative') >= 0 && /\.disp \{[^}]*position: relative/.test(ux))
ok('算式行绝对定位', /\.expr \{[^}]*position: absolute/.test(ux))
ok('结果行绝对定位', /\.res-row \{[^}]*position: absolute/.test(ux))

// ===== 1.4.3：输入方程（自由输入） =====
const instEq = makeInst(goodDevice, {})
instEq.view = 'eqin'
const typeEq = (str) => { for (const ch of str) instEq.eqPad(ch === '^' ? '²' : ch) }
typeEq('2x+3=7'); eq('敲入 2x+3=7', instEq.eqExpr, '2x+3=7')
instEq.eqSolve(); ok('2x+3=7 解出 x=2', instEq.eqLines.join(' ').indexOf('x = 2') >= 0)
instEq.eqPad('C'); typeEq('x²-5x+6=0'.replace('²', '²'))
instEq.eqSolve(); ok('x²-5x+6=0 两根 3 与 2', instEq.eqLines.join(' ').indexOf('x1 = 3') >= 0 && instEq.eqLines.join(' ').indexOf('x2 = 2') >= 0)
instEq.eqPad('C'); typeEq('(1+2)²'); instEq.eqSolve()
ok('(1+2)² 纯算式算出 9', instEq.eqLines.join(' ').indexOf('= 9') >= 0)
instEq.eqPad('C'); typeEq('(x+1)²=4'); instEq.eqSolve()
ok('(x+1)²=4 解出 1 与 -3', instEq.eqLines.join(' ').indexOf('x1 = 1') >= 0 && instEq.eqLines.join(' ').indexOf('-3') >= 0)
instEq.eqPad('C'); typeEq('1/2x=1/4'.replace('1/4', '1/4')); instEq.eqSolve()
ok('分数系数 (1/2)x=1/4 解出 0.5', instEq.eqLines.join(' ').indexOf('0.5') >= 0)
instEq.eqPad('C'); typeEq('2x+'); instEq.eqPad('×'); eq('运算符连打替换', instEq.eqExpr, '2x×')
instEq.eqPad('C'); typeEq('x³=8'.replace('³', '²')); instEq.eqPad('x'); instEq.eqSolve()
ok('超范围方程给明确提示', instEq.eqLines.join(' ').indexOf('只支持') >= 0 || instEq.eqLines.join(' ').indexOf('x = ') >= 0)
instEq.eqPad('C'); typeEq('3+4=7'); instEq.eqSolve()
ok('无 x 带 = 判恒等', instEq.eqLines.join(' ').indexOf('恒等') >= 0)
instEq.eqPad('C'); typeEq('1/x=2'); instEq.eqSolve()
ok('x 在分母明确提示不支持', instEq.eqLines.join(' ').indexOf('只支持') >= 0)
instEq.eqPad('C'); typeEq('x/2=3'); instEq.eqSolve()
ok('x/2=3 解出 x=6', instEq.eqLines.join(' ').indexOf('x = 6') >= 0)

// ===== 1.4.4：输入方程改进（白底键/²/乘号中点/y 方程组/判别式） =====
const instEq2 = makeInst(goodDevice, {})
instEq2.view = 'eqin'
const k2 = (v) => instEq2.eqKeys.find(k => k.v === v)
eq('平方键只写 ²', k2('²').label, '²')
ok('有 y 键、无 ÷ 键', !!k2('y') && !k2('÷'))
ok('乘号键是叉形 ×、无中点键', !!k2('×') && !k2('·'))
ok('x、y 键标记斜体', k2('x').it === true && k2('y').it === true)
ok('² 键带右上偏移类', k2('²').kcls === 'eqsup-k')
eq('输入框字符数组与表达式同步', instEq2.eqChars1.join(''), instEq2.eqExpr)
ok('模板含逐字渲染与真斜体字形图', ux.indexOf('eq-chars') >= 0 && ux.indexOf('/common/glyphs/x-dark.png') >= 0 && ux.indexOf('/common/glyphs/y-dark.png') >= 0)
const type2 = (str) => { for (const ch of str) instEq2.eqPad(ch) }
type2('x²-5x+6=0'.replace('²', '²')); instEq2.eqSolve()
ok('二次方程带判别式行', instEq2.eqLines.join(' ').indexOf('判别式 Δ = 1 > 0') >= 0)
instEq2.eqPad('C'); type2('x+y=3')
eq('敲出 y 后第二框出现', instEq2.eqShow2, true)
instEq2.setEqFocus(2); type2('x-y=1'); instEq2.eqSolve()
ok('方程组 x+y=3、x-y=1 解出 x=2 y=1', instEq2.eqLines.join(' ').indexOf('x = 2') >= 0 && instEq2.eqLines.join(' ').indexOf('y = 1') >= 0)
instEq2.eqPad('C'); instEq2.setEqFocus(1); instEq2.eqPad('C'); type2('x+y=1')
instEq2.setEqFocus(2); type2('x-y=0'); instEq2.eqSolve()
ok('方程组分数解带分数形式', instEq2.eqLines.join(' ').indexOf('1/2') >= 0)
instEq2.eqPad('C'); instEq2.setEqFocus(1); instEq2.eqPad('C'); type2('x²+y=2')
instEq2.setEqFocus(2); type2('x+y=1'); instEq2.eqSolve()
ok('带平方的方程组明确不支持', instEq2.eqLines.join(' ').indexOf('只支持二元一次') >= 0 || instEq2.eqLines.join(' ').indexOf('只支持') >= 0)
ok('模板已无 key-eq 撞名键类', ux.indexOf('key-num key-eq') < 0 && ux.indexOf('eqkey') >= 0)

// ===== 1.4.6：近似值用 ≈、精确值用 = =====
eq('eqSign 精确值', calc.eqSign(0.5), '=')
eq('eqSign 三分之一', calc.eqSign(1 / 3), '≈')
eq('eqSign 小数精确运算 0.1+0.2', calc.eqSign(0.1 + 0.2), '=')
eq('eqSign √2 仍为近似', calc.eqSign(Math.sqrt(2)), '≈')
eq('eqSign sin30 抹平噪声后精确', calc.eqSign(Math.sin(Math.PI / 6)), '=')
const instA = makeInst(goodDevice, {})
instA.view = 'calc'; instA.padPage = 'main'
instA.expr = '1÷3'; instA.refreshCalc()
ok('主屏 1÷3 显示 ≈', instA.resDisp.indexOf('≈') === 0)
instA.expr = '1÷4'; instA.refreshCalc()
ok('主屏 1÷4 显示 =', instA.resDisp.indexOf('=') === 0)
instA.expr = 'x'; instA.refreshCalc()
const instQ = makeInst(goodDevice, {})
instQ.view = 'eqin'; instQ.eqExpr = 'x²=2'; instQ.eqChars1 = instQ.eqExpr.split(''); instQ.eqSolve()
ok('输入方程 x²=2 给根式精确形且小数带 ≈', instQ.eqLines.join(' ').indexOf('x1 = √2') >= 0 && instQ.eqLines.join(' ').indexOf('≈') >= 0)

// ===== 1.4.8：按 = 后只显示结果行，不再上下两行重复 =====
const instE = makeInst(goodDevice, {})
instE.view = 'calc'; instE.padPage = 'main'
instE.expr = '0.1+0.2'; instE.refreshCalc(); instE.pressKey('eq')
eq('按=后算式行清空', instE.exprDisp, '')
eq('按=后只剩结果行 = 0.3', instE.resDisp, '= 0.3')
instE.pressKey('5')
ok('按=后敲数字重新开始且算式行恢复', instE.exprDisp.length > 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
