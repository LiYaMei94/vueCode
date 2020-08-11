/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype

// 新创建一个对象，原型指向数组的构造函数的prototype
export const arrayMethods = Object.create(arrayProto)

// 修改数组的方法，以下的方法都会修改原数组
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
  // 调用def将当前方法method注入到arrayMethods对象中，值是mutator函数
  // 重新定义数组的原始方法
  def(arrayMethods, method, function mutator(...args) {
    // 执行原始数组的方法，拿到改变之后的数组
    // result中包含了inserted
    const result = original.apply(this, args)
    // 数组所关联的__ob__对象
    const ob = this.__ob__

    // 存储数组新增元素，使用的是浅拷贝，所以inserted改变，args就会改变，最后result中新增的元素就也成为了响应式的
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args // args：新增的元素
        break
      case 'splice':
        // splice接收的第三个参数是数组新增的元素
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
