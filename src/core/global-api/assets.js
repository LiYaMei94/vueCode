/* @flow */

import { ASSET_TYPES } from "shared/constants";
import { isPlainObject, validateComponentName } from "../util/index";

export function initAssetRegisters(Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */

  // const ASSET_TYPES = [
  //   'component',
  //   'directive',
  //   'filter'
  // ]
  ASSET_TYPES.forEach((type) => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + "s"][id]; // id组件或者指令的名称
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== "production" && type === "component") {
          validateComponentName(id);
        }
        // isPlainObject：通过Object.prototype.toString.call(obj) === '[object Object]'判断是否是原始的object对象
        if (type === "component" && isPlainObject(definition)) {
          definition.name = definition.name || id;
          // 把组件配置转换为组件的构造函数
          // this.options._base：vue的构造函数
          definition = this.options._base.extend(definition);
        }
        if (type === "directive" && typeof definition === "function") {
          definition = { bind: definition, update: definition };
        }

        // 全局注册，存储资源并赋值
        // 挂载到 Vue 实例的 vm.options.component.componentName =Ctor
        this.options[type + "s"][id] = definition;
        return definition;
      }
    };
  });
}
