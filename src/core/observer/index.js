/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

// 获取修补之后的元素组的方法，返回的是数组类型
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;// 观察对象
  dep: Dep;// 依赖对象
  vmCount: number; // 实例计数器

  constructor(value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0

    // function def (obj: Object, key: string, val: any, enumerable?: boolean) {
    //   Object.defineProperty(obj, key, {
    //     value: val,
    //     enumerable: !!enumerable,
    //     writable: true,
    //     configurable: true
    //   })
    // }

    // 将实例挂载到观察对象value的__ob__属性上，在这里没有传入enumerable，表示该属性是不可枚举的
    // __ob__只是用来记录observer对象的，不需要遍历设置getter和setter
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      // 数组响应式处理
      // const hasProto = '__proto__' in {},表示当前的浏览器是否支持原型这个属性
      if (hasProto) {
        // value.__proto__ = arrayMethods
        // arrayMethods = Object.create(Array.prototype)
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 遍历数组，把数组的每一个元素,如果元素是对象，把该元素转换成响应式对象
      this.observeArray(value)
    } else {
      // 遍历所有的属性，调用defineReactive函数把每个属性都转换成getter和setter
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// value如果已经存在observer对象，就把原来的返回，如果没有就创建一个新的observer对象并返回
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // value不是对象，或者是VNode的实例时不需要做响应式处理
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void

  // '__ob__'属性是在Observer的构造函数中定义的
  // value有'__ob__'属性，并且value.__ob__是Observer的实例，就说明value已经存在observer对象，就把原来的返回
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__

    // 判断value是否可以创建响应式对象，必须满足以下4个条件
    // 1. 禁用组件更新计算中的观察
    // 2. 不是服务端渲染
    // 3. value是数组或者value是纯的js对象（Object.prototype.toString.call(obj) === "[object Object]"）
    // 4. value是可扩展的且不是vue实例
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    // isPlainObject：判断value是不是纯的js对象  _toString.call(obj) === "[object Object]"
    (Array.isArray(value) || isPlainObject(value)) &&
    // value是可扩展的且不是vue实例
    Object.isExtensible(value) &&
    // vm._isVue = true当前实例是否是vue实例
    !value._isVue
  ) {
    // value中没有observer对象就创建一个
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function, // customSetter:用户自定义的setter函数
  shallow?: boolean // shallow：false，只对key的第一层进行getter和setter的转换，如果key中还嵌套的对象不会进行转换
) {
  // 创建依赖对象实例，收集当前对象的所有watcher
  const dep = new Dep()

  // Object.getOwnPropertyDescriptor() 方法返回指定对象上一个自有属性对应的属性描述符。
  // （自有属性指的是直接赋予该对象的属性，不需要从原型链上进行查找的属性）
  // configurable：当且仅当指定对象的属性描述可以被改变或者属性可被删除时，为true

  // 获取每个属性的描述符，如果configurable=false，表示不可被修改，直接退出
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 获取用户定义的getter和setter，在Object.defineProperty中重写getter和setter
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 判断是否递归观察对象，
  // 当shallow时false，调用observe将val对象的所有属性都转换成getter/setters，返回观察对象
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val
      // 收集依赖
      // 如果存在依赖目标,即watcher,就把watcher添加到dep的subs数组中
      // 在watcher的get方法中调用pushTarget给Dep设置静态属性target
      // pushTarget函数中把当前的watcher保存到Dep.target中
      if (Dep.target) {
        // 把当前的watcher对象添加到dep的subs数组中
        // dep：是每一个属性创建的Dep实例，收集每个属性点额依赖,在dep中定义.调用了Dep.target.addDep(this)
        // addDep是在watcher中定义的,调用了dep.addSub(this)把当前的watcher添加到dep的subs数组中

        // 为当前的属性收集依赖
        dep.depend()
        // childOb:是val的子对象,如果存在,就为子对象收集依赖
        // observe(val)会返回一个observer对象，该对象创建了Dep实例
        // childOb是一个observer对象，包含dep属性

        if (childOb) {// 如果这个属性的值是对象，要为对象收集依赖
          // childOb.dep:为val收集依赖
          childOb.dep.depend()
          // 如果是数组，需要给数组的每一个元素收集依赖
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // newVal !== newVal && value !== value：判断NaN的情况NaN!==NaN
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 如果没有setter表示该属性是只读的直接返回
      if (getter && !setter) return
      // 如果用户自定义的setter存在就调用，否则直接更新值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 如果新值是对象,把对象的属性也转换成getter/setters
      childOb = !shallow && observe(newVal)
      // 发送数据更新的通知
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
