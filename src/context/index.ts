import mongo from 'mongodb'
import * as types from '../generated/types'
import * as models from './models'
import { IContext } from './models'
import getDb from './db'

export const context = async ({ req }: { req: any }, db: mongo.Db): Promise<IContext | Error> => {
    const authHeader: string = req.headers['authorization']
    const jwt = authHeader && authHeader.startsWith('Bearer') ? authHeader.slice('Bearer '.length) : undefined
    const user = jwt ? JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8')) : undefined

    try {
        const scores = db.collection<types.Score>('scores')
        const tableTypes = db.collection<types.TableType>('tabletypes')
        const tableLayouts = db.collection<types.TableLayout>('tablelayouts')

        return {
            db,
            scores,
            tableTypes,
            tableLayouts,
            user
        }
    }
    catch (e) {
        const error = e as Error

        return error
    }
}

export {
    IContext,
    getDb,
    models
}

export default context