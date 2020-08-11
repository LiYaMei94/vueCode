/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.

// platformModules: attrs,klass,events,domProps,style,transition中最后导出的是生命周期的钩子函数：create、update
// baseModules:处理指令和ref
const modules = platformModules.concat(baseModules)

// nodeOps:dom操作API
export const patch: Function = createPatchFunction({ nodeOps, modules })
