/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode, { cloneVNode } from "./vnode";
import config from "../config";
import { SSR_ATTR } from "shared/constants";
import { registerRef } from "./modules/ref";
import { traverse } from "../observer/traverse";
import { activeInstance } from "../instance/lifecycle";
import { isTextInputType } from "web/util/element";

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  makeMap,
  isRegExp,
  isPrimitive,
} from "../util/index";

export const emptyNode = new VNode("", {}, []);

const hooks = ["create", "activate", "update", "remove", "destroy"];

function sameVnode(a, b) {
  // 判断两个节点的key是否相同
  // isComment：是否是注释节点
  return (
    a.key === b.key &&
    ((a.tag === b.tag &&
      a.isComment === b.isComment &&
      isDef(a.data) === isDef(b.data) &&
      sameInputType(a, b)) ||
      (isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)))
  );
}

function sameInputType(a, b) {
  if (a.tag !== "input") return true;
  let i;
  const typeA = isDef((i = a.data)) && isDef((i = i.attrs)) && i.type;
  const typeB = isDef((i = b.data)) && isDef((i = i.attrs)) && i.type;
  return typeA === typeB || (isTextInputType(typeA) && isTextInputType(typeB));
}

function createKeyToOldIdx(children, beginIdx, endIdx) {
  let i, key;
  const map = {};
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key;
    if (isDef(key)) map[key] = i;
  }
  return map;
}

