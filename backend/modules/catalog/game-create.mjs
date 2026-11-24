import {Router} from 'express';
import {z} from 'zod';
import {requireRole} from '../../middleware/auth.mjs';
import {requireCsrf} from '../../middleware/csrf.mjs';
import {parse} from '../../utils/validation.mjs';
import {id} from '../../utils/ids.mjs';
import {normalizeGameInputs} from '../../../shared/game-inputs.mjs';

const image=z.string().trim().max(1000).refine(value=>/^(https:\/\/|\/(?!\/))/.test(value) && !/[<>]/.test(value));
const schema=z.object({name:z.string().trim().min(1).max(120),slug:z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),mode:z.enum(['uid','login']),image,thumbnail:z.union([image,z.literal('')]).default(''),category_id:z.string().trim().max(100).default(''),platform:z.enum(['mobile','pc','other']).default('mobile'),active:z.boolean().default(true),input_config:z.unknown().optional()}).strict();
export const gameCreateRouter=Router();
gameCreateRouter.post('/admin/games',requireCsrf,requireRole('admin'),async(req,res,next)=>{
  try{
    const input=parse(schema,req.body),config=normalizeGameInputs(input.input_config||{},input.mode),gameId=id();
    if(input.category_id && !(await req.db.query('SELECT id FROM game_categories WHERE id=$1',[input.category_id])).rowCount)return res.status(400).json({error:'Phân loại không tồn tại.'});
    const result=await req.db.query(`WITH created AS (INSERT INTO games(id,name,slug,mode,image,thumbnail,category_id,platform,active,input_config) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *), logged AS (INSERT INTO audit_events(id,actor_id,action,entity_id) SELECT $11,$12,'game.created',id FROM created) SELECT * FROM created`,[gameId,input.name,input.slug,input.mode,input.image,input.thumbnail,input.category_id||null,input.platform,input.active,JSON.stringify(config),id(),req.user.id]);
    res.status(201).json(result.rows[0]);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'Đường dẫn game đã tồn tại. Vui lòng chọn đường dẫn khác.'});next(error);}
});
