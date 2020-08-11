const path = require('path')

// __dirname：当前文件所在的目录：C:\Users\EDZ\Desktop\vueCode\scripts
// 加上../:C:\Users\EDZ\Desktop\vueCode\
// 把传入的路径转成绝对路径
const resolve = p => path.resolve(__dirname, '../', p)

module.exports = {
  vue: resolve('src/platforms/web/entry-runtime-with-compiler'),
  compiler: resolve('src/compiler'),
  core: resolve('src/core'),
  shared: resolve('src/shared'),
  web: resolve('src/platforms/web'),
  weex: resolve('src/platforms/weex'),
  server: resolve('src/server'),
  sfc: resolve('src/sfc')
}
