/* @flow */

import Vue from "core/index";
import config from "core/config";
import { extend, noop } from "shared/util";
import { mountComponent } from "core/instance/lifecycle";
import { devtools, inBrowser } from "core/util/index";

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement,
} from "web/util/index";

import { patch } from "./patch";
import platformDirectives from "./directives/index";
import platformComponents from "./components/index";

// install platform specific utils

Vue.config.mustUseProp = mustUseProp; // 判断是否是关键属性（input,textarea,option,select,progress）
Vue.config.isReservedTag = isReservedTag; // 判断是不是HTML标签和svg标签
Vue.config.isReservedAttr = isReservedAttr; // 检查是不是style和class
Vue.config.getTagNamespace = getTagNamespace; // 获取标签的命名空间
Vue.config.isUnknownElement = isUnknownElement;

// install platform runtime directives & components
// extend：把第二个参数的所有成员复制到第一个对象参数中
// Vue.options中存储的组件都是全局组件
// 注册指令 v-model v-show
extend(Vue.options.directives, platformDirectives);
// 注册组件 v-transition v-transition-group
// 在项目中注册的组件也都存储在Vue.options.components中
extend(Vue.options.components, platformComponents);

// install platform patch function
// inBrowser：类型是常量，通过typeof window !== 'undefined'来判断当前是不是浏览器环境
Vue.prototype.__patch__ = inBrowser ? patch : noop; // noop：空函数

// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined;
  // mountComponent：渲染DOM
  return mountComponent(this, el, hydrating);
};

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
  setTimeout(() => {
    if (config.devtools) {
      if (devtools) {
        devtools.emit("init", Vue);
      } else if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "test"
      ) {
        console[console.info ? "info" : "log"](
          "Download the Vue Devtools extension for a better development experience:\n" +
          "https://github.com/vuejs/vue-devtools"
        );
      }
    }
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test" &&
      config.productionTip !== false &&
      typeof console !== "undefined"
    ) {
      console[console.info ? "info" : "log"](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      );
    }
  }, 0);
}

export default Vue;
