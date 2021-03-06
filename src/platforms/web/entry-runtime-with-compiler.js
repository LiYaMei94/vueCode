/* @flow */

import config from "core/config";
import { warn, cached } from "core/util/index";
import { mark, measure } from "core/util/perf";

import Vue from "./runtime/index";
import { query } from "./util/index";
import { compileToFunctions } from "./compiler/index";
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref,
} from "./util/compat";

const idToTemplate = cached((id) => {
  const el = query(id);
  return el && el.innerHTML;
});

// 保留vue实例的$mount方法
const mount = Vue.prototype.$mount;
// $mount：把DOM挂载到页面上
Vue.prototype.$mount = function (
  el?: string | Element,
  // 非str的情况下是false，str的时候是true
  hydrating?: boolean
): Component {
  // 获取el对应的DOM对象
  el = el && query(el);

  // el不能是html或者body，vue实例只能挂载在普通的dom元素上
  if (el === document.body || el === document.documentElement) {
    // 如果是开发模式，会在浏览器控制台报出警告
    process.env.NODE_ENV !== "production" &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      );
    // 如果是生产模式直接返回当前vue实例
    return this;
  }

  const options = this.$options;
  // resolve template/el and convert to render function
  // 把template/el转换成render函数
  if (!options.render) {
    let template = options.template;
    if (template) {
      if (typeof template === "string") {
        // 判断是不是id选择器
        if (template.charAt(0) === "#") {
          // 获取对应的DOM对象的innerHtml
          template = idToTemplate(template);
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== "production" && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            );
          }
        }
      } else if (template.nodeType) {
        // 如果模板是元素，返回元素的innerHTML
        template = template.innerHTML;
      } else {
        if (process.env.NODE_ENV !== "production") {
          warn("invalid template option:" + template, this);
        }
        return this;
      }
    } else if (el) {
      template = getOuterHTML(el);
    }

    // 执行完上面的if语句拿到模板，开始执行编译
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile");
      }

      // compileToFunctions：把template编译成render函数
      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: process.env.NODE_ENV !== "production",
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments,
        },
        this
      );
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile end");
        measure(`vue ${this._name} compile`, "compile", "compile end");
      }
    }
  }

  // 如果传递了render函数会调用mount方法渲染DOM
  // mount：是src\platforms\web\runtime\index.js中重新定义的mount方法
  return mount.call(this, el, hydrating);
};

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  // outerHTML设置或获取对象及其内容的HTML形式
  // innerHTML 设置或获取位于对象起始和结束标签内的HTML

  // 如果el.outerHTML存在就返回作为模板
  if (el.outerHTML) {
    return el.outerHTML;
  } else {
    // 如果el.el.outerHTML不存在，就创建一个div包裹深克隆el的DOM元素
    const container = document.createElement("div");
    container.appendChild(el.cloneNode(true));
    // 返回div的innerHTML作为模板
    return container.innerHTML;
  }
}

Vue.compile = compileToFunctions;

export default Vue;
