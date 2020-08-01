/* @flow */

import { mergeOptions } from "../util/index";

export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // mergeOptions：把mixin中的所有成员拷贝到this.options
    this.options = mergeOptions(this.options, mixin);
    return this;
  };
}
