// @flow

import Bzz from '@erebos/api-bzz-node'
import { createKeyPair, sign } from '@erebos/secp256k1'
import objectHash from 'object-hash'
import { Subject, Subscription } from 'rxjs'
import { debounceTime, filter, flatMap, map } from 'rxjs/operators'

import { MF_PREFIX } from '../../../constants'

import { writePeer } from '../../data/protocols'
import OwnFeed from '../../swarm/OwnFeed'
import { createPublisher } from '../../swarm/feeds'

import { COLLECTION_NAMES } from '../constants'
import type { CollectionParams } from '../types'
import { generateKeyPair, generateLocalID } from '../utils'

import schema from '../schemas/user'
import type { UserProfile } from '../schemas/userProfile'

export default async (params: CollectionParams) => {
  const db = params.db
  const logger = params.logger.child({ collection: COLLECTION_NAMES.USERS })

  return await db.collection({
    name: COLLECTION_NAMES.USERS,
    schema,
    statics: {
      async create(data: { profile: UserProfile, privateProfile?: boolean }) {
        return await this.insert({
          ...data,
          localID: generateLocalID(),
          keyPair: generateKeyPair(),
        })
      },

      async startSync() {
        if (this._sync != null) {
          logger.warn('Collection already syncing, ignoring startSync() call')
          return
        }

        logger.debug('Start collection sync')
        this._sync = new Subscription()

        const docs = await this.find().exec()
        docs.forEach(doc => {
          this._sync.add(doc.startSync())
        })

        this._sync.add(
          this.insert$
            .pipe(
              flatMap(async event => {
                const doc = await this.findOne(event.data.doc).exec()
                this._sync.add(doc.startSync())
              }),
            )
            .subscribe({
              error: err => {
                logger.log({
                  level: 'error',
                  message: 'Collection sync error with added doc',
                  error: err.toString(),
                })
              },
            }),
        )
      },

      async stopSync() {
        if (this._sync != null) {
          logger.debug('Stop collection sync')
          this._sync.unsubscribe()
          this._sync = null
        }
      },
    },
    methods: {
      hasEthWallet(): boolean {
        return (
          this.ethWallets.hd.length > 0 || this.ethWallets.ledger.length > 0
        )
      },

      getBzz(): Bzz {
        if (this._bzz == null) {
          this._bzz = new Bzz({
            signBytes: async (bytes, key) => sign(bytes, key),
            url: this.bzzURL,
          })
        }
        return this._bzz
      },

      getPublicID(): string {
        return this.getPublicFeed().address.replace('0x', MF_PREFIX.PEER)
      },

      getPublicFeed(): OwnFeed {
        if (this._publicFeed == null) {
          this._publicFeed = new OwnFeed(this.keyPair.privateKey)
        }
        return this._publicFeed
      },

      getSharedKey(peerKey: any): Buffer {
        return createKeyPair(this.keyPair.privateKey)
          .derive(peerKey)
          .toBuffer()
      },

      observeContactAdded() {
        if (this._contactAdded$ == null) {
          this._contactAdded$ = new Subject()
        }
        return this._contactAdded$.asObservable()
      },

      async addContact(publicID: string, data: Object = {}): Promise<Object> {
        logger.log({
          level: 'debug',
          message: 'Add contact for user',
          userID: this.localID,
          contactPublicID: publicID,
        })

        const bzz = this.getBzz()

        let peer = await db.peers.findByPublicID(publicID)
        if (peer == null) {
          logger.log({
            level: 'debug',
            message: 'No existing peer for this contact, creating it',
            userID: this.localID,
            contactPublicID: publicID,
          })
          peer = await db.peers.createFromID(bzz, publicID)
          logger.log({
            level: 'debug',
            message: 'Peer created',
            userID: this.localID,
            contactPublicID: publicID,
            peerID: peer.localID,
          })
        } else {
          logger.log({
            level: 'debug',
            message: 'Peer found',
            userID: this.localID,
            contactPublicID: publicID,
            peerID: peer.localID,
          })
        }

        const contact = db.contacts.newDocument({
          profile: {},
          ...data,
          localID: generateLocalID(),
          keyPair: generateKeyPair(),
          peer: peer.localID,
          firstContactFeedCreated: true, // Created below, before saving doc
        })
        await contact.createFirstContactFeed(this)
        await contact.save()
        logger.log({
          level: 'debug',
          message: 'Contact created',
          userID: this.localID,
          contactID: contact.localID,
          contactPublicID: publicID,
          peerID: peer.localID,
        })

        await this.update({ $addToSet: { contacts: contact.localID } })
        logger.log({
          level: 'debug',
          message: 'Contact added to user',
          userID: this.localID,
          contactID: contact.localID,
          contactPublicID: publicID,
          peerID: peer.localID,
        })

        if (this._contactAdded$ != null) {
          this._contactAdded$.next(contact)
        }

        return contact
      },

      async addEthHDWallet(id: string): Promise<void> {
        await this.update({ $addToSet: { 'ethWallets.hd': id } })
      },

      async addEthLedgerWallet(id: string): Promise<void> {
        await this.update({ $addToSet: { 'ethWallets.ledger': id } })
      },

      async setProfileEthAddress(address: string) {
        await this.atomicSet('profile.ethAddress', address)
      },

      startPublicProfilePublication() {
        if (this._publicProfilePublication != null) {
          logger.log({
            level: 'warn',
            message: 'Public profile publication is already started',
            id: this.localID,
          })
          return
        }

        logger.log({
          level: 'debug',
          message: 'Start public profile publication',
          id: this.localID,
        })

        const publish = createPublisher({
          bzz: this.getBzz(),
          feed: this.getPublicFeed(),
          transform: writePeer,
        })
        this._publicProfilePublication = this.profile$
          .pipe(
            debounceTime(10000),
            map(profile => ({ hash: objectHash(profile), profile })),
            filter(data => data.hash !== this.profileHash),
            flatMap(async data => {
              const hash = await publish({
                publicKey: this.keyPair.publicKey,
                profile: data.profile,
              })
              await this.atomicSet('profileHash', data.hash)
              return { hash, profile: data.profile }
            }),
          )
          .subscribe({
            next: data => {
              logger.log({
                level: 'debug',
                message: 'Public profile published',
                id: this.localID,
                data,
              })
            },
            error: err => {
              logger.log({
                level: 'error',
                message: 'Public profile publication error',
                id: this.localID,
                error: err.toString(),
              })
            },
          })

        return () => {
          this.stopPublicProfilePublication()
        }
      },

      stopPublicProfilePublication() {
        if (this._publicProfilePublication != null) {
          logger.log({
            level: 'debug',
            message: 'Stop public profile publication',
            id: this.localID,
          })
          this._publicProfilePublication.unsubscribe()
          this._publicProfilePublication = null
        }
      },

      startPublicProfileToggle() {
        if (this._publicProfilePublicationToggle == null) {
          logger.log({
            level: 'debug',
            message: 'Start public profile toggle',
            id: this.localID,
          })
          this._publicProfilePublicationToggle = this.privateProfile$.subscribe(
            {
              next: (isPrivate: boolean) => {
                if (isPrivate && this._publicProfilePublication != null) {
                  this.stopPublicProfilePublication()
                } else if (
                  !isPrivate &&
                  this._publicProfilePublication == null
                ) {
                  this.startPublicProfilePublication()
                }
              },
              error: err => {
                logger.log({
                  level: 'error',
                  message:
                    'Public profile publication toggle subscription error',
                  id: this.localID,
                  error: err.toString(),
                })
              },
            },
          )
        } else {
          logger.log({
            level: 'warn',
            message: 'Public profile publication is already setup',
            id: this.localID,
          })
        }

        return () => {
          this.stopPublicProfileToggle()
        }
      },

      stopPublicProfileToggle() {
        this.stopPublicProfilePublication()
        if (this._publicProfilePublicationToggle != null) {
          logger.log({
            level: 'debug',
            message: 'Stop public profile toggle',
            id: this.localID,
          })
          this._publicProfilePublicationToggle.unsubscribe()
          this._publicProfilePublicationToggle = null
        }
      },

      startContactsSync() {
        if (this._contactsSync != null) {
          logger.log({
            level: 'warn',
            message: 'Contacts sync is already started',
            id: this.localID,
          })
          return
        }

        logger.log({
          level: 'debug',
          message: 'Start contacts sync',
          id: this.localID,
        })

        this._contactsSync = new Subscription()
        // Sync existing contacts
        this.populate('contacts').then(contacts => {
          contacts.forEach(contact => {
            this._contactsSync.add(contact.startSync(this))
          })
        })
        // Sync new contacts
        this.observeContactAdded().subscribe(contact => {
          this._contactsSync.add(contact.startSync(this))
        })

        return () => {
          this.stopContactsSync()
        }
      },

      stopContactsSync() {
        if (this._contactsSync != null) {
          logger.log({
            level: 'debug',
            message: 'Stop contacts sync',
            id: this.localID,
          })
          this._contactsSync.unsubscribe()
          this._contactsSync = null
        }
      },

      startSync() {
        if (this._sync != null) {
          logger.log({
            level: 'warn',
            message: 'Document is already syncing, ignoring startSync() call',
            id: this.localID,
          })
          return
        }

        logger.log({
          level: 'debug',
          message: 'Start document sync',
          id: this.localID,
        })

        const deletedSub = this.deleted$.subscribe(deleted => {
          if (deleted) {
            logger.log({
              level: 'debug',
              message: 'Cleanup deleted document sync',
              id: this.localID,
            })
            this.stopSync()
          }
        })

        this._sync = new Subscription()
        this._sync.add(deletedSub)
        this._sync.add(this.startPublicProfileToggle())
        this._sync.add(this.startContactsSync())

        return () => {
          this.stopSync()
        }
      },

      stopSync() {
        if (this._sync != null) {
          logger.log({
            level: 'debug',
            message: 'Stop document sync',
            id: this.localID,
          })
          this._sync.unsubscribe()
          this._sync = null
        }
      },
    },
  })
}
