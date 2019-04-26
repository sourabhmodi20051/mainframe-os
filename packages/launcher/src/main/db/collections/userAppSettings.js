// @flow

import type { RxDatabase } from 'rxdb'

import { COLLECTION_NAMES } from '../constants'

import schema from '../schemas/userAppSettings'

export default async (db: RxDatabase) => {
  return await db.collection({
    name: COLLECTION_NAMES.USER_APP_SETTINGS,
    schema,
  })
}