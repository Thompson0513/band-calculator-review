// 回归测试 1.5.14：ChatGPT 第十份报告（对 1.5.13 的独立复审）逐项实跑核实后的修复
// 十二项 A–L 全部实跑复现、全部属实，另修报告 §三观察项一条（分数小数行连接号）；
// §三其余两条（进制页输入位数上限、单位换算带回的过程式用 12 位系数）属页面
// 定版取舍，不改，在第十一轮说明里声明口径。本轮自攻（按报告打法对每项修复再
// 生成等价变形/量级梯子/链式组合变体）另发现并处理：整数链污染的精确湮灭需分辨
// 污染来源（假 0 当乘数不清、真 0 当乘数可清），见 A 组。
// A. 大整数保护被连续运算绕过：1e21+1−1e21 旧版给 0（真值 1）。根因：1.5.13 的
//    守卫只拦中间结果 <1e21 的步，≥1e21 的步直接豁免、误差被带回精确区。修复：
//    ≥1e21 的整数舍入改记「链污染」，最终结果回到 <1e21 时统一结算报错；
//    ×0/^0 等结果与被污染操作数无关的精确湮灭按操作数自身干净程度清除，
//    加减不清除（3^50+1−3^50 与 3^50−3^50 双精度下不可区分，宁拒不装精确）。
// B. 常数等式零容差误判：0=1e-17 旧版判恒等式（6e-17 一律吸收）。修复：两边
//    都是单个数字字面量时按值全等比；含运算的式子才走 ulp/尾巴容差。
// C. 方程组大常数下 xy 漏检：x+1e-8xy=1e9 与 y=1 旧版误判一次方程组给假解。
//    根因：coef 逐点容差 16·EPSILON·Sside·(1+|x|+|y|) 被大常数撑宽（(512,512)
//    处达 3.6，吞掉 0.0026 的交叉项偏差）。修复：容差改按预测式各项量级＋
//    系数推导尺度折算，交叉项现形、正确报「只支持二元一次」。
// D. tan 大角度 ° 后缀绕过奇点：tan(90000090°) 旧版给 5.8e9。根因：° 路径先
//    换算弧度再用 1e-13 容差判奇点，大角度换算误差漏检。修复：° 换算前先
//    % 360 精确归约，rad 恰落 π/2 奇数倍、判据命中。
// E. sin/cos 大角度精度崩坏：sin(3600000000000°)、sin(9007199254740991°) 旧版
//    分别给 3.15e-6 与 0.5009（真值 0 与 sin31°）。修复：角度制先 % 360 精确
//    归约再换算（% 对任意大整数角度精确，小角度路径逐位不变）。
// F. 按等号后链式计算掉精度：10÷3 按 = 再 ×3 旧版得 9.99999999999（一次输完
//    得 10）。根因：接力把结果截成 12 位文本再当输入。修复：接力/Ans/历史回算
//    一律用原始双精度值回读串（历史记录新增 rf 字段，旧记录回退显示文本）。
// G. 一元一次小系数大常数漏解：1e-15x=1e9 旧版报无解（真根 1e24）。根因：x 项
//    在全部探针尺度（≤2^24）上的贡献小于大常数的 ulp 噪声。修复：识别为
//    「与 x 无关」且常数非零时往 1e30/1e100 极端尺度救援——呈一次型的估 b
//    求根、呈高次型的如实报不支持、毫无变化（x 真约掉）才维持无解。
// H. 极大顶点抛物线绘图变水平线：a=0.001、b=999999999 时 91 点纵坐标全同。
//    根因有二：窗口内变化量低于该量级双精度分辨率；纵轴又强行纳入 0 把范围
//    拉到 2.5e20。修复：纵向扁平（≤8·EPSILON·量级）时以窗口中心逐级 ×8 扩窗
//    再探；强行纳入 0 改为仅当 0 离数据范围 ≤4 倍跨度时。真常数函数照原样画。
// I. 自然常数 e 的历史漏记：e+1、e−1 旧版不记历史（e×2 记）。根因：
//    isRealCalc 无条件剥 e±数字，把常数 e 的加减误当科学计数法指数。修复：
//    只剥「数字后跟 e」的科学计数法。
// J. 溢出显示状态不一致：0^−1、1e308×10 旧版 resDisp=「≈ 溢出」且 previewOk
//    （正常结果色），按 = 又被拒。修复：求值出 Infinity 按错误状态处理
//    （previewOk=false、resDisp=「溢出」）；1.5.8 的旧断言随之修订。
// K. 小数科学计数法绕过整数检查：900719925474099.3e1 旧版静默给 …992。根因：
//    intDigitsOf 见小数部分含非零数字直接放行。修复：intDigitsOf 改按小数点
//    位置统一移位，移位后是整数的都规整出数字串照查。连带口径修订：1.5.11
//    曾豁免的 9.007…e15、1.0000000000000005e16 与 K 同形（≤21 位整数声称），
//    豁免线改按总位数划，旧断言已在 regression-1.5.11 修订。
// L. 极端指数解析异常：1e999999999 旧版抛 Invalid string length。根因：
//    intDigitsOf 按指数 '0'.repeat 构造极长串。修复：|exp|>400 先挡（值必
//    然溢出/下溢，交回普通求值：页面显示「溢出」/0）。
import { readFileSync } from 'fs'
import calc from '../src/common/calc.js'

