import i18n from 'i18next'
import k from './../../../i18n/keys'
import {Button, Card, Flex, Heading, Inline, Stack} from '@sanity/ui'
import React from 'react'

export function NotFoundScreen(props: {onNavigateToDefaultWorkspace: () => void}) {
  return (
    <Card height="fill" sizing="border" tone="caution" display="flex">
      <Flex direction="row" justify="center" flex={1} align="center">
        <Stack space={4}>
          <Heading as="h1">{i18n.t(k.WORKSPACE_NOT_FOUND)}</Heading>
          <Inline>
            <Button
              text="Go to default workspace"
              onClick={props.onNavigateToDefaultWorkspace}
              mode="ghost"
            />
          </Inline>
        </Stack>
      </Flex>
    </Card>
  )
}
