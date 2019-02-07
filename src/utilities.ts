import * as types from './generated/types'
import crypto from 'crypto'
import dotent from 'dotenv'

const result = dotent.config()
if (result.error) {
  console.error(result.error)
}

export function isTimeValid(
    serverStartTime: number,
    serverEndTime: number,
    scoreInput: types.ScoreInput,
    allowedDeviation: number): boolean {
    
    return true
    
    if (scoreInput.endTime < scoreInput.startTime) {
        return false
    }

    const startTimeSkew = Math.abs(serverStartTime - scoreInput.startTime)
    if (startTimeSkew > allowedDeviation) {
        return false
    }

    const endTimeSkew = Math.abs(serverEndTime - scoreInput.endTime)
    if (endTimeSkew > allowedDeviation) {
        return false
    }

    const durationDifference = (serverEndTime - serverStartTime) - (scoreInput.endTime - scoreInput.startTime)
    if (durationDifference > allowedDeviation) {
        return false
    }

    const anyAnwsersOutsideOfSubmissionRange = scoreInput.userSequence
        .map(s => s.time)
        .some(time => (time < scoreInput.startTime) || (time > scoreInput.endTime))
        
    if (anyAnwsersOutsideOfSubmissionRange) {
        return false
    }

    return true
}

export function sha256(s: string) {
    return crypto.createHash('sha256').update(s).digest('base64')
}

const algorithm = 'aes-256-ctr'
const encoding: crypto.Utf8AsciiBinaryEncoding = 'utf8'
const hex: crypto.HexBase64BinaryEncoding = 'hex'
const password: string = process.env.CIPHER_PASSWORD!

export function encrypt(text: string): string {
    var cipher = crypto.createCipher(algorithm, password)
    var crypted = cipher.update(text, encoding, hex)
    crypted += cipher.final(hex)
    return crypted
}

export function decrypt(text: string): string {
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = decipher.update(text, hex, encoding)
    dec += decipher.final(encoding)
    return dec
}