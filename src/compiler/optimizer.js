/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
// 标记静态文本
export function optimize(root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  // 标记静态节点
  markStatic(root)
  // second pass: mark static roots.
  // 标记静态根节点
  markStaticRoots(root, false)
}

function genStaticKeys(keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

function markStatic(node: ASTNode) {
  node.static = isStatic(node)
  // 元素节点，需要处理子节点
  if (node.type === 1) {
    // do not make component slot content static(不能将组件插槽内容设为静态). this avoids
    // 1. components not able to mutate slot nodes(组件无法改变插槽节点)
    // 2. static slot content fails for hot-reloading(静态插槽内容无法进行热重新加载)
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }

    // 遍历子节点children递归调用markStatic标记静态节点
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        // 如果当前有一个child不是静态static，那当前node就不是静态节点
        node.static = false
      }
    }
    // 处理条件渲染中的ast对象
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

function markStaticRoots(node: ASTNode, isInFor: boolean) {
  // 元素节点
  if (node.type === 1) {
    // 判断节点是否是静态的或者只渲染一次来标记节点在for循环中是否是静态的
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.

    // 如果一个元素内部只有文本节点，该节点不是静态根节点

    // 静态根节点：node是静态节点 && 有子节点 &&子节点不能只是文本节点 (只有一个子节点 && 该子节点是文本节点)
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      // 遍历子节点children递归调用markStaticRoots标记静态根节点
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      // 处理条件渲染中的ast对象
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

function isStatic(node: ASTNode): boolean {
  // 表达式
  if (node.type === 2) { // expression
    return false
  }
  // 静态文本内容
  if (node.type === 3) { // text
    return true
  }

  /**
   * 如果满足以下条件，说明是一个静态节点，返回true
   * 是pre或者(
   *  没有动态绑定&&
   *  不是v-if/v-for/v-else指令&&
   *  不是内置组件&&
   *  不是组件&&
   *  不是v-for下的直接子节点
   * )
   */
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}

function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
