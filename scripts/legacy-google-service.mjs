import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { DatabaseSync } from 'node:sqlite';
import { createGoogleOAuthRouter } from '../backend/modules/auth/google-oauth.mjs';
import { createSqliteGoogleStore } from '../backend/modules/auth/google-sqlite-store.mjs';

if (!process.env.DB_PATH || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) throw new Error('Missing legacy OAuth deployment configuration');
const db=new DatabaseSync(process.env.DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
const app=express();
app.disable('x-powered-by');app.set('trust proxy','loopback');app.use(helmet());app.use(cookieParser());
const config={clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,callbackUrl:process.env.GOOGLE_CALLBACK_URL};
app.use('/api/auth/oauth/google',createGoogleOAuthRouter({config,store:createSqliteGoogleStore(db),sessionName:'session',cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'}}));
app.get('/api/auth/providers',(_req,res)=>res.set('Cache-Control','no-store').json({password:true,oauth:['google']}));
app.get('/health',(_req,res)=>res.json({ok:true,service:'google-oauth'}));
const server=app.listen(Number(process.env.OAUTH_PORT||4181),'127.0.0.1',()=>console.log('Legacy Google OAuth service ready'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
