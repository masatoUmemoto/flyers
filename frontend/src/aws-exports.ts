const awsExports = {
  aws_project_region: import.meta.env.VITE_AWS_REGION ?? '',
  aws_appsync_graphqlEndpoint: import.meta.env.VITE_APPSYNC_URL ?? '',
  aws_appsync_region: import.meta.env.VITE_AWS_REGION ?? '',
  aws_appsync_authenticationType: 'AWS_IAM',
  aws_cognito_identity_pool_id: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID ?? '',
}

export default awsExports
