import { Amplify } from '@aws-amplify/core'
import { fetchAuthSession } from '@aws-amplify/auth'
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
  await fetchAuthSession()

  if (!graphQLClient) {
    graphQLClient = generateClient() as GraphQLClient
  }

  return graphQLClient
}
