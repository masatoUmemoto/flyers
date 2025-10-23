import { Amplify } from 'aws-amplify'
import type { AuthSession } from 'aws-amplify/auth'
import { fetchAuthSession } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/api'
import awsExports from '../aws-exports'

type GraphQLClient = {
  graphql: (...args: unknown[]) => Promise<unknown>
}

let isConfigured = false
let graphQLClient: GraphQLClient | null = null

export const ensureAmplifyConfigured = () => {
  if (!isConfigured) {
    Amplify.configure(awsExports)
    isConfigured = true
  }
}

export const getGraphQLClient = async (): Promise<GraphQLClient> => {
  ensureAmplifyConfigured()

  let session: AuthSession | undefined
  try {
    session = await fetchAuthSession()
  } catch (error) {
    console.warn('[amplify] fetchAuthSession failed, retrying as guest', error)
    session = await fetchAuthSession({ forceRefresh: true }).catch(
      (retryError) => {
        console.error('[amplify] fetchAuthSession retry failed', retryError)
        throw retryError
      },
    )
  }

  if (!session?.credentials) {
    console.warn(
      '[amplify] No credentials in session, forcing refresh for guest access',
    )
    session = await fetchAuthSession({ forceRefresh: true })
    if (!session.credentials) {
      throw new Error(
        'AWSのゲスト認証情報を取得できませんでした。IDプールの設定とIAMロールの権限を確認してください。',
      )
    }
  }

  if (!graphQLClient) {
    graphQLClient = generateClient() as GraphQLClient
  }

  return graphQLClient
}
