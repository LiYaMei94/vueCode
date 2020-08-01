import { initMixin } from "./init";
import { stateMixin } from "./state";
import { renderMixin } from "./render";
import { eventsMixin } from "./events";
import { lifecycleMixin } from "./lifecycle";
import { warn } from "../util/index";

// 这里不使用class是因为方便给Vue实例混入实例成员
function Vue(options) {
  // 判断当前是不是开发环境，并且this是不是Vue的实例，如果this不是Vue的实例说明没有使用new调用Vue的构造函数
  if (process.env.NODE_ENV !== "production" && !(this instanceof Vue)) {
    warn("Vue is a constructor and should be called with the `new` keyword");
  }
  this._init(options);
}

// 注册vm的_init()方法，初始化vm
initMixin(Vue);
// 注册vm的$data, $props, $set, $delete, $watch
stateMixin(Vue);
// 初始化事件相关的方法
// $on/$once/$off/$emit
eventsMixin(Vue);
// 初始化生命周期相关的混入方法
// _update/$forceUpdata/$destory
lifecycleMixin(Vue);
// 混入render
// $nextTick/_render
renderMixin(Vue);

export default Vue;