let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL:', name) } }
function eq(name, got, want) { ok(name + '（got=' + JSON.stringify(got) + '）', got === want) }
function throws(name, fn) { try { fn(); ok(name, false) } catch (e) { ok(name, true) } }
const E = (s, o) => calc.evaluate(s, o)

// ---------- 页面实例 harness（与 1.5.11 同法） ----------
const ux = readFileSync(new URL('../src/pages/index/index.ux', import.meta.url), 'utf8')
function loadEsmText(src, names) {
  let s = src.replace(/export function /g, 'function ')
  s += '\nmodule.exports = { ' + names + '}'
  const m = { exports: {} }
  new Function('module', 'exports', s)(m, m.exports)
  return m.exports
}
// [审查仓适配] paykey.js 未公开：缺失时用惰性桩满足页面 harness 拼装；本文件断言不涉及付费校验行为，桩不影响结果。本地原版无此回退。
let paykeyMod
try { paykeyMod = loadEsmText(readFileSync(new URL('../src/common/paykey.js', import.meta.url), 'utf8'), 'normalizeDeviceId, normalizeCode, shortCodeForDevice, keyForShortCode, keyMatches') } catch (e) { paykeyMod = { normalizeDeviceId: (s) => String(s == null ? '' : s).toUpperCase(), normalizeCode: (s) => String(s == null ? '' : s), shortCodeForDevice: () => 'AAAAAA', keyForShortCode: () => '0000000000', keyMatches: () => false } }
function loadPage(storageImpl) {
  let script = ux.slice(ux.indexOf('<script>') + 8, ux.indexOf('</script>'))
  globalThis.__storage = storageImpl
  globalThis.__vibrator = { vibrate() {} }
  globalThis.__device = { getDeviceId(o) { o.success({ deviceId: '0123456789abcdeffedcba9876543210' }) } }
  globalThis.__router = { push() {}, back() {} }
  globalThis.__calc = calc
  globalThis.__paykey = paykeyMod
  script = script
    .replace("import storage from '@system.storage'", 'const storage = globalThis.__storage')
    .replace("import vibrator from '@system.vibrator'", 'const vibrator = globalThis.__vibrator')
    .replace("import device from '@system.device'", 'const device = globalThis.__device')
    .replace("import router from '@system.router'", 'const router = globalThis.__router')
    .replace("import calc from '../../common/calc'", 'const calc = globalThis.__calc')
    .replace("import { keyMatches, normalizeDeviceId, shortCodeForDevice } from '../../common/paykey'", 'const { keyMatches, normalizeDeviceId, shortCodeForDevice } = globalThis.__paykey')
    .replace('export default', 'module.exports =')
  const pageMod = { exports: {} }
  new Function('module', 'exports', script)(pageMod, pageMod.exports)
  return pageMod.exports
}
const memStore = {}
const def = loadPage({ get(o) { o.success(memStore[o.key] || '') }, set(o) { memStore[o.key] = o.value } })
function makeInst() {
  const inst = {}
  Object.assign(inst, JSON.parse(JSON.stringify(def.data)))
  for (const k of Object.keys(def)) if (typeof def[k] === 'function') inst[k] = def[k].bind(inst)
  inst.onInit()
  return inst
}
function eqSolveLines(e1, e2) {
  const inst = makeInst()
  inst.eqExpr = e1; inst.eqExpr2 = e2 || ''
  inst.eqSolve()
  return inst.eqLines
}
function feedCalc(expr, fracOn) {
  const i = makeInst()
  i.expr = expr; i.refreshCalc()
  if (fracOn) { i.fracOn = true; i.refreshCalc() }
  return i
}

