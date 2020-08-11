/* @flow */

import config from "../config";
import { initUse } from "./use";
import { initMixin } from "./mixin";
import { initExtend } from "./extend";
import { initAssetRegisters } from "./assets";
import { set, del } from "../observer/index";
import { ASSET_TYPES } from "shared/constants";
import builtInComponents from "../components/index";
import { observe } from "core/observer/index";

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive,
} from "../util/index";

export function initGlobalAPI(Vue: GlobalAPI) {
  const configDef = {};
  configDef.get = () => config;
  if (process.env.NODE_ENV !== "production") {
    // 如果在生产模式下，不能给config赋值
    // 给config赋值会触发configDef.set，发出警告：不要给Vue.config重新赋值
    configDef.set = () => {
      warn(
        "Do not replace the Vue.config object, set individual fields instead."
      );
    };
  }
  // 初始化Vue.config，是vue的静态成员
  // 在src\platforms\web\runtime\index.js中给config挂载成员
  Object.defineProperty(Vue, "config", configDef);

  // 这些方法不能被视为全局api的一部分，除非你已经意识到某些风险，否则不要去依赖他们
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive,
  };

  // 静态方法set、delete、nextTick
  Vue.set = set;
  Vue.delete = del;
  Vue.nextTick = nextTick;

  // 2.6 explicit observable API
  // 设置响应式数据
  Vue.observable = <T>(obj: T): T => {
    observe(obj);
    return obj;
  };
  // 初始化Vue.options对象，该对象没有原型
  Vue.options = Object.create(null);
  // ASSET_TYPES:'component','directive','filter'
  ASSET_TYPES.forEach((type) => {
      // 给Vue.options挂载components/directives/filters
      // Vue.components存储全局的组件
      // Vue.directives存储全局的指令
      // Vue.filters存储全局的过滤器
      Vue.options[type + "s"] = Object.create(null);
  });
  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue;

  // builtInComponents导出KeepAlive
  // extend:在src\shared\util.js中定义，实现的是浅拷贝
  // 设置keep-alive组件
  extend(Vue.options.components, builtInComponents);
  // 注册Vue.use() 用来注册插件
  initUse(Vue);
  // 注册Vue.mixin() 实现混入
  initMixin(Vue);
  // 注册Vue.extend()基于传入的options返回一个组件的构造函数
  initExtend(Vue);
  // 注册Vue.component(),Vue.directive(),Vue.filter()
  initAssetRegisters(Vue);
}
