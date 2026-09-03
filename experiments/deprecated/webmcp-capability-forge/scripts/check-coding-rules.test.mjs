import assert from 'node:assert/strict'
import test from 'node:test'

import { CodingRuleChecker } from './check-coding-rules.mjs'

test('accepts static methods and enum member comparisons', () => {
  const source = `
    export enum State { Ready = 'ready', Done = 'done' }
    export class StateRules {
      static isReady(value: State): boolean { return value === State.Ready }
      static isDone(value: State): boolean { return value === State.Done }
    }
  `

  assert.deepEqual(CodingRuleChecker.checkText('valid.ts', source), [])
})

test('reports explicit any and unknown types', () => {
  const source = `
    export class UnsafeValues {
      static accept(value: any): unknown { return value }
    }
  `

  assert.deepEqual(
    CodingRuleChecker.checkText('unsafe.ts', source).map((issue) => issue.code),
    ['ExplicitAny', 'ExplicitUnknown'],
  )
})

test('reports string literal unions', () => {
  const source = `type State = 'ready' | 'done'`

  assert.deepEqual(
    CodingRuleChecker.checkText('union.ts', source).map((issue) => issue.code),
    ['StringLiteralUnion'],
  )
})

test('reports multiple standalone function exports', () => {
  const source = `
    export function first(): void {}
    export const second = (): void => {}
  `

  assert.deepEqual(
    CodingRuleChecker.checkText('functions.ts', source).map((issue) => issue.code),
    ['MultipleStandaloneFunctionExports'],
  )
})