// ---------- A. 整数链污染结算 ----------
throws('A1 1e21+1−1e21 不再静默给 0', () => E('1000000000000000000000+1-1000000000000000000000'))
throws('A2 假 0 再 ×5 同样结算（真值 5）', () => E('(1000000000000000000000+1-1000000000000000000000)×5'))
throws('A3 3^50+1−3^50 结算报错（真值 1）', () => E('3^50+1-3^50'))
throws('A4 3^50−3^50 既定边界：与 A3 双精度下不可区分、宁拒不装精确', () => E('3^50-3^50'))
eq('A5 真 0 当乘数可湮灭污染', E('(1000000000000000000000+1)×0'), 0)
eq('A6 0×污染链结果恒 0', E('0×(1000000000000000000000+1)'), 0)
eq('A7 污染底数 ^0 恒 1', E('(3^50)^0'), 1)
eq('A8 中间步本身在 ≥1e21 区不拦（浮点惯例）', String(E('1000000000000000000000+1')), '1e+21')
eq('A9 10^30 照常放行', String(E('10^30')), '1e+30')
ok('A10 页面文案', feedCalc('1000000000000000000000+1-1000000000000000000000').resDisp.indexOf('整数超出精确范围') >= 0)

// ---------- B. 常数等式字面量全等 ----------
eq('B1 0=1e-17 不再误判恒等式', eqSolveLines('0=0.00000000000000001')[0], '两边不相等')
eq('B2 1e-17=0 同理', eqSolveLines('0.00000000000000001=0')[0], '两边不相等')
eq('B3 0=0 仍恒等', eqSolveLines('0=0')[0], '两边相等：恒等式')
eq('B4 5=5.0 字面量全等仍恒等', eqSolveLines('5=5.0')[0], '两边相等：恒等式')
eq('B5 守卫：0.1+0.2=0.3 含运算走容差、仍恒等', eqSolveLines('0.1+0.2=0.3')[0], '两边相等：恒等式')
eq('B6 守卫：0.1+0.2-0.3=0 相消尾巴仍吸收', eqSolveLines('0.1+0.2-0.3=0')[0], '两边相等：恒等式')
eq('B7 守卫：1e16 与 10000000000000010 仍判不等', eqSolveLines('1e16=10000000000000010')[0], '两边不相等')

// ---------- C. 方程组大常数 xy 漏检 ----------
eq('C1 x+1e-8xy=1e9 与 y=1 不再误判一次方程组', eqSolveLines('x+0.00000001xy=1000000000', 'y=1')[0], '方程组只支持二元一次')
eq('C2 守卫：第九轮 x+1e-10xy=0 与 x=1 仍拦截', eqSolveLines('x+0.0000000001xy=0', 'x=1')[0], '方程组只支持二元一次')
ok('C3 守卫：0.1x+0.1y=1e9 与 x-y=0 仍可解（≈ 5e9）', eqSolveLines('0.1x+0.1y=1000000000', 'x-y=0')[0].indexOf('4,999,999,999') >= 0)
eq('C4 守卫：普通方程组照常', eqSolveLines('2x+3y=8', 'x-y=1')[0], 'x = 11/5 = 2.2')

// ---------- D. tan 大角度 ° 奇点 ----------
throws('D1 tan(90000090°) 现报无定义', () => E('tan(90000090°)'))
throws('D2 tan(270°) 现报无定义', () => E('tan(270°)'))
throws('D3 守卫：tan(90000090) 裸角度本就报无定义', () => E('tan(90000090)'))
ok('D4 守卫：tan(89.9999999999°) 合法大值不误伤', E('tan(89.9999999999°)') > 1e11)

