// @flow

import { getPassword, setPassword } from 'keytar'

import type { Config } from '../config'
import { createDB, type DB } from '../db'
import type { Environment } from '../environment'
import type { Logger } from '../logger'

const PASSWORD_SERVICE = 'MainframeOS'

export type ContextParams = {
  env: Environment,
  logger: Logger,
}

export class SystemContext {
  _resolveDB: (db: DB) => void
  db: ?DB
  dbReady: Promise<DB>
  env: Environment
  logger: Logger

  constructor(params: ContextParams) {
    this.dbReady = new Promise(resolve => {
      this._resolveDB = (db: DB) => {
        this.db = db
        resolve(db)
      }
    })
    this.env = params.env
    this.logger = params.logger
  }

  get config(): Config {
    return this.env.config
  }

  get defaultUser(): ?string {
    return this.config.get('defaultUser')
  }

  set defaultUser(id: ?string): void {
    if (id == null) {
      this.config.delete('defaultUser')
    } else {
      this.config.set('defaultUser', id)
    }
  }

  async getPassword(): Promise<string | null> {
    try {
      return await getPassword(
        PASSWORD_SERVICE,
        `${this.env.name}-${this.env.type}`,
      )
    } catch (error) {
      this.logger.log({
        level: 'error',
        message: 'Failed to retrieve password from keychain',
        error,
      })
      return null
    }
  }

  async savePassword(password: string): Promise<void> {
    try {
      await setPassword(
        PASSWORD_SERVICE,
        `${this.env.name}-${this.env.type}`,
        password,
      )
      this.env.config.set('savePassword', true)
    } catch (error) {
      this.logger.log({
        level: 'error',
        message: 'Failed to save password to keychain',
        error,
      })
    }
  }

  async openDB(password: string): Promise<DB> {
    if (this.db != null) {
      throw new Error('DB already open')
    }

    const db = await createDB(this.env.getDBPath(), password)

    if (this.env.config.get('dbCreated', false) === false) {
      this.env.config.set('dbCreated', true)
    }

    this._resolveDB(db)
    return db
  }
}