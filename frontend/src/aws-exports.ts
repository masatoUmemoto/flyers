import type { ResourcesConfig } from '@aws-amplify/core'

const awsExports: ResourcesConfig = {
  Auth: {
    Cognito: {
      identityPoolId: 'ap-northeast-1:77c45c82-e7e2-4441-9586-9d5c5f4dc6d3',
      allowGuestAccess: true,
    },
  },
  API: {
    GraphQL: {
      endpoint:
        'https://qwppdobtjfbkthf2jtp56c2f4y.appsync-api.ap-northeast-1.amazonaws.com/graphql',
      region: 'ap-northeast-1',
      defaultAuthMode: 'iam',
    },
  },
}

export default awsExports
