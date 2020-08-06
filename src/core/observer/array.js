/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'
// Array.prototype  属性表示 Array 构造函数的原型
const arrayProto = Array.prototype
// 使用数组arrayProto作为原型创建一个新对象
export const arrayMethods = Object.create(arrayProto)

// 修改数组的方法
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 获取数组的原始方法
  const original = arrayProto[method]
  // def:封装Object.defineProperty
  // 调用def重新定义数组的原始方法，例如push，pop等
  def(arrayMethods, method, function mutator(...args) {
    // 执行原始数组的方法，拿到改变之后的数组
    const result = original.apply(this, args)
    // 数组所关联的__ob__对象
    const ob = this.__ob__
    let inserted // 存储数组新增元素
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args // args：新增的元素
        break
      case 'splice':
        // 传入的第三个参数是数组新增的元素
        inserted = args.slice(2)
        break
    }
    // observeArray：遍历数组，把数组的每一个元素,如果元素是对象，把该元素转换成响应式对象
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
