import { db } from '@super-app/db'
import { Elysia } from 'elysia'

export const dbPlugin = new Elysia({ name: 'db' }).decorate('db', db)
