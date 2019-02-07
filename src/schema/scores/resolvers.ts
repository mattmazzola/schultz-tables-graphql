import * as utilities from '../../utilities'
import { ApolloError } from 'apollo-server'
import uuid from 'uuid/v4'
import * as models from '../../models'
import adal from 'adal-node'
import fetch from 'node-fetch'
import * as types from '../../generated/types'

const Query: types.QueryResolvers.Resolvers = {
    userScores: async (_, { userId }, context, info) => {
        const cursor = await context.scores.find({ userId })
        const scores = await cursor.toArray()

        return scores
    },
    score: async (_, { id }, context, info) => {
        const score = await context.scores.findOne({ id })
        if (!score) {
            throw new Error(`Could not find score by id: ${id}`)
        }

        const tableType = await context.tableTypes.findOne({ id: score.tableTypeId })
        const tableLayout = await context.tableLayouts.findOne({ id: score.tableLayoutId })

        const anyScore = score as any
        anyScore.tableType = tableType
        anyScore.tableLayout = tableLayout

        return anyScore
    },
    scores: async (_, { tableTypeId }, context, info) => {
        const cursor = await context.scores.find()
        const scores = await cursor.toArray()

        const userIds = scores.map(s => s.userId)
        const authenticationContext = new adal.AuthenticationContext(`https://login.microsoftonline.com/${process.env.AAD_TENANT}`)

        const token = await new Promise<adal.TokenResponse | adal.ErrorResponse>((res, rej) => {
            authenticationContext.acquireTokenWithClientCredentials(`https://graph.windows.net`, process.env.AAD_APPLICATION_ID!, process.env.AAD_APPLICATION_KEY!, (err, tokenResponse) => {
                if (err) {
                    rej(err)
                    return
                }

                res(tokenResponse)
                return
            })
        })

        if (token.error) {
            throw token.error
        }

        const tokenResponse: adal.TokenResponse = token as any

        const response = await fetch(`https://graph.windows.net/${process.env.AAD_TENANT}/getObjectsByObjectIds?api-version=1.6`, {
            method: "POST",
            body: JSON.stringify({
                objectIds: userIds,
                types: ["user"]
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${tokenResponse.accessToken}`
            }
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`${response.statusText} ${text}`)
        }

        const graphUsers: models.IGraphApiRespnse<models.IGraphUser[]> = await response.json()

        return {
            scores,
            users: graphUsers.value.map<types.User>(gu => ({
                id: gu.objectId,
                email: gu.otherMails[0] || '',
                name: gu.displayName
            }))
        }
    }
}

const Mutation: types.MutationResolvers.Resolvers = {
    start: () => {
        const now = Date.now().toString()
        const signedTime = utilities.encrypt(now)

        return {
            value: signedTime
        }
    },

    addScore: async (_, { scoreInput }, context) => {
        if (!scoreInput) {
            throw Error(`ScoreInput not defined`)
        }

        const signedStartTime = scoreInput.signedStartTime
        const startTime = Number(utilities.decrypt(signedStartTime))
        const allowedSkew = 2000 // 2 seconds

        const now = new Date().getTime()
        const isTimeValid = utilities.isTimeValid(
            startTime,
            now,
            scoreInput,
            allowedSkew
        )

        if (!isTimeValid) {
            throw new ApolloError(`You have been logged for attempted cheating.  Your account will be reviewed and may be deleted.`)
        }

        const tableLayout: types.TableLayout = {
            width: scoreInput.tableWidth,
            height: scoreInput.tableHeight,
            expectedSequence: scoreInput.expectedSequence,
            randomizedSequence: scoreInput.randomizedSequence,
            id: null!
        }

        const tableType: types.TableType = {
            width: scoreInput.tableWidth,
            height: scoreInput.tableHeight,
            properties: scoreInput.tableProperties,
            id: null!
        }

        const tableLayoutString = JSON.stringify(tableLayout)
        tableLayout.id = utilities.sha256(tableLayoutString)

        const tableTypeString = JSON.stringify(tableType)
        tableType.id = utilities.sha256(tableTypeString)

        const score: types.Score = {
            id: uuid(),
            sequence: scoreInput.userSequence,
            tableLayoutId: tableLayout.id,
            tableTypeId: tableType.id,
            startTime: scoreInput.startTime,
            endTime: scoreInput.endTime,
            duration: scoreInput.endTime - scoreInput.startTime,
            durationMilliseconds: scoreInput.endTime - scoreInput.startTime,
            userId: scoreInput.userId
        }

        const tableLayoutResult = await context.tableLayouts.insertOne(tableLayout)
        const tableTypeResult = await context.tableTypes.updateOne({ id: tableType.id }, { $set: tableType }, { upsert: true })
        const result = await context.scores.insertOne(score)

        return score
    },
}

export default {
    Query,
    Mutation
}