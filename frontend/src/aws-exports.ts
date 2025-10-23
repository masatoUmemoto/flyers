import type { ResourcesConfig } from '@aws-amplify/core'

const awsExports: ResourcesConfig = {
  Auth: {
    Cognito: {
      identityPoolId: 'ap-northeast-1:2a285780-14e4-4c88-bc39-d8ea973ae640',
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