// ---------- E. sin/cos 大角度归约 ----------
eq('E1 sin(3600000000000°) = 0', String(E('sin(3600000000000°)')), '0')
eq('E2 cos(3600000000000°) = 1', String(E('cos(3600000000000°)')), '1')
ok('E3 sin(9007199254740991°) = sin31°', Math.abs(E('sin(9007199254740991)') - 0.515038074910054) < 1e-12)
eq('E4 sin(180000090°) = 1', String(E('sin(180000090)')), '1')
ok('E5 守卫：sin(30°) 小角度路径不变', Math.abs(E('sin(30)') - 0.5) < 1e-15)
ok('E6 守卫：sin(180°) 尾巴仍在（清理层处理）', Math.abs(E('sin(180°)') - 1.2246467991473532e-16) < 1e-28)

// ---------- F. 按等号后全精度接力 ----------
{
  const i = feedCalc('10÷3')
  i.pressKey('eq')
  eq('F1 按 = 后算式是全精度回读串', i.expr, '3.3333333333333335')
  i.pressKey('×'); i.pressKey('3')
  eq('F2 10÷3 = 后 ×3 得 10', i.resDisp, '= 10')
}
{
  const i = feedCalc('2÷3')
  i.pressKey('eq'); i.pressKey('×'); i.pressKey('3')
  eq('F3 2÷3 = 后 ×3 得 2', i.resDisp, '= 2')
}
{
  const i = feedCalc('10÷3')
  i.pressKey('eq'); i.pressKey('C'); i.pressKey('ans'); i.pressKey('×'); i.pressKey('3')
  eq('F4 Ans 键同样全精度', i.resDisp, '= 10')
}
{
  const i = feedCalc('10÷3')
  i.pressKey('eq')
  eq('F5 历史记录带全精度 rf', i.hist[0].rf, '3.3333333333333335')
  i.useHist(i.hist[0])
  eq('F6 点历史回算用全精度值', i.previewVal, 10 / 3)
}
{
  const i = feedCalc('10÷3')
  i.pressKey('eq')
  const j = makeInst() // 模拟重启：新实例从存储重新 loadHist
  eq('F7 rf 经保存/加载往返不丢（loadHist 重组曾漏带，自攻抓到）', j.hist[0].rf, '3.3333333333333335')
}

// ---------- G. 极端尺度救援 ----------
eq('G1 1e-15x=1e9 现给根 1e24', eqSolveLines('0.000000000000001x=1000000000')[1], 'x = 1×10²⁴') // 1.5.17 修订：课本式
eq('G2 守卫：x-x=5 里 x 真约掉、维持无解', eqSolveLines('x-x=5')[1], '方程无解')
eq('G3 sin(x)=1e9 给如实的不支持（不再假拟合无解）', eqSolveLines('sin(x)=1000000000')[0], '只支持一元一次 / 二次方程')
ok('G4 1e-20x²=1e9 多尺度可解、不报无解', eqSolveLines('0.00000000000000000001x²=1000000000').join('').indexOf('无解') < 0)
eq('G5 守卫：普通一次方程照常', eqSolveLines('2x=8')[1], 'x = 4')

// ---------- H. 绘图扁平失真 ----------
{
  const i = makeInst(); i.unlocked = true
  i.plotType = 'quad2'; i.plotVals = { a: '0.001', b: '999999999', c: '0', k: '1', A: '1' }
  i.drawPlot()
  ok('H1 极大顶点抛物线不再是水平线（纵向像素 ≥10 种）', new Set(i.plotPts.map(p => p.t)).size >= 10)
}
{
  const i = makeInst(); i.unlocked = true
  i.plotType = 'quad2'; i.plotVals = { a: '1', b: '0', c: '0', k: '1', A: '1' }
  i.drawPlot()
  ok('H2 守卫：普通抛物线 y=x² 照常', new Set(i.plotPts.map(p => p.t)).size >= 10)
}
{
  const i = makeInst(); i.unlocked = true
  const okPlot = i.buildPlot({ f: function () { return 5 }, x0: -8, x1: 8, title: 't', keyPts: [], lines: [], back: 'plotcfg' })
  ok('H3 守卫：真常数函数照画水平线（那是真形状）', okPlot === true && new Set(i.plotPts.map(p => p.t)).size === 1)
}
{
  const i = makeInst(); i.unlocked = true
  i.buildPlot({ f: function (x) { return 1e18 + x }, x0: -8, x1: 8, title: 't', keyPts: [], lines: [], back: 'plotcfg' })
  ok('H4 大常数偏移直线自动扩窗看得出斜率', new Set(i.plotPts.map(p => p.t)).size >= 5)
}

