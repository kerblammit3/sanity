import i18n from 'i18next'
import k from './../../i18n/keys'
import {RestoreIcon} from '@sanity/icons'
import React, {useCallback, useMemo, useState} from 'react'
import {DocumentActionComponent, DocumentActionDialogProps, useDocumentOperation} from 'sanity'
import {useRouter} from 'sanity/router'

/** @internal */
export const HistoryRestoreAction: DocumentActionComponent = ({id, type, revision, onComplete}) => {
  const {restore}: any = useDocumentOperation(id, type)
  const router = useRouter()
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const handleConfirm = useCallback(() => {
    restore.execute(revision)
    router.navigateIntent('edit', {id, type})
    onComplete()
  }, [revision, restore, router, onComplete, id, type])

  const handle = useCallback(() => {
    setConfirmDialogOpen(true)
  }, [])

  const dialog: DocumentActionDialogProps | null = useMemo(() => {
    if (isConfirmDialogOpen) {
      return {
        type: 'confirm',
        tone: 'critical',
        onCancel: onComplete,
        onConfirm: handleConfirm,
        message: <>{i18n.t(k.ARE_YOU_SURE_YOU_WANT_TO_RESTO)}</>,
      }
    }

    return null
  }, [handleConfirm, isConfirmDialogOpen, onComplete])

  const isRevisionInitialVersion = revision === '@initial'

  return {
    label: 'Restore',
    color: 'primary',
    onHandle: handle,
    title: isRevisionInitialVersion
      ? "You can't restore to the initial version"
      : 'Restore to this version',
    icon: RestoreIcon,
    dialog,
    disabled: isRevisionInitialVersion,
  }
}

HistoryRestoreAction.action = 'restore'
