import { ApolloServer } from 'apollo-server'
import context, { getDb } from './context'
import adal from 'adal-node'
import schema from './schema'

adal.Logging.setLoggingOptions({
  level: 3,
  log: (level, message, error) => {
    console.log(message)
    if (error) {
      console.log(error)
    }
  }
})

{(async () => {
  const db = await getDb()
  const server = new ApolloServer({
    schema,
    engine: {
      apiKey: process.env.ENGINE_API_KEY,
    },
    context: ({ req }: any) => context({ req }, db)
  })

  const port = process.env.PORT || 4000
  const serverInfo = await server.listen(port)
  const { url } = serverInfo
  console.log(`🚀  Server ready at ${url}`);
})()}
