/* @flow */

import { warn } from "core/util/index";

export * from "./attrs";
export * from "./class";
export * from "./element";

/**
 * Query an element selector if it's not an element already.
 */
export function query(el: string | Element): Element {
  // el如果是字符串类型，如果不是，就认为el是DOM对象，直接返回
  // 如果是字符串，就认为el是选择器，通过document.querySelector获取选择器对应的DOM对象
  if (typeof el === "string") {
    const selected = document.querySelector(el);
    if (!selected) {
      // 如果没有找到el对应DOM对象，通过环境变量env去判断当前是开发模式还是生产模式
      // 如果是开发模式，就在浏览器的控制台报出警告
      process.env.NODE_ENV !== "production" &&
        warn("Cannot find element: " + el);
      // 如果是生产模式就返回一个div
      return document.createElement("div");
    }
    return selected;
  } else {
    return el;
  }
}
