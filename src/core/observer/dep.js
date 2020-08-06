/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor() {
    this.id = uid++
    this.subs = []
  }

  // 添加新的订阅者, watcher对象
  addSub(sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub(sub: Watcher) {
    remove(this.subs, sub)
  }

  depend() {
    if (Dep.target) {
      // 如果Dep.target存在,把dep对象添加到watcher的依赖中
      // addDep是在watcher中定义的
      Dep.target.addDep(this)
    }
  }

  notify() {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.

// Dep.target：存储当前正在执行的watcher对象，同一时间只有一个watcher在被使用
Dep.target = null

// 每一个组件对应一个watcher对象，如果组件有嵌套，会先渲染子组件，父组件会被挂载起来，所以父组件对应的
// watcher对象也应该被储存起来，当子组件渲染完毕，watcher会从栈中弹出，继续执行父组件的渲染
const targetStack = []

export function pushTarget(target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget() {
  // 出栈
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
