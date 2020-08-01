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
  // config
  const configDef = {};
  configDef.get = () => config;
  if (process.env.NODE_ENV !== "production") {
    configDef.set = () => {
      warn(
        "Do not replace the Vue.config object, set individual fields instead."
      );
    };
  }
  // 初始化Vue.config，是vue的静态成员
  Object.defineProperty(Vue, "config", configDef);

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
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

  // 初始化Vue.options对象
  Vue.options = Object.create(null);
  // const ASSET_TYPES = [
  //   'component',
  //   'directive',
  //   'filter'
  // ]
  ASSET_TYPES.forEach((type) => {
    // 给Vue.options挂载components/directives/filters
    // 存储全局的组件、指令、过滤器
    Vue.options[type + "s"] = Object.create(null);
  });

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.

  Vue.options._base = Vue;

  // builtInComponents导出KeepAlive
  // 设置keep-alive组件
  // extend实现的是浅拷贝
  extend(Vue.options.components, builtInComponents);

  // 注册Vue.use() 用来注册组件
  initUse(Vue);
  // 注册Vue.mixin() 实现混入
  initMixin(Vue);
  // 注册Vue.extend()基于传入的options返回一个组件的构造函数
  initExtend(Vue);
  // 注册Vue.component(),Vue.directive(),Vue.filter()
  initAssetRegisters(Vue);
}
