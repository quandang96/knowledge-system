import 'dotenv/config'
import path from 'node:path'
import { spawn } from 'node:child_process'
const source=path.resolve(process.env.KNOWLEDGE_ROOT||'knowledge','published')
const child=spawn(process.execPath,[path.resolve('node_modules/vitepress/bin/vitepress.js'),'dev',source,'--host','127.0.0.1','--port','5173'],{stdio:'inherit',windowsHide:true,env:{...process.env,ATLAS_PROJECT_ROOT:process.cwd()}})
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());child.on('exit',code=>process.exit(code||0))
