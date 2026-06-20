import { describe, expectTypeOf, test } from 'bun:test'

import type {
  EntityResponse,
  ListData,
  ListResponse,
  MutationOkData,
  MutationOkResponse,
  RecordData,
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
      data: {
        items: Array<{ id: string }>
        total: number
      }
    }>()

    expectTypeOf<ListData<{ id: string }>>().toEqualTypeOf<{
      items: Array<{ id: string }>
      total: number
    }>()

    expectTypeOf<MutationOkData>().toEqualTypeOf<Record<string, never>>()
    expectTypeOf<MutationOkResponse>().toEqualTypeOf<{
      success: true
      data: Record<string, never>
    }>()

    expectTypeOf<RecordResponse<{ id: string }>>().toEqualTypeOf<{
      success: true
      data: {
        record: { id: string }
      }
    }>()

    expectTypeOf<RecordData<{ id: string }>>().toEqualTypeOf<{
      record: { id: string }
    }>()
  })
})
