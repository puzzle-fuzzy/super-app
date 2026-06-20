import { describe, expectTypeOf, test } from 'bun:test'

import type {
  EntityResponse,
  ListResponse,
  MutationOkResponse,
  RecordResponse,
} from '../src/api'

describe('@super-app/contracts api response utility types', () => {
  test('exports common success response shapes', () => {
    expectTypeOf<EntityResponse<{ id: string }>>().toEqualTypeOf<{
      success: true
      data: { id: string }
    }>()

    expectTypeOf<ListResponse<{ id: string }>>().toEqualTypeOf<{
      success: true
      items: Array<{ id: string }>
      total: number
    }>()

    expectTypeOf<MutationOkResponse>().toEqualTypeOf<{ success: true }>()
    expectTypeOf<RecordResponse<{ id: string }>>().toEqualTypeOf<{
      success: true
      record: { id: string }
    }>()
  })
})