// ---------- I. 常数 e 的历史记录 ----------
function histDelta(expr) {
  const i = makeInst(); i.hist = []
  i.expr = expr; i.refreshCalc(); i.pressKey('eq')
  return i.hist.length
}
eq('I1 e+1 现记历史', histDelta('e+1'), 1)
eq('I2 e−1 现记历史', histDelta('e−1'), 1)
eq('I3 e×2 照常记', histDelta('e×2'), 1)
eq('I4 纯科学计数数字 1e5 仍不记（不是计算）', histDelta('1e5'), 0)
eq('I5 科学计数接力串 +2 仍记', histDelta('3.69844555555e+34+2'), 1)

// ---------- J. 溢出显示状态 ----------
{
  const i = feedCalc('0^-1')
  ok('J1 0^-1 显示「不能 ÷ 0」且 previewOk=false（1.6.0 自查 B10 修订：0^-1 抛 div0，页面用 hints 文案「不能 ÷ 0」）', i.resDisp === '不能 ÷ 0' && i.previewOk === false)
  i.pressKey('eq')
  eq('J2 溢出按 = 不污染 lastAns', i.lastAns, '')
}
{
  const i = feedCalc('1e308×10')
  ok('J3 1e308×10 同样错误状态（1.6.0 自查 B10 复核：引擎溢出返回 Infinity、页面显示「溢出」为既定口径，见 L1 与 1.5.18 7d/7e；只修 0^-1 的 div0）', i.resDisp === '溢出' && i.previewOk === false)
}
{
  const i = feedCalc('10^400')
  ok('J4 10^400 同样错误状态（1.6.0 自查 B10 复核：同 J3）', i.resDisp === '溢出' && i.previewOk === false)
}
{
  const i = feedCalc('2+3')
  ok('J5 守卫：正常结果 previewOk=true', i.previewOk === true && i.resDisp === '= 5')
}

// ---------- K/L. 科学计数法整数检查与极端指数 ----------
throws('K1 900719925474099.3e1 现报精确范围', () => E('900719925474099.3e1'))
throws('K2 90071992547409930e-1 同形（移位后整数）', () => E('90071992547409930e-1'))
eq('K3 900719925474099.2e1 恰可表示、放行', String(E('900719925474099.2e1')), '9007199254740992')
throws('K4 口径修订：9.007199254740993e15 不再豁免', () => E('9.007199254740993e15'))
throws('K5 口径修订：1.0000000000000005e16 不再豁免', () => E('1.0000000000000005e16'))
eq('K6 守卫：应用自身格式化形 3.69844555555e+34 仍豁免（>21 位）', String(E('3.69844555555e+34')), '3.69844555555e+34')
eq('L1 1e999999999 不再抛 Invalid string length、回普通溢出', String(E('1e999999999')), 'Infinity')
eq('L2 1e-999999999 = 0', String(E('1e-999999999')), '0')
eq('L3 守卫：1e308 照常', String(E('1e308')), '1e+308')

// ---------- OBS. 分数页小数行连接号（第十份报告 §三观察项） ----------
function fracLines(n1, d1, op, n2, d2) {
  const i = makeInst()
  i.fn1 = String(n1); i.fd1 = String(d1); i.fn2 = String(n2); i.fd2 = String(d2); i.fop = op
  i.fracSolve()
  return i.fLines
}
eq('OBS1 1/2+1/2 小数行改 =', fracLines(1, 2, '+', 1, 2)[1], '小数 = 1')
eq('OBS2 1/3+1/3 仍 ≈', fracLines(1, 3, '+', 1, 3)[1], '小数 ≈ 0.666667')
eq('OBS3 1/8 有限小数用 =', fracLines(1, 8, '+', 0, 1)[1], '小数 = 0.125')
eq('OBS4 1/1024 位数超显示精度仍 ≈', fracLines(1, 1024, '+', 0, 1)[1], '小数 ≈ 0.000976563')

// ---------- M. 版本锁 ----------
{
  const mf = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'))
  ok('M manifest 版本锁 1.5.14/vc53', mf.versionName === '1.5.14' && mf.versionCode === 53)
}

console.log('regression-1.5.14: pass=' + pass + ' fail=' + fail)
