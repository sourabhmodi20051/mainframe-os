// @flow

import type Client, { ClientSession } from '@mainframe/client'
import type { BrowserWindow } from 'electron'

// UI

export type Style = ?number | ?Array<Style> | ?Object

// Vault

export type VaultPath = string
export type VaultLabel = string

export type VaultsData = {
  vaults: { [VaultPath]: VaultLabel },
  defaultVault: VaultPath,
  vaultOpen: boolean,
}

// Request

export type ClientResponse = {
  id: string,
  error?: Object,
  result?: Object,
}

export type RequestContext = {
  request: Object,
  appSession: ClientSession,
  window: BrowserWindow,
  client: Client,
}

export type Notification = {
  id: string,
  type: string,
  data: Object,
}
