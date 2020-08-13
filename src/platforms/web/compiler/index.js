/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// baseOptions和平台相关的配置
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