export function createPatchFunction(backend) {
  let i, j;
  const cbs = {};

  // modules：节点的属性，样式，事件操作
  // nodeOps：DOM操作api
  const { modules, nodeOps } = backend;

  for (i = 0; i < hooks.length; ++i) {
    // cbs['create']=[]
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        // cbs['create']=[updateAttrs,updateClass,...]
        cbs[hooks[i]].push(modules[j][hooks[i]]);
      }
    }
  }

  function emptyNodeAt(elm) {
    return new VNode(
      nodeOps.tagName(elm).toLowerCase(),
      {},
      [],
      undefined,
      elm
    );
  }

  function createRmCb(childElm, listeners) {
    function remove() {
      if (--remove.listeners === 0) {
        removeNode(childElm);
      }
    }
    remove.listeners = listeners;
    return remove;
  }

  function removeNode(el) {
    const parent = nodeOps.parentNode(el);
    // element may have already been removed due to v-html / v-text
    // 如果父元素存在，把该节点从父元素上移除
    if (isDef(parent)) {
      nodeOps.removeChild(parent, el);
    }
  }

  function isUnknownElement(vnode, inVPre) {
    return (
      !inVPre &&
      !vnode.ns &&
      !(
        config.ignoredElements.length &&
        config.ignoredElements.some((ignore) => {
          return isRegExp(ignore)
            ? ignore.test(vnode.tag)
            : ignore === vnode.tag;
        })
      ) &&
      config.isUnknownElement(vnode.tag)
    );
  }

  let creatingElmInVPre = 0;

  function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm, // 要挂载VNode的元素
    refElm, // 是VNode的下一个兄弟节点，如果传递了会把VNode对应的DOM元素插入到refElm之前
    nested,
    ownerArray, // Vnode中有子节点
    index
  ) {
    // vnode.elm：vnode所对应的真实DOM元素
    // 如果vnode.elm存在(即曾经渲染过)，并且有子节点，需要把当前节点克隆一份
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // This vnode was used in a previous render(此vnode在以前的渲染中使用过)!
      // now it's used as a new node, overwriting its elm would cause
      // potential patch errors down the road when it's used as an insertion
      // reference node. Instead, we clone the node on-demand before creating
      // associated DOM element for it.

      // cloneVNode：深克隆
      vnode = ownerArray[index] = cloneVNode(vnode);
    }

    vnode.isRootInsert = !nested; // for transition enter check
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return;
    }

    const data = vnode.data;
    const children = vnode.children;
    const tag = vnode.tag;
    // Vnode是标签节点
    if (isDef(tag)) {
      // 在开发模式下
      if (process.env.NODE_ENV !== "production") {
        if (data && data.pre) {
          creatingElmInVPre++;
        }
        // 如果tag不是html中的标签，那就是用户自定义标签，会发出警告：tag是一个自定义标签，是否正确注册了正确的组件
        if (isUnknownElement(vnode, creatingElmInVPre)) {
          warn(
            "Unknown custom element: <" +
            tag +
            "> - did you " +
            "register the component correctly? For recursive components, " +
            'make sure to provide the "name" option.',
            vnode.context
          );
        }
      }

      // 判断VNode是否有命名空间
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag) // 处理svg
        : nodeOps.createElement(tag, vnode);

      // setScope：为Vnode对应的dom设置样式的作用域
      setScope(vnode);

      /* istanbul ignore if */
      if (__WEEX__) {
        // in Weex, the default insertion order is parent-first.
        // List items can be optimized to use children-first insertion
        // with append="tree".
        const appendAsTree = isDef(data) && isTrue(data.appendAsTree);
        if (!appendAsTree) {
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue);
          }
          insert(parentElm, vnode.elm, refElm);
        }
        createChildren(vnode, children, insertedVnodeQueue);
        if (appendAsTree) {
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue);
          }
          insert(parentElm, vnode.elm, refElm);
        }
      } else {
        // 把Vnode的子节点转换成真实DOM
        createChildren(vnode, children, insertedVnodeQueue);
        if (isDef(data)) {
          // 此时vnode已经创建好了对应的DOM元素
          invokeCreateHooks(vnode, insertedVnodeQueue);
        }
        // 调用insert把创建好的DOM元素添加到parentElm中
        insert(parentElm, vnode.elm, refElm);
      }

      if (process.env.NODE_ENV !== "production" && data && data.pre) {
        creatingElmInVPre--;
      }
    } else if (isTrue(vnode.isComment)) {
      // Vnode是注释节点
      vnode.elm = nodeOps.createComment(vnode.text);
      insert(parentElm, vnode.elm, refElm);
    } else {
      // Vnode是是文本节点
      vnode.elm = nodeOps.createTextNode(vnode.text);
      insert(parentElm, vnode.elm, refElm);
    }
  }

  function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data;
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive;
      if (isDef((i = i.hook)) && isDef((i = i.init))) {
        i(vnode, false /* hydrating */);
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      if (isDef(vnode.componentInstance)) {
        initComponent(vnode, insertedVnodeQueue);
        insert(parentElm, vnode.elm, refElm);
        if (isTrue(isReactivated)) {
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm);
        }
        return true;
      }
    }
  }

  function initComponent(vnode, insertedVnodeQueue) {
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(
        insertedVnodeQueue,
        vnode.data.pendingInsert
      );
      vnode.data.pendingInsert = null;
    }
    vnode.elm = vnode.componentInstance.$el;
    if (isPatchable(vnode)) {
      invokeCreateHooks(vnode, insertedVnodeQueue);
      setScope(vnode);
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      registerRef(vnode);
      // make sure to invoke the insert hook
      insertedVnodeQueue.push(vnode);
    }
  }

  function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i;
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    let innerNode = vnode;
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode;
      if (isDef((i = innerNode.data)) && isDef((i = i.transition))) {
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode);
        }
        insertedVnodeQueue.push(innerNode);
        break;
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    insert(parentElm, vnode.elm, refElm);
  }

  function insert(parent, elm, ref) {
    if (isDef(parent)) {
      // ref：是elm的下一个兄弟节点
      if (isDef(ref)) {
        // 如果ref的父节点和parent相同，就把elm插入到ref之前
        if (nodeOps.parentNode(ref) === parent) {
          nodeOps.insertBefore(parent, elm, ref);
        }
      } else {
        // 如果没有ref，就把elm追加到parent中
        nodeOps.appendChild(parent, elm);
      }
    }
  }

  function createChildren(vnode, children, insertedVnodeQueue) {
    // 处理children是数组的情况
    if (Array.isArray(children)) {
      if (process.env.NODE_ENV !== "production") {
        // checkDuplicateKeys：判断children的子节点是否有相同的key
        checkDuplicateKeys(children);
      }
      // 遍历子节点中的每个VNode，调用createElm创建DOM元素，并挂载到DOM树上
      for (let i = 0; i < children.length; ++i) {
        createElm(
          children[i],
          insertedVnodeQueue,
          vnode.elm,
          null,
          true,
          children,
          i
        );
      }
    } else if (isPrimitive(vnode.text)) {
      // 如果vnode.text是原始值
      // 创建一个DOM元素，并挂载到vnode.elm上
      nodeOps.appendChild(
        vnode.elm,
        nodeOps.createTextNode(String(vnode.text))
      );
    }
  }

  function isPatchable(vnode) {
    while (vnode.componentInstance) {
      vnode = vnode.componentInstance._vnode;
    }
    return isDef(vnode.tag);
  }

  function invokeCreateHooks(vnode, insertedVnodeQueue) {
    for (let i = 0; i < cbs.create.length; ++i) {
      // 触发的是模块中的钩子函数
      cbs.create[i](emptyNode, vnode);
    }
    // Vnode上的钩子函数
    i = vnode.data.hook; // Reuse variable
    // 判断Vnode上有没有钩子函数
    if (isDef(i)) {
      // 如果有create钩子函数，执行create钩子函数
      if (isDef(i.create)) i.create(emptyNode, vnode);
      // 如果有insert钩子函数，此时vnode对应的DOM元素还没有挂载到DOM树上，所以只把vnode存储在insertedVnodeQueue队列中
      // 会在patch的最后遍历insertedVnodeQueue依次触发对应的insert钩子函数
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode);
    }
  }

  // set scope id attribute for scoped CSS.
  // this is implemented as a special case to avoid the overhead
  // of going through the normal attribute patching process.
  function setScope(vnode) {
    let i;
    if (isDef((i = vnode.fnScopeId))) {
      nodeOps.setStyleScope(vnode.elm, i);
    } else {
      let ancestor = vnode;
      while (ancestor) {
        if (isDef((i = ancestor.context)) && isDef((i = i.$options._scopeId))) {
          nodeOps.setStyleScope(vnode.elm, i);
        }
        ancestor = ancestor.parent;
      }
    }
    // for slot content they should also get the scopeId from the host instance.
    if (
      isDef((i = activeInstance)) &&
      i !== vnode.context &&
      i !== vnode.fnContext &&
      isDef((i = i.$options._scopeId))
    ) {
      nodeOps.setStyleScope(vnode.elm, i);
    }
  }

  function addVnodes(
    parentElm,
    refElm,
    vnodes,
    startIdx,
    endIdx,
    insertedVnodeQueue
  ) {
    // 开始节点索引小于等于结束节点索引
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(
        vnodes[startIdx],
        insertedVnodeQueue,
        parentElm,
        refElm,
        false,
        vnodes,
        startIdx
      );
    }
  }

  function invokeDestroyHook(vnode) {
    let i, j;
    const data = vnode.data;
    // 如果vnode存在，遍历cbs.destroy调用vnode的destroy钩子函数
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode);
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
    }
    // 如果vnode有子节点，递归调用每个子节点的destroy钩子函数
    if (isDef((i = vnode.children))) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j]);
      }
    }
  }

  function removeVnodes(vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx];
      // vnodes中的节点有子节点
      if (isDef(ch)) {
        // 如果是标签节点，把ch从DOM树上移除，把ch上的事件也移除，触发remove和destroy钩子函数
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch);
          invokeDestroyHook(ch);
        } else {
          // 如果是文本节点，把文本节点从DOM树上移除
          removeNode(ch.elm);
        }
      }
    }
  }

  function removeAndInvokeRemoveHook(vnode, rm) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i;
      const listeners = cbs.remove.length + 1;
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners;
      } else {
        // directly removing
        rm = createRmCb(vnode.elm, listeners);
      }
      // recursively invoke hooks on child component root node
      if (
        isDef((i = vnode.componentInstance)) &&
        isDef((i = i._vnode)) &&
        isDef(i.data)
      ) {
        removeAndInvokeRemoveHook(i, rm);
      }
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm);
      }
      if (isDef((i = vnode.data.hook)) && isDef((i = i.remove))) {
        i(vnode, rm);
      } else {
        rm();
      }
    } else {
      removeNode(vnode.elm);
    }
  }

  function updateChildren(
    parentElm,
    oldCh,
    newCh,
    insertedVnodeQueue,
    removeOnly
  ) {
    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let oldStartVnode = oldCh[0];
    let oldEndVnode = oldCh[oldEndIdx];
    let newEndIdx = newCh.length - 1;
    let newStartVnode = newCh[0];
    let newEndVnode = newCh[newEndIdx];
    let oldKeyToIdx, idxInOld, vnodeToMove, refElm;

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    const canMove = !removeOnly;

    if (process.env.NODE_ENV !== "production") {
      checkDuplicateKeys(newCh);
    }

    // 老节点的开始索引小于等于老节点的结束索引，并且新节点的开始索引小于等于新节点的结束索引
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      // 如果旧节点的开始节点不存在，老节点的开始索引+1
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        // 如果旧节点的结束节点不存在，老节点的结束索引-1
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        // 如果老节点的开始节点和新节点的开始节点是相同的节点，对比两个节点的差异更新到DOM上
        // 老节点的开始索引和新节点的开始索引都+1
        patchVnode(
          oldStartVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        );
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        // 如果老节点的结束节点和新节点的结束节点是相同的节点，对比两个节点的差异更新到DOM上
        // 老节点的结束索引和新节点的结束索引都-1
        patchVnode(
          oldEndVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        );
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) {
        // 如果老节点的开始节点和新节点的结束节点是相同的节点，对比两个节点的差异更新到DOM上
        // 把老节点的开始节点移动到老节点的结束节点之后
        // 老节点的开始索引+1；新节点的结束索引-1
        // Vnode moved right
        patchVnode(
          oldStartVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        );
        canMove &&
          nodeOps.insertBefore(
            parentElm,
            oldStartVnode.elm,
            nodeOps.nextSibling(oldEndVnode.elm)
          );
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) {
        // 如果老节点的结束节点和新节点的开始节点是相同的节点，对比两个节点的差异更新到DOM上
        // 把老节点的结束节点插入到老节点的开始节点之前
        // 老节点的结束索引-1；新节点的开始索引+1
        // Vnode moved left
        patchVnode(
          oldEndVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        );
        canMove &&
          nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        // 以上四种情况都不同，拿新节点的开始节点的key去老节点中找有相同Key的节点
        // 如果对象oldKeyToIdx不存在才调用createKeyToOldIdx
        // // createKeyToOldIdx：把老节点的key和对应的索引存储在对象oldKeyToIdx
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);

        // 如果新节点的开始节点有key，就去老节点的key对象中找具有相同key的老节点
        // 如果新节点的开始节点没有key，就去老节点数组中寻找和新节点的开始节点相同节点的索引
        idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);

        // 如果没有找到新开始节点对应的老节点的索引，调用createElm创建新开始节点对应的DOM对象，并插入到老的开始节点的前面
        if (isUndef(idxInOld)) {
          // New element
          createElm(
            newStartVnode,
            insertedVnodeQueue,
            parentElm,
            oldStartVnode.elm,
            false,
            newCh,
            newStartIdx
          );
        } else {
          // 获取要移动的老节点
          vnodeToMove = oldCh[idxInOld];
          // 如果找到具有相同key的老节点和新开始节点是相同节点，调用patchVnode对比两个节点的差异更新到ODOM树上
          if (sameVnode(vnodeToMove, newStartVnode)) {
            patchVnode(
              vnodeToMove,
              newStartVnode,
              insertedVnodeQueue,
              newCh,
              newStartIdx
            );
            // 把找到的vnodeToMove移动到老的开始节点之前
            oldCh[idxInOld] = undefined;
            canMove &&
              nodeOps.insertBefore(
                parentElm,
                vnodeToMove.elm,
                oldStartVnode.elm
              );
          } else {
            // 如果key相同但是tag不相同，不是相同的的元素，创建新元素
            // same key but different element. treat as new element
            createElm(
              newStartVnode,
              insertedVnodeQueue,
              parentElm,
              oldStartVnode.elm,
              false,
              newCh,
              newStartIdx
            );
          }
        }
        // 新的开始节点的索引+1
        newStartVnode = newCh[++newStartIdx];
      }
    }

    // 如果老节点的开始索引大于老节点的结束索引，新节点有剩余，把剩余的新节点添加到老节点数组的最右边
    if (oldStartIdx > oldEndIdx) {
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm;
      addVnodes(
        parentElm,
        refElm,
        newCh,
        newStartIdx,
        newEndIdx,
        insertedVnodeQueue
      );
    } else if (newStartIdx > newEndIdx) {
      // 如果新节点的开始索引大于新节点的结束索引，老节点有剩余，把剩余的老节点从DOM树上移除
      removeVnodes(oldCh, oldStartIdx, oldEndIdx);
    }
  }

  function checkDuplicateKeys(children) {
    const seenKeys = {}; // 存储子元素的key
    for (let i = 0; i < children.length; i++) {
      const vnode = children[i];
      const key = vnode.key;
      if (isDef(key)) {
        if (seenKeys[key]) {
          // 有相同的key，发出警告：当前的VNode有重复的key
          warn(
            `Duplicate keys detected: '${key}'. This may cause an update error.`,
            vnode.context
          );
        } else {
          seenKeys[key] = true;
        }
      }
    }
  }

  function findIdxInOld(node, oldCh, start, end) {
    // 如果老节点的开始所以小于老节点的结束索引
    // 遍历老节点数组
    for (let i = start; i < end; i++) {
      const c = oldCh[i];
      // 如果当前老节点oldCh[i]存在且和新节点的开始节点是相同节点，就返回当前老节点的索引值
      if (isDef(c) && sameVnode(node, c)) return i;
    }
  }

  function patchVnode(
    oldVnode,
    vnode,
    insertedVnodeQueue,
    ownerArray,
    index,
    removeOnly
  ) {
    // 如果新旧节点相同，直接返回
    if (oldVnode === vnode) {
      return;
    }

    // 如果vnode有elm属性，即有真实DOM，并且有子节点，深度克隆一份vnode
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // clone reused vnode
      vnode = ownerArray[index] = cloneVNode(vnode);
    }

    const elm = (vnode.elm = oldVnode.elm);

    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      if (isDef(vnode.asyncFactory.resolved)) {
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue);
      } else {
        vnode.isAsyncPlaceholder = true;
      }
      return;
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    if (
      isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance;
      return;
    }

    let i;
    const data = vnode.data;
    // 如果vnode中有prepatch钩子函数，就执行，即执行用户传入的钩子函数
    if (isDef(data) && isDef((i = data.hook)) && isDef((i = i.prepatch))) {
      i(oldVnode, vnode);
    }
    const oldCh = oldVnode.children;
    const ch = vnode.children;
    if (isDef(data) && isPatchable(vnode)) {
      // 遍历模块上的钩子函数，更新节点上的属性，样式，事件等
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      // 用户自定义的钩子函数
      if (isDef((i = data.hook)) && isDef((i = i.update))) i(oldVnode, vnode);
    }


    /**
     * 对比新旧VNode
     */
    // 新节点没有文本
    if (isUndef(vnode.text)) {
      // 新旧VNode都有子节点
      if (isDef(oldCh) && isDef(ch)) {
        // 子节点不相同，调用updateChildren对比子节点
        if (oldCh !== ch)
          updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly);
      } else if (isDef(ch)) {
        // 如果新节点有子节点且在开发模式下，调用checkDuplicateKeys检查是否有相同的key
        if (process.env.NODE_ENV !== "production") {
          checkDuplicateKeys(ch);
        }
        // 如果旧节点有文本，把元素elm的文本置空，调用`addVnodes`把新节点的子节点转换成真实`DOM`添加到旧节点上
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, "");
        // addVnodes内部调用createElm把新节点的子节点添加到elm上
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } else if (isDef(oldCh)) {
        //  如果旧节点有子节点，新节点没有子节点也没有文本，移除老节点的所有的子节点
        removeVnodes(oldCh, 0, oldCh.length - 1);
      } else if (isDef(oldVnode.text)) {
        // 如果旧节点有文本，新节点没有子节点也没有文本，把旧节点的文本置空
        nodeOps.setTextContent(elm, "");
      }
    } else if (oldVnode.text !== vnode.text) {
      // 新节点和旧节点的文本不相同，把新节点的文本设置给elm元素
      nodeOps.setTextContent(elm, vnode.text);
    }
    // 如果新节点有data属性且有postpatch钩子函数，则执行postpatch钩子函数
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.postpatch)))
        i(oldVnode, vnode);
    }
  }

  function invokeInsertHook(vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue;
    } else {
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i]);
      }
    }
  }

  let hydrationBailed = false;
  // list of modules that can skip create hook during hydration because they
  // are already rendered on the client or has no need for initialization
  // Note: style is excluded because it relies on initial clone for future
  // deep updates (#7063).
  const isRenderedModule = makeMap("attrs,class,staticClass,staticStyle,key");

  // Note: this is a browser-only function so we can assume elms are DOM nodes.
  function hydrate(elm, vnode, insertedVnodeQueue, inVPre) {
    let i;
    const { tag, data, children } = vnode;
    inVPre = inVPre || (data && data.pre);
    vnode.elm = elm;

    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.isAsyncPlaceholder = true;
      return true;
    }
    // assert node match
    if (process.env.NODE_ENV !== "production") {
      if (!assertNodeMatch(elm, vnode, inVPre)) {
        return false;
      }
    }
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.init)))
        i(vnode, true /* hydrating */);
      if (isDef((i = vnode.componentInstance))) {
        // child component. it should have hydrated its own tree.
        initComponent(vnode, insertedVnodeQueue);
        return true;
      }
    }
    if (isDef(tag)) {
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue);
        } else {
          // v-html and domProps: innerHTML
          if (
            isDef((i = data)) &&
            isDef((i = i.domProps)) &&
            isDef((i = i.innerHTML))
          ) {
            if (i !== elm.innerHTML) {
              /* istanbul ignore if */
              if (
                process.env.NODE_ENV !== "production" &&
                typeof console !== "undefined" &&
                !hydrationBailed
              ) {
                hydrationBailed = true;
                console.warn("Parent: ", elm);
                console.warn("server innerHTML: ", i);
                console.warn("client innerHTML: ", elm.innerHTML);
              }
              return false;
            }
          } else {
            // iterate and compare children lists
            let childrenMatch = true;
            let childNode = elm.firstChild;
            for (let i = 0; i < children.length; i++) {
              if (
                !childNode ||
                !hydrate(childNode, children[i], insertedVnodeQueue, inVPre)
              ) {
                childrenMatch = false;
                break;
              }
              childNode = childNode.nextSibling;
            }
            // if childNode is not null, it means the actual childNodes list is
            // longer than the virtual children list.
            if (!childrenMatch || childNode) {
              /* istanbul ignore if */
              if (
                process.env.NODE_ENV !== "production" &&
                typeof console !== "undefined" &&
                !hydrationBailed
              ) {
                hydrationBailed = true;
                console.warn("Parent: ", elm);
                console.warn(
                  "Mismatching childNodes vs. VNodes: ",
                  elm.childNodes,
                  children
                );
              }
              return false;
            }
          }
        }
      }
      if (isDef(data)) {
        let fullInvoke = false;
        for (const key in data) {
          if (!isRenderedModule(key)) {
            fullInvoke = true;
            invokeCreateHooks(vnode, insertedVnodeQueue);
            break;
          }
        }
        if (!fullInvoke && data["class"]) {
          // ensure collecting deps for deep class bindings for future updates
          traverse(data["class"]);
        }
      }
    } else if (elm.data !== vnode.text) {
      elm.data = vnode.text;
    }
    return true;
  }

  function assertNodeMatch(node, vnode, inVPre) {
    if (isDef(vnode.tag)) {
      return (
        vnode.tag.indexOf("vue-component") === 0 ||
        (!isUnknownElement(vnode, inVPre) &&
          vnode.tag.toLowerCase() ===
          (node.tagName && node.tagName.toLowerCase()))
      );
    } else {
      return node.nodeType === (vnode.isComment ? 8 : 3);
    }
  }

  return function patch(oldVnode, vnode, hydrating, removeOnly) {
    // 如果新节点不存在
    if (isUndef(vnode)) {
      // 如果旧节点存在，调用invokeDestroyHook执行oldVnode的destroy钩子函数，否则直接返回不做任何操作
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
      return;
    }

    let isInitialPatch = false;

    // 存储新插入的VNode节点，存储的目的是：把VNode节点对应的DOM元素挂载到DOM树上后触发VNode的insert钩子函数
    const insertedVnodeQueue = [];

    // 如果旧节点不存在，调用组件的$mount方法，如果传递参数是要把组件挂载到页面的某个位置，
    // 如果没有传递参数，只创建组件，但是不挂载到页面上
    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      // isInitialPatch：标记当前VNode已经创建好且对应的DOM也创建好了，但是不挂载到页面
      isInitialPatch = true;
      // 把VNode转换成真实DOM，但是不挂载到页面，没有传递要挂载的父元素
      createElm(vnode, insertedVnodeQueue);
    } else {
      // 如果oldVnode.nodeType存在，则oldVnode是一个真实DOM，首次渲染
      const isRealElement = isDef(oldVnode.nodeType);

      // oldVnode不是真实DOM，判断oldVnode和vnode是否是相同节点
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node

        // 更新操作：diff算法
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
      } else {
        // 如果oldVnode是一个真实DOM，首次渲染
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR);
            hydrating = true;
          }
          if (isTrue(hydrating)) {
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              invokeInsertHook(vnode, insertedVnodeQueue, true);
              return oldVnode;
            } else if (process.env.NODE_ENV !== "production") {
              warn(
                "The client-side rendered virtual DOM tree is not matching " +
                "server-rendered content. This is likely caused by incorrect " +
                "HTML markup, for example nesting block-level elements inside " +
                "<p>, or missing <tbody>. Bailing hydration and performing " +
                "full client-side render."
              );
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          // emptyNodeAt：把真实的DOM元素转换成VNode对象，并把真实的DOM元素存储在VNode对象的elm属性上
          oldVnode = emptyNodeAt(oldVnode);
        }

        // replacing existing element
        // 获取oldVnode的真实DOM
        const oldElm = oldVnode.elm;
        // 找到oldVnode的父元素，为将来把oldVnode挂载到页面做准备
        const parentElm = nodeOps.parentNode(oldElm);

        // create new node
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          // 如果是在执行从界面消失的过渡动画，把parentElm设置为null，不会把新创建的DOM元素挂载到页面上
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm) // 获取oldElm的下一个兄弟节点，会把oldElm插入到nodeOps.nextSibling(oldElm)之前
        );

        // update parent placeholder node element, recursively
        if (isDef(vnode.parent)) {
          let ancestor = vnode.parent;
          const patchable = isPatchable(vnode);
          while (ancestor) {
            for (let i = 0; i < cbs.destroy.length; ++i) {
              cbs.destroy[i](ancestor);
            }
            ancestor.elm = vnode.elm;
            if (patchable) {
              for (let i = 0; i < cbs.create.length; ++i) {
                cbs.create[i](emptyNode, ancestor);
              }
              // #6513
              // invoke insert hooks that may have been merged by create hooks.
              // e.g. for directives that uses the "inserted" hook.
              const insert = ancestor.data.hook.insert;
              if (insert.merged) {
                // start at index 1 to avoid re-invoking component mounted hook
                for (let i = 1; i < insert.fns.length; i++) {
                  insert.fns[i]();
                }
              }
            } else {
              registerRef(ancestor);
            }
            ancestor = ancestor.parent;
          }
        }

        // 移除老节点
        // parentElm：oldVnode的真实DOM
        if (isDef(parentElm)) {
          // 如果存在tag属性，则说明该元素是tag标签，把tag标签从DOM上移除，并且触发remove钩子函数和destroy钩子函数
          // 如果不存在tag属性，则说明该元素是文本节点，直接把该元素从DOM上移除
          removeVnodes([oldVnode], 0, 0);
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode);
        }
      }
    }

    // 触发新插入的VNode的insert钩子函数
    // isInitialPatch：标记该VNode不挂载到页面上，只是存储在内存中
    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);
    return vnode.elm;
  };
}
