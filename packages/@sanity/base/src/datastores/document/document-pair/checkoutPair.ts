import {interval, merge, Observable} from 'rxjs'
import {delayWhen, filter, map, share, tap} from 'rxjs/operators'

import {versionedClient} from '../../../client/versionedClient'
import {getPairListener, ListenerEvent} from '../getPairListener'
import {BufferedDocumentEvent, createBufferedDocument} from '../buffered-doc/createBufferedDocument'
import {IdPair, Mutation, ReconnectEvent} from '../types'
import {RemoteSnapshotEvent} from '../buffered-doc/types'

const isEventForDocId = (id: string) => (event: ListenerEvent): boolean =>
  event.type !== 'reconnect' && event.documentId === id

function commitMutations(mutations) {
  return versionedClient.dataRequest('mutate', mutations, {
    visibility: 'async',
    returnDocuments: false,
    tag: 'document.commit',
  })
}

type WithVersion<T> = T & {version: 'published' | 'draft'}

export type DocumentVersionEvent = WithVersion<ReconnectEvent | BufferedDocumentEvent>
export type RemoteSnapshotVersionEvent = WithVersion<RemoteSnapshotEvent>

export interface DocumentVersion {
  consistency$: Observable<boolean>
  remoteSnapshot$: Observable<RemoteSnapshotVersionEvent>
  events: Observable<DocumentVersionEvent>

  patch: (patches) => Mutation[]
  create: (document) => Mutation
  createIfNotExists: (document) => Mutation
  createOrReplace: (document) => Mutation
  delete: () => Mutation

  mutate: (mutations: Mutation[]) => void
  commit: () => Observable<never>
}

export interface Pair {
  published: DocumentVersion
  draft: DocumentVersion
}

function setVersion<T>(version: 'draft' | 'published') {
  return (ev: T): T & {version: 'draft' | 'published'} => ({...ev, version})
}

export function checkoutPair(idPair: IdPair): Pair {
  const {publishedId, draftId} = idPair

  const listenerEvents$ = getPairListener(versionedClient, idPair).pipe(share())

  const reconnect$ = listenerEvents$.pipe(filter((ev) => ev.type === 'reconnect')) as Observable<
    ReconnectEvent
  >

  const draft = createBufferedDocument(
    draftId,
    listenerEvents$.pipe(
      filter(isEventForDocId(draftId)),
      tap((msg) => {
        if (msg.type === 'mutation' && (msg as any).transition === 'disappear') {
          console.log('[repro] Draft delete mutation received')
        }
      })
    ),
    commitMutations
  )

  const published = createBufferedDocument(
    publishedId,
    listenerEvents$.pipe(
      filter(isEventForDocId(publishedId)),
      delayWhen((msg) => {
        if (msg.type !== 'mutation') {
          return interval(0)
        }

        console.log('[repro] Published createOrReplace received, delaying emit by 10s')
        return interval(10000)
      }),
      tap((msg) => {
        if (msg.type === 'mutation') {
          console.log('[repro] Releasing delayed mutation event on published document')
        }
      })
    ),
    commitMutations
  )

  return {
    draft: {
      ...draft,
      events: merge(reconnect$, draft.events).pipe(map(setVersion('draft'))),
      consistency$: draft.consistency$,
      remoteSnapshot$: draft.remoteSnapshot$.pipe(map(setVersion('draft'))),
    },
    published: {
      ...published,
      events: merge(reconnect$, published.events).pipe(map(setVersion('published'))),
      consistency$: published.consistency$,
      remoteSnapshot$: published.remoteSnapshot$.pipe(map(setVersion('published'))),
    },
  }
}